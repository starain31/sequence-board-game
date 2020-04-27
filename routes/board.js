const board_router =  require('express').Router();
const {get_deck} = require("../controller/board");

board_router.get('/deck', get_deck);

module.exports = {board_router};