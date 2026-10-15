const crypto = require('crypto');
const {session_secret} = require('../session');

// Who is at each table's game right now: a player is present while at least one of their sockets has the game
// open. Kept in memory, so after a restart everyone is away until their page reconnects (which it does by itself).
//
// A socket says which player it is with a token from that player's game view, signed with the session secret,
// so it can't claim to be someone else, and it works whenever the player signed in.

// A dropped socket (a page reload, a flaky network) counts as away only if it isn't back within this long.
const DISCONNECT_GRACE_MS = 4000;

const tables = new Map();
const departures = new Map();
let listener = function () {};

function key(room_id, handle, connection) {
    return JSON.stringify([room_id, handle, connection]);
}

/** The token `handle` sends on its game socket for `room_id`. */
function token_for(room_id, handle) {
    return crypto.createHmac('sha256', session_secret()).update(JSON.stringify([String(room_id), handle])).digest('base64');
}

function verify_token(room_id, handle, token) {
    if (typeof handle !== 'string' || typeof token !== 'string') return false;
    const expected = Buffer.from(token_for(room_id, handle));
    const given = Buffer.from(token);
    return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

/** `fn(room_id, handle)` is called whenever a player arrives at or leaves a table's game. */
function on_change(fn) {
    listener = fn;
}

function is_present(room_id, handle) {
    const players = tables.get(String(room_id));
    return players !== undefined && players.has(handle);
}

/** The handles of everyone at the table's game. */
function present(room_id) {
    const players = tables.get(String(room_id));
    return players === undefined ? [] : Array.from(players.keys());
}

/** `connection` (a socket id) opened the game at `room_id` as `handle`. */
function arrive({room_id, handle, connection}) {
    room_id = String(room_id);
    const pending = departures.get(key(room_id, handle, connection));
    if (pending !== undefined) {
        clearTimeout(pending);
        departures.delete(key(room_id, handle, connection));
    }
    if (!tables.has(room_id)) tables.set(room_id, new Map());
    const players = tables.get(room_id);
    const arrived = !players.has(handle);
    if (arrived) players.set(handle, new Set());
    players.get(handle).add(connection);
    if (arrived) listener(room_id, handle);
}

/** `connection` closed the game, at once or, with `grace_ms`, unless it comes back by then. */
function depart({room_id, handle, connection, grace_ms = 0}) {
    room_id = String(room_id);
    const id = key(room_id, handle, connection);
    if (grace_ms > 0) {
        if (departures.has(id)) return;
        const timer = setTimeout(function () {
            departures.delete(id);
            depart({room_id, handle, connection});
        }, grace_ms);
        timer.unref();
        departures.set(id, timer);
        return;
    }
    const players = tables.get(room_id);
    if (players === undefined || !players.has(handle)) return;
    const connections = players.get(handle);
    connections.delete(connection);
    if (connections.size > 0) return;
    players.delete(handle);
    if (players.size === 0) tables.delete(room_id);
    listener(room_id, handle);
}

/** Forgets everyone (for tests). */
function reset() {
    departures.forEach(clearTimeout);
    departures.clear();
    tables.clear();
}

module.exports = {DISCONNECT_GRACE_MS, token_for, verify_token, on_change, is_present, present, arrive, depart, reset};
