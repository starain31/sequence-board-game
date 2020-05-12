const room_router = require('express').Router();
const {create, join, room, start_game} = require('../controller/room');

room_router.post('/create', create);
room_router.get('/:id', room);
room_router.post('/:id/join', join);
room_router.post('/:id/start', start_game);

module.exports = {room_router};
