const socket_io = require('socket.io');
const presence = require('./controller/presence');

const socket = socket_io({
    serveClient: true,
});

function broadcast({event, data}) {
    socket.emit(event, data);
}

// A game page says it is open with `join_game {room_id, handle, token}` (the token comes from that player's game
// view) and closed with `leave_game {room_id}`. A socket that drops counts as having left after a short grace period.
socket.on('connection', function (connection) {
    const joined = new Map();

    connection.on('join_game', function (data) {
        const {room_id, handle, token} = data || {};
        if (typeof room_id !== 'string' || !presence.verify_token(room_id, handle, token)) return;
        joined.set(room_id, handle);
        presence.arrive({room_id, handle, connection: connection.id});
    });

    connection.on('leave_game', function (data) {
        const room_id = data && data.room_id;
        if (!joined.has(room_id)) return;
        presence.depart({room_id, handle: joined.get(room_id), connection: connection.id});
        joined.delete(room_id);
    });

    connection.on('disconnect', function () {
        joined.forEach(function (handle, room_id) {
            presence.depart({room_id, handle, connection: connection.id, grace_ms: presence.DISCONNECT_GRACE_MS});
        });
        joined.clear();
    });
});

module.exports = {socket, broadcast};
