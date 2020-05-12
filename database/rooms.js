const rooms = [];

function create({administrator, id, number_of_team, number_of_player_in_each_team}) {
    rooms[id] = {
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

function join({team_handle, id, player}) {
    const team = rooms[id].teams.find(function (team) {
        return team.handle === team_handle;
    });
    console.log(team.players);
    const empty_slot = team.players.indexOf(undefined);

    if(empty_slot !== -1) {
        team.players[empty_slot] = player;
        return;
    }
    console.log({empty_slot});
    throw 'SEAT_TAKEN';
}


module.exports = {create, get, join};
