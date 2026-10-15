// For specs that need PostgreSQL. Points DATABASE_URL at a fresh, migrated schema before the app's pool
// is created, so the spec never touches real tables. Call it before requiring anything that uses
// database/pool.js, and call the returned drop() in afterAll.
const {Pool} = require('pg');

const has_database = Boolean(process.env.DATABASE_URL);

async function use_test_schema(label) {
    const base_url = process.env.DATABASE_URL;
    const schema = `test_${label}_${process.pid}_${Date.now()}`;
    const admin = new Pool({connectionString: base_url});
    await admin.query(`CREATE SCHEMA ${schema}`);

    const url = new URL(base_url);
    url.searchParams.set('options', `-c search_path=${schema}`);
    process.env.DATABASE_URL = url.toString();

    const {pool} = require('./pool');
    await require('./migrate').migrate({pool, log: function () {}});

    return {
        pool,
        async drop() {
            await pool.end();
            await admin.query(`DROP SCHEMA ${schema} CASCADE`);
            await admin.end();
            process.env.DATABASE_URL = base_url;
        },
    };
}

module.exports = {has_database, use_test_schema};
