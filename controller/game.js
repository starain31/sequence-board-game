const board_deck = require("./board").deck;
const deck = shuffled_deck();
const players = {
    'jabir': {
        name: 'Jabir Ibne Kamal',
        team_name: 'team1',
        cards_in_hand: []
    },
    'sakib': {
        name: 'Sakib Ibne Kamal',
        team_name: 'team1',
        cards_in_hand: []
    },
    'habiba': {
        name: 'Habiba Binte Kamal',
        team_name: 'team2',
        cards_in_hand: []
    },
    'humaira': {
        name: 'Humaira Binte Kamal',
        team_name: 'team2',
        cards_in_hand: []
    }
};
const number_of_card_per_player = 5;

deal_cards({players, deck, number_of_card_per_player});

function shuffled_deck() {
    /**
     *
     * @type {Array}
     */
    const temp_deck = require('../data/game_deck.json');
    const final_deck = [];
    while(temp_deck.length !== 0) {
        const random_card = Math.floor(Math.random() * temp_deck.length);
        final_deck.push(temp_deck[random_card]);
        temp_deck.splice(random_card, 1);
    }
    return final_deck;
}

function deal_cards({players, deck, number_of_card_per_player}) {
    for (let i = 0; i < number_of_card_per_player; i++) {
        for (const player_handler in players) {
            if(players.hasOwnProperty(player_handler)) {
                players[player_handler].cards_in_hand.push(deck.pop());
            }
        }
    }
}

function get_hand_cards(req, res) {
    res.send({cards_in_hand: players[req.query.player_handler].cards_in_hand});
}

function play_card(req, res, next) {
    try {
        const player = players[req.query.player_handler];
        const board_card_index = JSON.parse(req.query.board_card_index);
        const board_card_row_index = Number(board_card_index.row);
        const board_card_column_index = Number(board_card_index.column);
        const hand_card_index = Number(req.query.hand_card_index);

        const selected_board_card = board_deck[board_card_row_index][board_card_column_index];
        const selected_hand_card = player.cards_in_hand[hand_card_index];

        if (is_valid_move(selected_board_card, selected_hand_card, player.team_name)) {
            if(is_one_eyed(selected_hand_card.name)) {
                selected_board_card.occupied_by = undefined;
            } else {
                // noinspection JSUnresolvedVariable
                selected_board_card.occupied_by = current_team;
            }
            // noinspection JSUndeclaredVariable,JSUnresolvedVariable,JSUnresolvedFunction
            current_team = alternate_team(current_team);
            res.send({verdict: 'Valid', current_team});
        } else {
            console.log('Invalid Move');
            res.status(404).send('Invalid Move');
        }
    } catch (e) {
        next(e);
    }
}

function is_valid_move(selected_board_card, selected_hand_card) {
    if (selected_hand_card.name[0] !== 'J') {
        return (selected_board_card.name === selected_hand_card.name)
            && (selected_board_card.occupied_by === undefined);
    } else if (is_two_eyed(selected_hand_card.name)) {
        return selected_board_card.occupied_by === undefined;
    }
    // noinspection JSUnresolvedVariable
    return selected_board_card.occupied_by !== undefined &&
        selected_board_card.occupied_by !== current_team;
}

function is_one_eyed(card_name) {
    return card_name === 'J-Spade' || card_name === 'J-Heart';
}

function is_two_eyed(card_name) {
    return card_name === 'J-Club' || card_name === 'J-Diamond';
}

module.exports = {get_hand_cards, play_card};
