const {initialize_game} = require("../entity/game");

require('colors');

async function start({teams, controller}) {

    //const {players, board, deck} = initialize_game({teams: JSON.parse(JSON.stringify(teams))});

    let player = players.next_player();

    while (true) {
        try {
            console.log({board});
            controller.broadcast_board({board});
            controller.log({message: player});

            const move = await controller.next_move();
            if (move === undefined) {
                break;
            }
            const {hand_card_index, row, column} = move;
            controller.log({message: {hand_card: player.cards[hand_card_index].name, board_card: board.get_deck()[row][column], row, column}});

            board.play({index: {row, column}, team_name: player.team_handle, hand_card: player.give_card({index: hand_card_index})});
            player.take_card({index: hand_card_index, card: deck.pop()});

            player = players.next_player();
        } catch (e) {
            controller.error({message: e});
        }
    }
    controller.broadcast_board({board});
    controller.log({message: 'Game over'.yellow});
}

module.exports = {start};
