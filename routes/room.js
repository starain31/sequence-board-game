const room_router =  require('express').Router();
const {create, join, room} = require('../controller/room');

room_router.post('/create', create);
room_router.get('/:id', room);
room_router.post('/:id/join', join);

module.exports = {room_router};
