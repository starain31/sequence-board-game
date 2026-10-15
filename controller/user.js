const db_user = require('../database/users');
const db_room = require('../database/rooms');
const {UserError, normalize_handle, validate_signup, hash_password, verify_password} = require('../entity/user');

// Account endpoints. Errors are JSON: {error: CODE, message}, like the table game endpoints.

const STATUS_BY_ERROR = {
    INVALID_CREDENTIALS: 401,
    NOT_SIGNED_IN: 401,
    HANDLE_TAKEN: 409,
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

async function signup(req, res) {
    const {handle, name, password} = validate_signup(req.body);
    let user;
    try {
        user = await db_user.create_user({handle, name, password_hash: await hash_password(password)});
    } catch (e) {
        if (e === 'HANDLE_TAKEN') throw new UserError('HANDLE_TAKEN', 'That handle is taken. Pick another one.');
        throw e;
    }
    await start_session(req, user);
    res.status(201).send(public_profile(user));
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

// Works with or without a session, so a client can always sign out cleanly.
async function signout(req, res) {
    await new Promise(function (resolve, reject) {
        req.session.destroy(function (error) {
            if (error) return reject(error);
            resolve();
        });
    });
    res.clearCookie('connect.sid');
    res.status(204).send();
}

async function profile(req, res) {
    const user = await db_user.get_user({handle: req.session.handle});
    if (user === undefined) {
        throw new UserError('NOT_SIGNED_IN', 'Sign in first.');
    }
    res.send(public_profile(user));
}

// The signed-in user's tables, newest first: where they sat and how far each game got.
const ROOMS_PER_PAGE = {default: 10, max: 50};

// A positive whole number from the query string, or `fallback` when it is missing or not one.
function positive_integer(value, fallback) {
    const number = Number(value);
    return Number.isInteger(number) && number >= 1 ? number : fallback;
}

/** GET /user/rooms?page=1&per_page=10: one page of the user's tables, newest first, with the totals for paging. */
async function rooms(req, res) {
    const user = await db_user.get_user({handle: req.session.handle});
    if (user === undefined) {
        throw new UserError('NOT_SIGNED_IN', 'Sign in first.');
    }
    const per_page = Math.min(positive_integer(req.query.per_page, ROOMS_PER_PAGE.default), ROOMS_PER_PAGE.max);
    const page = positive_integer(req.query.page, 1);
    const total = await db_room.count_for_user({user_id: user.id});
    const list = await db_room.list_for_user({user_id: user.id, limit: per_page, offset: (page - 1) * per_page});
    res.send({rooms: list, page, per_page, total, pages: Math.max(1, Math.ceil(total / per_page))});
}

module.exports = {
    signup: handler(signup),
    signin: handler(signin),
    signout: handler(signout),
    profile: handler(profile),
    rooms: handler(rooms),
};
