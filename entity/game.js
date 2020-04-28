function initialize_game({teams, total_number_of_player, total_number_of_team}) {
    const players = [];
    let team_index = 0;
    for(let i = 0; i < total_number_of_player; i++) {
        players.push({
            ...teams[team_index].players.pop(),
            team_handle: teams[team_index].handle
        });
        team_index = (team_index + 1)%total_number_of_team;
    }

    return {players};
}

module.exports = {initialize_game};