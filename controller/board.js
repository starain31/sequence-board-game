const deck = require('../data/board_deck.json');
const room_db = require('../database/rooms');

function get_deck(req, res) {
    const room_id = req.session.room_id;
    const room = room_db.get({id: room_id});

    res.send({deck: room.board.get_deck()});
}

module.exports = {get_deck, deck};
