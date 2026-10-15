const db_room = require('../database/rooms');
const db_game = require('../database/games');
const {transaction} = require('../database/pool');
const socket_server = require('../socket');
const {broadcast_room} = require('./room');
const {RuleError, create_game, apply_move, view_for} = require('../entity/sequence_game');

// A game played at a room's table. Errors are JSON: {error: CODE, message}.

const STATUS_BY_ERROR = {
    NOT_SIGNED_IN: 401,
    NOT_A_PLAYER: 403,
    ROOM_NOT_FOUND: 404,
    GAME_NOT_FOUND: 404,
    GAME_ALREADY_STARTED: 409,
    TABLE_NOT_FULL: 409,
    NOT_YOUR_TURN: 409,
    GAME_OVER: 409,
    HISTORY_DISABLED: 403,
};

class GameError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}

function send_error(res, e) {
    if (e instanceof GameError || e instanceof RuleError) {
        return res.status(STATUS_BY_ERROR[e.code] || 400).send({error: e.code, message: e.message});
    }
    console.error(e);
    res.status(500).send({error: 'SERVER_ERROR', message: 'Something went wrong on the server.'});
}

async function find_room(id, client) {
    const room = await db_room.get({id, client, lock: true});
    if (room === undefined) throw new GameError('ROOM_NOT_FOUND', 'There is no table with that code.');
    return room;
}

// {room, game}. With `client` (inside a transaction) the game row stays locked until the transaction ends, so
// two moves on the same table can't interleave.
async function find_game(id, client) {
    const room = await db_room.get({id, client});
    if (room === undefined) throw new GameError('ROOM_NOT_FOUND', 'There is no table with that code.');
    const game = await db_game.get({room_id: id, client, lock: client !== undefined});
    if (game === undefined) throw new GameError('GAME_NOT_FOUND', "This table's game hasn't started yet.");
    return {room, game};
}

// The game as `handle` sees it, under the room's settings.
function view(room, game, handle) {
    return Object.assign(view_for(game, handle, room.settings), {name: room.name});
}

function signed_in_handle(req) {
    const handle = req.session.handle;
    if (handle === undefined) throw new GameError('NOT_SIGNED_IN', 'Sign in to play.');
    return handle;
}

function broadcast_game(room_id) {
    socket_server.broadcast({event: 'game_updated', data: {room_id}});
}

// Express 4 doesn't catch rejected promises, so every handler reports its own errors.
function handler(action) {
    return function (req, res) {
        action(req, res).catch(function (e) {
            send_error(res, e);
        });
    };
}

/** POST /room/:id/start: deals a game for a full table. Any seated player or the table's creator may start it. */
async function start(req, res) {
    const {id} = req.params;
    const handle = signed_in_handle(req);
    const {room, game} = await transaction(async function (client) {
        const room = await find_room(id, client);
        if (room.administrator !== handle && !db_room.is_seated(room, handle)) {
            throw new GameError('NOT_A_PLAYER', 'Only players at this table can start its game.');
        }
        if (await db_game.get({room_id: id, client}) !== undefined) {
            throw new GameError('GAME_ALREADY_STARTED', "This table's game has already started.");
        }
        if (!db_room.is_full(room)) throw new GameError('TABLE_NOT_FULL', 'Every seat must be taken before the game can start.');

        const created = create_game({teams: room.teams, rules: room.settings});
        await db_game.create({room_id: id, state: created, client});
        return {room, game: created};
    });
    res.send(view(room, game, handle));
    broadcast_game(id);
    await broadcast_room({id});
}

/** GET /room/:id/game: the game as the signed-in player sees it (only their own hand). */
async function get(req, res) {
    const {room, game} = await find_game(req.params.id);
    res.send(view(room, game, req.session.handle));
}

/** GET /room/:id/turns: every move so far, oldest first. Public, like the game view, unless the room turned history off. */
async function turns(req, res) {
    const {room} = await find_game(req.params.id);
    if (!room.settings.history) throw new GameError('HISTORY_DISABLED', 'This table plays without move history.');
    res.send(await db_game.list_turns({room_id: req.params.id}));
}

function move_handler(build_move) {
    return handler(async function (req, res) {
        const {id} = req.params;
        const handle = signed_in_handle(req);
        const move = build_move(req.body || {});
        const {room, next} = await transaction(async function (client) {
            const {room, game} = await find_game(id, client);
            const seated = game.players.some(function (player) {
                return player.handle === handle;
            });
            if (!seated) throw new GameError('NOT_A_PLAYER', "You don't have a seat in this game.");

            const played = apply_move(game, handle, move);
            await db_game.record_move({room_id: id, previous: game, next: played, handle, move, client});
            return {room, next: played};
        });
        res.send(view(room, next, handle));
        broadcast_game(id);
    });
}

/** POST /room/:id/game/play  {hand_index, row, column} */
const play = move_handler(function (body) {
    return {type: 'play', hand_index: Number(body.hand_index), target: {row: Number(body.row), column: Number(body.column)}};
});

/** POST /room/:id/game/exchange  {hand_index} */
const exchange = move_handler(function (body) {
    return {type: 'exchange', hand_index: Number(body.hand_index)};
});

/** POST /room/:id/game/pass */
const pass = move_handler(function () {
    return {type: 'pass'};
});

module.exports = {start: handler(start), get: handler(get), turns: handler(turns), play, exchange, pass};
