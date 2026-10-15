const {pool} = require('./pool');

// Rooms and their seats. Every function takes an optional `client`, so callers can run several of them in
// one transaction (see transaction() in pool.js).

function team_handle(index) {
    return `TEAM_${index + 1}`;
}

function team_index(handle, team_count) {
    const match = /^TEAM_(\d+)$/.exec(String(handle));
    const index = match ? Number(match[1]) - 1 : -1;
    return index >= 0 && index < team_count ? index : -1;
}

async function create({id, administrator_id, team_count, players_per_team, client = pool}) {
    await client.query(
        'INSERT INTO rooms (id, administrator_id, team_count, players_per_team) VALUES ($1, $2, $3, $4)',
        [id, administrator_id, team_count, players_per_team]
    );
}

// {id, administrator, team_count, players_per_team, created_at, teams: [{handle, players: [{handle, name} | null]}]}
// or undefined. `lock` holds the room row until the transaction ends, which serialises joins and starts.
async function get({id, client = pool, lock = false}) {
    const {rows} = await client.query(
        `SELECT rooms.id, users.handle AS administrator, rooms.team_count, rooms.players_per_team, rooms.created_at
         FROM rooms JOIN users ON users.id = rooms.administrator_id
         WHERE rooms.id = $1 ${lock ? 'FOR UPDATE OF rooms' : ''}`,
        [String(id)]
    );
    const room = rows[0];
    if (room === undefined) {
        return undefined;
    }
    const seats = await client.query(
        `SELECT room_seats.team, room_seats.seat, users.handle, users.name
         FROM room_seats JOIN users ON users.id = room_seats.user_id
         WHERE room_seats.room_id = $1`,
        [room.id]
    );
    room.teams = Array.from({length: room.team_count}, function (value, index) {
        return {handle: team_handle(index), players: Array(room.players_per_team).fill(null)};
    });
    seats.rows.forEach(function ({team, seat, handle, name}) {
        room.teams[team].players[seat] = {handle, name};
    });
    return room;
}

function is_seated(room, handle) {
    return room.teams.some(function (team) {
        return team.players.some(function (player) {
            return player !== null && player.handle === handle;
        });
    });
}

function is_full(room) {
    return room.teams.every(function (team) {
        return team.players.every(function (player) {
            return player !== null;
        });
    });
}

// Seats the user in the first free seat of the team. Call inside a transaction: it locks the room so two
// players can't take the same seat. Throws ROOM_NOT_FOUND, TEAM_NOT_FOUND, ALREADY_SEATED or SEAT_TAKEN.
async function join({id, team_handle: handle, user, client}) {
    const room = await get({id, client, lock: true});
    if (room === undefined) {
        throw 'ROOM_NOT_FOUND';
    }
    const team = team_index(handle, room.team_count);
    if (team === -1) {
        throw 'TEAM_NOT_FOUND';
    }
    if (is_seated(room, user.handle)) {
        throw 'ALREADY_SEATED';
    }
    const seat = room.teams[team].players.indexOf(null);
    if (seat === -1) {
        throw 'SEAT_TAKEN';
    }
    await client.query(
        'INSERT INTO room_seats (room_id, team, seat, user_id) VALUES ($1, $2, $3, $4)',
        [room.id, team, seat, user.id]
    );
}

module.exports = {create, get, is_seated, is_full, join};
