const {create_player_controller} = require('./players');
const {New_board} = require('./board');
const new_deck = JSON.parse(JSON.stringify(require('../data/game_deck.json')));

function initialize_game({teams}) {
    const board = New_board();
    const player_controller = create_player_controller({teams});
    const deck = shuffle(new_deck);
    deal_cards({player_controller, deck});

    return {player_controller, board, deck};
}

function shuffle(deck) {
    const final_deck = [];
    while(deck.length !== 0) {
        const random_card = Math.floor(Math.random() * deck.length);
        final_deck.push(deck[random_card]);
        deck.splice(random_card, 1);
    }
    return final_deck;
}

function deal_cards({player_controller, deck}) {
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
    const number_of_card_to_be_dealt = number_of_card_for[player_controller.number_of_players()] * player_controller.number_of_players();

    for (let i = 0; i < number_of_card_to_be_dealt; i++) {
        const player = player_controller.next_player();
        player.take_card({card: deck.pop()});
    }
}

module.exports = {initialize_game};
