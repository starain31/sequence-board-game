const db_room = require('../database/rooms');
const db_user = require('../database/users');
const db_game = require('../database/games');
const {transaction} = require('../database/pool');
const {is_supported_table} = require('../entity/sequence_game');
const {RoomError, normalize_name, generate_slug, parse_settings} = require('../entity/room');
const socket_server = require('../socket');

/**
 * POST /room/create {number_of_team, number_of_player_in_each_team, name?, history?, highlights?, auto_draw_dead?}:
 * 200 {id}, where id is the table's slug. Errors are JSON {error, message}.
 */
async function create(req, res) {
    const administrator = await db_user.get_user({handle: req.session.handle});
    if (administrator === undefined) {
        return res.status(401).send({error: 'NOT_SIGNED_IN', message: 'Sign in to open a table.'});
    }
    const team_count = Number(req.body.number_of_team);
    const players_per_team = Number(req.body.number_of_player_in_each_team);
    if (!is_supported_table(team_count, players_per_team)) {
        return res.status(400).send({
            error: 'UNSUPPORTED_TABLE',
            message: `A game can't be dealt for ${req.body.number_of_team} teams of ${req.body.number_of_player_in_each_team}.`,
        });
    }
    const name = normalize_name(req.body.name);
    const settings = parse_settings(req.body);
    const id = await db_room.create({
        make_id: function () {
            return generate_slug(name);
        },
        name,
        administrator_id: administrator.id,
        team_count,
        players_per_team,
        settings,
    });
    res.send({id});
}

/**
 * PATCH /room/:id/settings {name?, history?, highlights?, auto_draw_dead?}: only the table's creator, and only
 * before the game starts. 200 with the room; missing keys keep their value.
 */
async function update_settings(req, res) {
    const handle = req.session.handle;
    if (handle === undefined) {
        throw new RoomError('NOT_SIGNED_IN', 'Sign in to change this table.');
    }
    const {id} = req.params;
    await transaction(async function (client) {
        const room = await db_room.get({id, client, lock: true});
        if (room === undefined) {
            throw new RoomError('ROOM_NOT_FOUND', 'There is no table with that code.');
        }
        if (room.administrator !== handle) {
            throw new RoomError('NOT_HOST', 'Only the player who opened this table can change its settings.');
        }
        if (await db_game.get({room_id: id, client}) !== undefined) {
            throw new RoomError('GAME_ALREADY_STARTED', "The game has started, so the table's settings are fixed.");
        }
        const name = req.body.name === undefined ? room.name : normalize_name(req.body.name);
        await db_room.update({id, name, settings: parse_settings(req.body, room.settings), client});
    });
    res.send(await room_payload({id}));
    await broadcast_room({id});
}

/** POST /room/:id/join {team_handle}: always 200 {message}, see docs/api.md. */
async function join(req, res) {
    const user = await db_user.get_user({handle: req.session.handle});
    if (user === undefined) {
        return res.send({message: 'NOT_SIGNED_IN'});
    }
    const {id} = req.params;
    try {
        await transaction(async function (client) {
            if (await db_game.get({room_id: id, client}) !== undefined) {
                throw 'GAME_ALREADY_STARTED';
            }
            await db_room.join({id, team_handle: req.body.team_handle, user, client});
        });
    } catch (e) {
        if (typeof e !== 'string') throw e;
        return res.send({message: e});
    }
    res.send({message: 'success'});
    await broadcast_room({id});
}

async function room_payload({id}) {
    const room = await db_room.get({id});
    if (room === undefined) {
        return undefined;
    }
    return {
        id: room.id,
        name: room.name,
        administrator: room.administrator,
        settings: room.settings,
        teams: room.teams,
        created_at: room.created_at,
        game_started: await db_game.get({room_id: id}) !== undefined,
    };
}

async function broadcast_room({id}) {
    socket_server.broadcast({event: 'room_updated', data: await room_payload({id})});
}

async function room(req, res) {
    res.send(await room_payload({id: req.params.id}));
}

const STATUS_BY_ERROR = {
    NOT_SIGNED_IN: 401,
    NOT_HOST: 403,
    ROOM_NOT_FOUND: 404,
    GAME_ALREADY_STARTED: 409,
};

// Express 4 doesn't catch rejected promises; answer instead of leaving the request hanging.
function handler(action) {
    return function (req, res) {
        action(req, res).catch(function (e) {
            if (res.headersSent) return console.error(e);
            if (e instanceof RoomError) {
                return res.status(STATUS_BY_ERROR[e.code] || 400).send({error: e.code, message: e.message});
            }
            console.error(e);
            res.status(500).send({error: 'SERVER_ERROR', message: 'Something went wrong on the server.'});
        });
    };
}

module.exports = {
    create: handler(create),
    join: handler(join),
    room: handler(room),
    update_settings: handler(update_settings),
    room_payload,
    broadcast_room,
};
