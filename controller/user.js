const db_user = require('../database/users');
const {UserError, normalize_handle, hash_password, verify_password} = require('../entity/user');

// Account endpoints. Errors are JSON: {error: CODE, message}, like the table game endpoints.

const STATUS_BY_ERROR = {
    INVALID_CREDENTIALS: 401,
    NOT_SIGNED_IN: 401,
};

function send_error(res, e) {
    if (e instanceof UserError) {
        return res.status(STATUS_BY_ERROR[e.code] || 400).send({error: e.code, message: e.message});
    }
    console.error(e);
    res.status(500).send({error: 'SERVER_ERROR', message: 'Something went wrong on the server.'});
}

// Express 4 doesn't catch rejected promises, so async handlers report their own errors.
function handler(action) {
    return function (req, res) {
        action(req, res).catch(function (e) {
            send_error(res, e);
        });
    };
}

function public_profile(user) {
    return {handle: user.handle, name: user.name};
}

// A fresh session id on every sign-in, so an id planted before signing in (session fixation) is useless.
function start_session(req, user) {
    return new Promise(function (resolve, reject) {
        req.session.regenerate(function (error) {
            if (error) return reject(error);
            req.session.handle = user.handle;
            resolve();
        });
    });
}

// Checked when the handle doesn't exist, so an unknown handle takes as long as a wrong password and
// response times don't reveal which handles are registered.
const unknown_user_hash = hash_password('no account has this password');

async function signin(req, res) {
    const {password} = req.body;
    const handle = normalize_handle(req.body.handle);
    const user = handle === '' ? undefined : await db_user.find_credentials({handle});
    const is_valid = await verify_password(password, user ? user.password_hash : await unknown_user_hash);
    if (user === undefined || !is_valid) {
        throw new UserError('INVALID_CREDENTIALS', "That handle and password don't match.");
    }
    await start_session(req, user);
    res.send(public_profile(user));
}

async function profile(req, res) {
    const user = await db_user.get_user({handle: req.session.handle});
    if (user === undefined) {
        throw new UserError('NOT_SIGNED_IN', 'Sign in first.');
    }
    res.send(public_profile(user));
}

module.exports = {
    signin: handler(signin),
    profile: handler(profile),
};
