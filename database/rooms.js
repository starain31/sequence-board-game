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

function get_player_controller({room}) {
    return room.player_controller;
}

function get_a_player({player_controller, handle}) {
    return player_controller.players.find(function (player) {
        return player.handle === handle;
    });
    throw 'PLAYER_DOES_NOT_BELONG_TO_THIS_ROOM'
}

module.exports = {create, get, join, get_player_controller, get_a_player};
