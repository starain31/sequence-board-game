const {initialize_game} = require("../entity/game");

require('colors');

async function start({teams, controller}) {
    console.log(`Game started....`);

    const {board} = initialize_game({teams: JSON.parse(JSON.stringify(teams))});
    while (true) {
        try {
            console.log(board.pretty_deck());
            const move = await controller.next_move();
            if (move === undefined) {
                break;
            }
            const {hand_card, row, column} = move;
            console.log({hand_card: move.hand_card.name, board_card: board.get_deck()[row][column], row, column});

            let team_name = 'lal_dol';
            board.play({index: {row, column}, team_name, hand_card});
        } catch (e) {
            console.error(e.red);
        }
    }
    console.log("Game over");
}

module.exports = {start};