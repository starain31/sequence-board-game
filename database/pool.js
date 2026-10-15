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

module.exports = {pool, ping};
