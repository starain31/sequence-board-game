const deck = require('../data/board_deck.json');

function get_deck(req, res) {
    res.send({deck});
}

module.exports = {get_deck, deck};