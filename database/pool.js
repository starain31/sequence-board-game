const {Pool} = require('pg');

// Matches the `db` service in docker-compose.yml, published on localhost, so `npm start` works
// against `docker compose up db` without any configuration.
const DEFAULT_DATABASE_URL = 'postgres://sequence:sequence@localhost:5432/sequence';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || DEFAULT_DATABASE_URL,
});

// An idle client losing its connection (for example the database restarting) must not crash the server;
// the pool discards it and the next query opens a new connection.
pool.on('error', function (error) {
    console.error('Idle database client error:', error.message);
});

async function ping() {
    await pool.query('SELECT 1');
}

// Runs action(client) inside BEGIN … COMMIT on one connection, rolling back if it throws.
async function transaction(action) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await action(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK').catch(function () {});
        throw error;
    } finally {
        client.release();
    }
}

module.exports = {pool, ping, transaction};
