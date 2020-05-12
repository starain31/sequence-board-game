const inquirer = require('inquirer');
const io = require('socket.io')();

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

const controller = {
    next_move: function () {
        return inquirer.prompt(questions).then(answers => {
            return answers;
        });
    },
    broadcast_board: function ({board}) {
        console.log(board);
        io.emit('board', {deck: board.get_deck()});
    },
    log: function ({message}) {
        console.log(message);
    },
    error: function ({message}) {
        console.log(message.red);
    },
};


module.exports = {io};


