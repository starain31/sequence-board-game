const rooms = {};

function create({administrator, id, number_of_team, number_of_player_in_each_team}) {
    rooms[id] = {
        id,
        administrator,
        teams: Array.from({length: Number(number_of_team)}, function (value, index) {
            return {
                handle: `TEAM_${index + 1}`,
                players: Array.from({length: Number(number_of_player_in_each_team)}).fill(undefined)
            }
        }),
    };
}

function get({id}) {
    return rooms[id];
}

function is_seated({id, handle}) {
    return rooms[id].teams.some(function (team) {
        return team.players.some(function (player) {
            return player !== undefined && player.handle === handle;
        });
    });
}

function join({team_handle, id, player}) {
    if (rooms[id] === undefined) {
        throw 'ROOM_NOT_FOUND';
    }
    const team = rooms[id].teams.find(function (team) {
        return team.handle === team_handle;
    });
    if (team === undefined) {
        throw 'TEAM_NOT_FOUND';
    }
    if (is_seated({id, handle: player.handle})) {
        throw 'ALREADY_SEATED';
    }
    const empty_slot = team.players.indexOf(undefined);

    if(empty_slot !== -1) {
        // Only what other players need to see; never the user's password.
        team.players[empty_slot] = {handle: player.handle, name: player.name};
        return;
    }
    throw 'SEAT_TAKEN';
}


module.exports = {create, get, is_seated, join};
