const db_room = require('../database/rooms');
const db_user = require('../database/users');
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

            db_room.join({team_handle, id, player: {handle: player_handle, name: user.name}});

            res.send({message: 'success'});

            socket_server.broadcast({event: 'room_updated', data: db_room.get({id})});

        })
        .catch(function (e) {
            if (typeof e !== 'string') console.error(e);
            res.send({message: typeof e === 'string' ? e : 'ERROR'});
        });
}

function generate_room_id() {
    return `${Math.floor(Math.random() * 100)}${Date.now()}`;
}

function room(req, res) {
    const {id} = req.params;
    const room = db_room.get({id});
    res.send(room);
}

module.exports = {create, join, room};
