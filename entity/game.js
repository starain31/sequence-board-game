const {create_players} = require('./players');
const {New_board} = require('./board');
const new_deck = JSON.parse(JSON.stringify(require('../data/game_deck.json')));

function initialize_game({teams}) {
    const board = New_board();
    const players = create_players({teams});
    const deck = shuffle(new_deck);
    deal_cards({players, deck});

    return {players, board, deck};
}

function shuffle(deck) {
    // deck = JSON.parse(JSON.stringify(deck));
    const final_deck = [];
    while(deck.length !== 0) {
        const random_card = Math.floor(Math.random() * deck.length);
        final_deck.push(deck[random_card]);
        deck.splice(random_card, 1);
    }
    return final_deck;
}

function deal_cards({players, deck}) {
    const number_of_card_for = {
        '2': 7,
        '3': 6,
        '4': 6,
        '6': 5,
        '8': 4,
        '9': 4,
        '10': 3,
        '12': 3,
    };
    const number_of_card_to_be_dealt = number_of_card_for[players.number_of_players()] * players.number_of_players();

    for (let i = 0; i < number_of_card_to_be_dealt; i++) {
        const player = players.next_player();
        player.take_card({card: deck.pop()});
    }
}

module.exports = {initialize_game};
