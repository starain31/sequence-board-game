const db_room = require('../database/rooms');
const socket_server = require('../socket');

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
    while (temp_deck.length !== 0) {
        const random_card = Math.floor(Math.random() * temp_deck.length);
        final_deck.push(temp_deck[random_card]);
        temp_deck.splice(random_card, 1);
    }
    return final_deck;
}

function deal_cards({players, deck, number_of_card_per_player}) {
    for (let i = 0; i < number_of_card_per_player; i++) {
        for (const player_handler in players) {
            if (players.hasOwnProperty(player_handler)) {
                players[player_handler].cards_in_hand.push(deck.pop());
            }
        }
    }
}

function get_hand_cards(req, res) {
    const {handle, room_id} = req.session;
    const room = db_room.get({id: room_id});
    const player_controller = db_room.get_player_controller({room});
    const player = db_room.get_a_player({player_controller, handle});

    res.send({cards_in_hand: player.cards});
}

function play_card(req, res) {
    const board_card_index = JSON.parse(req.query.board_card_index);
    const row = Number(board_card_index.row);
    const column = Number(board_card_index.column);
    const hand_card_index = Number(req.query.hand_card_index);

    const {room_id, handle} = req.session;

    const room = db_room.get({id: room_id});
    const player_controller = db_room.get_player_controller({room});
    const player = player_controller.next_player();

    try {
        if (player.handle !== handle) {
            throw 'NOT_YOUR_TURN';
        }
        room.board.play({
            index: {row, column},
            team_name: player.team_handle,
            hand_card: player.give_card({index: hand_card_index})
        });
        player.take_card({index: hand_card_index, card: deck.pop()});
        socket_server.broadcast({event: 'board_updated', data: room.board.get_deck()});
        res.send({cards: player.cards});

    } catch (e) {
        player_controller.previous_player();
        res.status(400).send(e);
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
