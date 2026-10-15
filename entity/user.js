// Account rules and password hashing. No I/O besides the CPU-bound hash, so it is easy to test.
const crypto = require('crypto');
const {promisify} = require('util');

const scrypt = promisify(crypto.scrypt);

const HANDLE_PATTERN = /^[a-z0-9_]{3,20}$/;
const NAME_MAX_LENGTH = 50;
const PASSWORD_MIN_LENGTH = 8;
// Hashing cost grows with input length; cap it so a huge password can't tie up the server.
const PASSWORD_MAX_LENGTH = 200;

// scrypt cost parameters. They are stored in every hash, so they can be raised later without breaking
// existing accounts. N = 2^15 needs 32 MiB, just over Node's default limit, hence MAX_MEMORY.
const SCRYPT = {N: 2 ** 15, r: 8, p: 1};
const MAX_MEMORY = 64 * 1024 * 1024;
const KEY_LENGTH = 64;

class UserError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}

function normalize_handle(handle) {
    return typeof handle === 'string' ? handle.trim().toLowerCase() : '';
}

// Returns the cleaned-up {handle, name, password}, or throws a UserError naming the first invalid field.
function validate_signup({handle, name, password}) {
    const clean_handle = normalize_handle(handle);
    if (!HANDLE_PATTERN.test(clean_handle)) {
        throw new UserError('INVALID_HANDLE', 'Handles are 3 to 20 characters: letters, digits and underscores.');
    }
    const clean_name = typeof name === 'string' ? name.trim() : '';
    if (clean_name.length === 0 || clean_name.length > NAME_MAX_LENGTH) {
        throw new UserError('INVALID_NAME', `Enter a display name of up to ${NAME_MAX_LENGTH} characters.`);
    }
    if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) {
        throw new UserError('WEAK_PASSWORD', `Passwords need at least ${PASSWORD_MIN_LENGTH} characters.`);
    }
    if (password.length > PASSWORD_MAX_LENGTH) {
        throw new UserError('WEAK_PASSWORD', `Passwords can be at most ${PASSWORD_MAX_LENGTH} characters.`);
    }
    return {handle: clean_handle, name: clean_name, password};
}

async function hash_password(password, {N, r, p} = SCRYPT) {
    const salt = crypto.randomBytes(16);
    const key = await scrypt(password, salt, KEY_LENGTH, {N, r, p, maxmem: MAX_MEMORY});
    return ['scrypt', N, r, p, salt.toString('base64'), key.toString('base64')].join('$');
}

async function verify_password(password, stored_hash) {
    if (typeof password !== 'string' || password.length > PASSWORD_MAX_LENGTH) {
        return false;
    }
    const [algorithm, N, r, p, salt, expected] = String(stored_hash).split('$');
    if (algorithm !== 'scrypt' || expected === undefined) {
        return false;
    }
    const expected_key = Buffer.from(expected, 'base64');
    const key = await scrypt(password, Buffer.from(salt, 'base64'), expected_key.length, {
        N: Number(N), r: Number(r), p: Number(p), maxmem: MAX_MEMORY,
    });
    return crypto.timingSafeEqual(key, expected_key);
}

module.exports = {UserError, normalize_handle, validate_signup, hash_password, verify_password};
