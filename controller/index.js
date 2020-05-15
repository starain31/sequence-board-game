const inquirer = require("inquirer");
const socket_server = require('../socket');


const questions = [
    {
        type: 'input',
        name: 'hand_card_index',
        message: "What's your card?"
    },
    {
        type: 'input',
        name: 'row',
        message: "Which board row?"
    },
    {
        type: 'input',
        name: 'column',
        message: "Which board column?"
    }
];

function make_controller() {
    return {
        next_move: function () {
            // return new Promise(function (resolve) {
            //     socket.on('connection', function (socket) {
            //         socket.on('move', function (move) {
            //             resolve(move);
            //         });
            //     })
            // });
            return inquirer.prompt(questions).then(answers => {
                return answers;
            });
        },

        broadcast_board: function ({board}) {
            socket_server.broadcast({event: 'board_updated', data: {deck: board.get_deck()}});
        },

        log: function ({message}) {
            console.log(message);
        },
        error: function ({message}) {
            console.log(message.red);
        },
    };
}



module.exports = {make_controller};


