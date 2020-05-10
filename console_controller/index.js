const {start} = require('../use_case/game');

const fs = require('fs');

const inputs = fs.createReadStream('./console_controller/input.txt', {encoding: 'utf-8'});

const teams = [
    {
        handle: 'lal_dol',
        players: [
            {
                handle: 'jabir',
                name: 'Jabir Ibne Kamal',
            },
            {
                handle: 'habiba',
                name: 'Habiba Binte Kamal',
            },
        ]
    },
    {
        handle: 'nil_dol',
        players: [
            {
                handle: 'humaira',
                name: 'Humaira Binte Kamal',
            },
            {
                handle: 'sakib',
                name: 'Sakib Ibne Kamal',
            },
        ]
    }
];

inputs.on('data', function (raw_data) {
    const moves = raw_data
        .split('\n')
        .map(function (move) {
            const [hand_card_index, row, column] = move.split(' ');
            return {
                hand_card_index,
                row,
                column
            };
        });
    let i = -1;

    console.log(moves);
    const controller = {
        next_move: function () {
            i += 1;
            return moves[i];
        },
        broadcast_board: function ({board}) {
            console.log(board.pretty_deck());
        },
        log: function ({message}) {
            console.log(message);
        },
        error: function ({message}) {
            console.log(message.red);
        },
    };

    inputs.on('close', function () {
        start({teams, controller});
    });
});