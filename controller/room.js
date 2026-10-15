const db_room = require('../database/rooms');
const db_user = require('../database/users');
const db_game = require('../database/games');
const socket_server = require('../socket');

function create(req, res) {
    const administrator = req.session.handle;
    const {number_of_team, number_of_player_in_each_team} = req.body;
    const id = generate_room_id();

    db_room.create({
        administrator,
        id,
        number_of_team,
        number_of_player_in_each_team
    });

    res.send({id});
}

function join(req, res) {
    const player_handle = req.session.handle;
    if (player_handle === undefined) {
        return res.send({message: 'NOT_SIGNED_IN'});
    }

    db_user.get_user({handle: player_handle})
        .then(function (user) {
            const {team_handle} = req.body;
            const {id} = req.params;

            if (db_game.get({room_id: id}) !== undefined) {
                throw 'GAME_ALREADY_STARTED';
            }
            db_room.join({team_handle, id, player: {handle: player_handle, name: user.name}});

            res.send({message: 'success'});

            broadcast_room({id});
        })
        .catch(function (e) {
            if (typeof e !== 'string') console.error(e);
            res.send({message: typeof e === 'string' ? e : 'ERROR'});
        });
}

function generate_room_id() {
    return `${Math.floor(Math.random() * 100)}${Date.now()}`;
}

function room_payload({id}) {
    const room = db_room.get({id});
    if (room === undefined) {
        return undefined;
    }
    return Object.assign({}, room, {game_started: db_game.get({room_id: id}) !== undefined});
}

function broadcast_room({id}) {
    socket_server.broadcast({event: 'room_updated', data: room_payload({id})});
}

function room(req, res) {
    const {id} = req.params;
    res.send(room_payload({id}));
}

module.exports = {create, join, room, room_payload, broadcast_room};
