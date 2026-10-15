// Applies the plain SQL files in database/migrations/ in file name order, each one once.
// Name new files with the next number, e.g. `0002_add_turns.sql`; never edit a file that has been applied.
const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIRECTORY = path.join(__dirname, 'migrations');
// Any constant works; it only has to be the same for every server process sharing the database.
const MIGRATION_LOCK_ID = 7_265_001;

function list_migrations({directory}) {
    return fs.readdirSync(directory)
        .filter(function (file) {
            return file.endsWith('.sql');
        })
        .sort();
}

async function migrate({pool, directory = MIGRATIONS_DIRECTORY, log = console.log}) {
    const client = await pool.connect();
    try {
        // Two servers starting together would otherwise race to apply the same file.
        await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
        await client.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                name       TEXT PRIMARY KEY,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )`);

        const {rows} = await client.query('SELECT name FROM schema_migrations');
        const applied = new Set(rows.map(function (row) {
            return row.name;
        }));
        const pending = list_migrations({directory}).filter(function (name) {
            return !applied.has(name);
        });

        for (const name of pending) {
            const sql = fs.readFileSync(path.join(directory, name), 'utf8');
            await client.query('BEGIN');
            try {
                await client.query(sql);
                await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
                await client.query('COMMIT');
            } catch (error) {
                await client.query('ROLLBACK');
                throw new Error(`Migration ${name} failed: ${error.message}`);
            }
            log(`Applied migration ${name}`);
        }
        return pending;
    } finally {
        await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]).catch(function () {});
        client.release();
    }
}

module.exports = {migrate};

// `npm run db:migrate`
if (require.main === module) {
    const {pool} = require('./pool');
    migrate({pool})
        .then(function (applied) {
            if (applied.length === 0) console.log('Database is up to date');
        })
        .catch(function (error) {
            console.error(error.message);
            process.exitCode = 1;
        })
        .finally(function () {
            return pool.end();
        });
}
