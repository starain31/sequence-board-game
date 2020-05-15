const rooms = [];

function create({administrator, id, number_of_team, number_of_player_in_each_team}) {
    rooms[id] = {
        administrator,
        id,
        teams: Array.from({length: Number(number_of_team)}, function (value, index) {
            return {
                handle: `TEAM_${index + 1}`,
                players: Array(Number(number_of_player_in_each_team)).fill(undefined)
            }
        }),
    };
}

function get({id}) {
    if(rooms[id] === undefined) {
        throw 'ROOM_DOES_NOT_EXIST'
    }
    return rooms[id];
}

function join({team_handle, id, player}) {
    if(rooms[id] === undefined) {
        throw 'ROOM_DOES_NOT_EXIST'
    }
    const team = rooms[id].teams.find(function (team) {
        return team.handle === team_handle;
    });
    const empty_slot = team.players.indexOf(undefined);

    if(empty_slot !== -1) {
        team.players[empty_slot] = player;
        return;
    }
    throw 'SEAT_TAKEN';
}

module.exports = {create, get, join};
