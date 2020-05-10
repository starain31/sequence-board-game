const {start} = require('../use_case/game');

const io = require('socket.io')();

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

const controller = {
    next_move: function () {
        return inquirer.prompt(questions).then(answers => {
            return answers;
        });
    },
    broadcast_board: function ({board}) {
        socket.emit('chat message', 'hi!');
    },
    log: function ({message}) {
        console.log(message);
    },
    error: function ({message}) {
        console.log(message.red);
    },
};

start({controller, teams});
