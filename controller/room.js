const db_room = require('../database/rooms');
const db_user = require('../database/users');
const socket_server = require('../socket');
const {initialize_game} = require("../entity/game");
const {start} = require("../use_case/game");
const {make_controller} = require('./index');


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
    console.log({player_handle});

    db_user.get_user({handle: player_handle})
        .then(function (player) {
            const {team_handle} = req.body;
            const {id} = req.params;
            player['handle'] = player_handle;

            db_room.join({team_handle, id, player});

            req.session.room_id = id;

            res.send({message: 'success'});

            socket_server.broadcast({event: 'room_updated', data: db_room.get({id})});
        })
        .catch(function (e) {
            res.status(404).send({reason: e});
        });
}

function generate_room_id() {
    // return `${Math.floor(Math.random() * 100)}${Date.now()}`;
    //TODO change needed
    return '1';
}

function room(req, res) {
    try{
        const {id} = req.params;
        const room = db_room.get({id});
        res.send(room);
    }catch (e) {
        res.status(404).send({reason: e});
    }
}

async function start_game(req, res) {
    try {
        const room_id = req.params.id;

        const room = db_room.get({id: room_id});

        const {player_controller, board, deck} = initialize_game({teams: JSON.parse(JSON.stringify(room.teams))});

        room.player_controller = player_controller;
        room.board = board;
        room.deck = deck;
        room.status = 'GAME_INITIALIZE';
        socket_server.broadcast({event: 'game_initialized', data: true});

        res.send({message: 'GAME_INITIALIZE'});
    } catch (e) {
        console.error(e);
    }
}

module.exports = {create, join, room, start_game};
