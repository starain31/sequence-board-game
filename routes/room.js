const room_router =  require('express').Router();
const {create, join, leave, room, update_settings} = require('../controller/room');
const room_game = require('../controller/room_game');

room_router.post('/create', create);
room_router.get('/:id', room);
room_router.post('/:id/join', join);
room_router.post('/:id/leave', leave);
room_router.patch('/:id/settings', update_settings);
room_router.post('/:id/start', room_game.start);
room_router.get('/:id/game', room_game.get);
room_router.get('/:id/turns', room_game.turns);
room_router.post('/:id/game/play', room_game.play);
room_router.post('/:id/game/exchange', room_game.exchange);
room_router.post('/:id/game/pass', room_game.pass);

module.exports = {room_router};
