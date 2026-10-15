// Running games, keyed by room id. Kept apart from rooms so a room payload never carries hands.
const games = {};

function get({room_id}) {
    return games[room_id];
}

function save({room_id, game}) {
    games[room_id] = game;
}

module.exports = {get, save};
