// Needs a running PostgreSQL: `docker compose up db`, then
// `DATABASE_URL=postgres://sequence:sequence@localhost:5432/sequence npm test`.
// Skipped when DATABASE_URL is not set, so `npm test` still works without Docker.
const fs = require('fs');
const os = require('os');
const path = require('path');
const {Pool} = require('pg');
const {migrate} = require('./migrate');

const describe_with_database = process.env.DATABASE_URL ? describe : describe.skip;

describe_with_database('migrate', function () {
    // Each run gets its own schema, so the tests never touch the real tables.
    const schema = `test_migrate_${process.pid}_${Date.now()}`;
    let admin;
    let pool;
    let directory;

    function write_migration(name, sql) {
        fs.writeFileSync(path.join(directory, name), sql);
    }

    async function table_exists(name) {
        const {rows} = await pool.query('SELECT to_regclass($1) AS table', [name]);
        return rows[0].table !== null;
    }

    beforeAll(async function () {
        admin = new Pool({connectionString: process.env.DATABASE_URL});
        await admin.query(`CREATE SCHEMA ${schema}`);
        pool = new Pool({connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema}`});
    });

    beforeEach(async function () {
        directory = fs.mkdtempSync(path.join(os.tmpdir(), 'migrations-'));
        await pool.query('DROP TABLE IF EXISTS schema_migrations, first, second, half');
    });

    afterEach(function () {
        fs.rmSync(directory, {recursive: true, force: true});
    });

    afterAll(async function () {
        await pool.end();
        await admin.query(`DROP SCHEMA ${schema} CASCADE`);
        await admin.end();
    });

    test('applies pending files in name order, once each', async function () {
        write_migration('0002_second.sql', 'CREATE TABLE second (first_id INT REFERENCES first (id));');
        write_migration('0001_first.sql', 'CREATE TABLE first (id INT PRIMARY KEY);');
        write_migration('notes.txt', 'not a migration');

        expect(await migrate({pool, directory, log: function () {}}))
            .toEqual(['0001_first.sql', '0002_second.sql']);
        expect(await migrate({pool, directory, log: function () {}})).toEqual([]);
        expect(await table_exists('second')).toBe(true);
    });

    test('rolls a failing file back completely and stops', async function () {
        write_migration('0001_first.sql', 'CREATE TABLE first (id INT PRIMARY KEY);');
        write_migration('0002_broken.sql', 'CREATE TABLE half (id INT); SELECT missing_column;');
        write_migration('0003_second.sql', 'CREATE TABLE second (id INT);');

        await expect(migrate({pool, directory, log: function () {}}))
            .rejects.toThrow('Migration 0002_broken.sql failed');
        expect(await table_exists('first')).toBe(true);
        expect(await table_exists('half')).toBe(false);
        expect(await table_exists('second')).toBe(false);

        const {rows} = await pool.query('SELECT name FROM schema_migrations');
        expect(rows).toEqual([{name: '0001_first.sql'}]);
    });

    test('concurrent runs apply each file once', async function () {
        write_migration('0001_first.sql', 'CREATE TABLE first (id INT PRIMARY KEY);');

        const results = await Promise.all([
            migrate({pool, directory, log: function () {}}),
            migrate({pool, directory, log: function () {}}),
        ]);
        expect(results.flat()).toEqual(['0001_first.sql']);
    });
});
