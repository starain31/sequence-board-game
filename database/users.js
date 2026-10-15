const {pool} = require('./pool');

// Public fields only. password_hash is read in exactly one place, find_credentials, for sign-in.
const PUBLIC_COLUMNS = 'id, handle, name, created_at';

async function get_user({handle}) {
    if (typeof handle !== 'string') {
        return undefined;
    }
    const {rows} = await pool.query(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE handle = $1`, [handle]);
    return rows[0];
}

async function find_credentials({handle}) {
    const {rows} = await pool.query(`SELECT ${PUBLIC_COLUMNS}, password_hash FROM users WHERE handle = $1`, [handle]);
    return rows[0];
}

// Throws 'HANDLE_TAKEN' when the handle exists. The unique index decides, so two simultaneous sign-ups
// for the same handle can't both succeed.
async function create_user({handle, name, password_hash}) {
    try {
        const {rows} = await pool.query(
            `INSERT INTO users (handle, name, password_hash) VALUES ($1, $2, $3) RETURNING ${PUBLIC_COLUMNS}`,
            [handle, name, password_hash]
        );
        return rows[0];
    } catch (error) {
        if (error.code === '23505') {
            throw 'HANDLE_TAKEN';
        }
        throw error;
    }
}

module.exports = {get_user, find_credentials, create_user};
