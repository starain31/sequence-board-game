const socket_io = require('socket.io');

const socket = socket_io({
    serveClient: true,
});

function broadcast({event, data}) {
    socket.emit(event, data);
}


module.exports = {socket, broadcast};
