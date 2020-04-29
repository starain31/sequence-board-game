function initialize_game({teams}) {

    const {total_number_of_team, total_number_of_player} = number_of_player_and_team({teams});

    const players = [];
    let team_index = 0;
    for (let i = 0; i < total_number_of_player; i++) {
        players.push({
            ...teams[team_index].players.pop(),
            team_handle: teams[team_index].handle
        });
        team_index = (team_index + 1) % total_number_of_team;
    }

    return {players};
}

function number_of_player_and_team({teams}) {
    const total_number_of_team = get_total_number_of_team(teams);
    const total_number_of_player = get_total_number_of_player(teams);

    return {total_number_of_player, total_number_of_team};
}

function get_total_number_of_team(teams) {
    if (is_valid_numbered_of_team(teams.length)) {
        return teams.length;
    }
    throw 'INVALID_NUMBER_OF_TEAM';
}

function is_valid_numbered_of_team(total_number_of_team) {
    return (total_number_of_team === 2) || (total_number_of_team === 3);
}


function get_total_number_of_player(teams) {
    const number_of_players_in_each_team = teams[0].players.length;
    if (is_players_divided_evenly(teams) && (1 <= number_of_players_in_each_team && number_of_players_in_each_team <= 6)) {
        return number_of_players_in_each_team * teams.length;
    }
    throw 'INVALID_NUMBER_OF_PLAYER'
}

function is_players_divided_evenly(teams) {
    return teams.every(function (team) {
        return team.players.length === teams[0].players.length;
    });
}


module.exports = {initialize_game};