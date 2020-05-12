const {socket, broadcast} = require('../socket');

function make_controller() {
    return {
        next_move: function () {
            return new Promise(function (resolve) {
                socket.on('connection', function (socket) {
                    socket.on('move', function (move) {
                        resolve(move);
                    });
                })
            });
        },

        broadcast_board: function ({board}) {
            broadcast({event: 'board_updated', data: {deck: board.get_deck()}});
        },

        log: function ({message}) {
            console.log(message);
        },
        error: function ({message}) {
            console.log(message.red);
        },
    };
}



module.exports = {socket, make_controller};


