const db_room = require('../database/rooms');
const db_game = require('../database/games');
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

function find_room(id) {
    const room = db_room.get({id});
    if (room === undefined) throw new GameError('ROOM_NOT_FOUND', 'There is no table with that code.');
    return room;
}

function find_game(id) {
    find_room(id);
    const game = db_game.get({room_id: id});
    if (game === undefined) throw new GameError('GAME_NOT_FOUND', "This table's game hasn't started yet.");
    return game;
}

function signed_in_handle(req) {
    const handle = req.session.handle;
    if (handle === undefined) throw new GameError('NOT_SIGNED_IN', 'Sign in to play.');
    return handle;
}

function broadcast_game(room_id) {
    socket_server.broadcast({event: 'game_updated', data: {room_id}});
}

/** POST /room/:id/start: deals a game for a full table. Any seated player or the table's creator may start it. */
function start(req, res) {
    try {
        const {id} = req.params;
        const handle = signed_in_handle(req);
        const room = find_room(id);
        if (room.administrator !== handle && !db_room.is_seated({id, handle})) {
            throw new GameError('NOT_A_PLAYER', 'Only players at this table can start its game.');
        }
        if (db_game.get({room_id: id}) !== undefined) {
            throw new GameError('GAME_ALREADY_STARTED', "This table's game has already started.");
        }
        const full = room.teams.every(function (team) {
            return team.players.every(function (player) {
                return player !== undefined;
            });
        });
        if (!full) throw new GameError('TABLE_NOT_FULL', 'Every seat must be taken before the game can start.');

        const game = create_game({teams: room.teams});
        db_game.save({room_id: id, game});
        res.send(view_for(game, handle));
        broadcast_room({id});
        broadcast_game(id);
    } catch (e) {
        send_error(res, e);
    }
}

/** GET /room/:id/game: the game as the signed-in player sees it (only their own hand). */
function get(req, res) {
    try {
        const game = find_game(req.params.id);
        res.send(view_for(game, req.session.handle));
    } catch (e) {
        send_error(res, e);
    }
}

function move_handler(build_move) {
    return function (req, res) {
        try {
            const {id} = req.params;
            const handle = signed_in_handle(req);
            const game = find_game(id);
            const seated = game.players.some(function (player) {
                return player.handle === handle;
            });
            if (!seated) throw new GameError('NOT_A_PLAYER', "You don't have a seat in this game.");

            const next = apply_move(game, handle, build_move(req.body || {}));
            db_game.save({room_id: id, game: next});
            res.send(view_for(next, handle));
            broadcast_game(id);
        } catch (e) {
            send_error(res, e);
        }
    };
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

module.exports = {start, get, play, exchange, pass};
