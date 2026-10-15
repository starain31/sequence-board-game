const db_room = require('../database/rooms');
const db_user = require('../database/users');
const db_game = require('../database/games');
const {transaction} = require('../database/pool');
const {is_supported_table} = require('../entity/sequence_game');
const socket_server = require('../socket');

/** POST /room/create {number_of_team, number_of_player_in_each_team}: 200 {id}, errors are JSON {error, message}. */
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
    const id = generate_room_id();
    await db_room.create({id, administrator_id: administrator.id, team_count, players_per_team});
    res.send({id});
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

function generate_room_id() {
    return `${Math.floor(Math.random() * 100)}${Date.now()}`;
}

async function room_payload({id}) {
    const room = await db_room.get({id});
    if (room === undefined) {
        return undefined;
    }
    return {
        id: room.id,
        administrator: room.administrator,
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

// Express 4 doesn't catch rejected promises; answer 500 instead of leaving the request hanging.
function handler(action) {
    return function (req, res) {
        action(req, res).catch(function (e) {
            console.error(e);
            if (!res.headersSent) res.status(500).send({error: 'SERVER_ERROR', message: 'Something went wrong on the server.'});
        });
    };
}

module.exports = {
    create: handler(create),
    join: handler(join),
    room: handler(room),
    room_payload,
    broadcast_room,
};
