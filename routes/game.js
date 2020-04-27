const game_router =  require('express').Router();
const {get_hand_cards, play_card} = require("../controller/game");

game_router.get('/hand_cards', get_hand_cards);
game_router.get('/play', play_card);

module.exports = {game_router};