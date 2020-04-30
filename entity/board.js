const board_deck = require('../data/board_deck.json');

function New_board() {
    const deck = JSON.parse(JSON.stringify(board_deck));

    return {
        pretty_deck: function() {
            return deck.map(function (row) {
                return row.map(function (column) {
                    return (column.occupied_by === undefined? column.name : column.occupied_by).padEnd(12, ' ');
                }).join('')
            }).join('\n\n');
        },
        get_deck: function () {
            return deck;
        },
        play: function ({index, team_name, hand_card}) {
            const board_card = deck[index.row][index.column];
            if(!is_valid_move({board_card, hand_card, team_name})) {
                throw 'INVALID_MOVE';
            }
            board_card.occupied_by = team_name;
        }
    }
}

function is_valid_move({board_card, hand_card, team_name}) {
    if(board_card.name === 'Blank') {
        return false;
    }
    else if (hand_card.name[0] !== 'J') {
        return (board_card.name === hand_card.name)
            && (board_card.occupied_by === undefined);
    } else if (is_two_eyed(hand_card.name)) {
        return board_card.occupied_by === undefined;
    }
    return board_card.occupied_by !== undefined &&
        board_card.occupied_by !== team_name;
}

function is_two_eyed(card_name) {
    return card_name === 'J-Club' || card_name === 'J-Diamond';
}

module.exports = {New_board};
