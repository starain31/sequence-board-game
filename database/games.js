// Running games, keyed by room id. Kept apart from rooms so a room payload never carries hands.
// Same interface as a database table (an optional `client` and `lock` are accepted and ignored).
const games = {};

async function get({room_id}) {
    return games[room_id];
}

async function create({room_id, state}) {
    games[room_id] = state;
}

async function record_move({room_id, next}) {
    games[room_id] = next;
}

module.exports = {get, create, record_move};
