const socket_io = require('socket.io');

const socket = socket_io({
    serveClient: true,
});

socket.on('connection', function (soc) {
});

socket.on('disconnect', function () {
});

function broadcast({event, data}) {
    socket.emit(event, data);
}


module.exports = {socket, broadcast};
