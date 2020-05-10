const {initialize_game} = require('./game');

describe(`initialize game`, function () {
    it(`Should return correct order of sitting arrangement`, function () {
        const teams = [
            {
                handle: 'team_a',
                players: [
                    {
                        handle: 'jabir',
                        name: 'Jabir Ibne Kamal',
                    },
                    {
                        handle: 'habiba',
                        name: 'Habiba Binte Kamal',
                    },
                ]
            },
            {
                handle: 'team_b',
                players: [
                    {
                        handle: 'humaira',
                        name: 'Humaira Binte Kamal',
                    },
                    {
                        handle: 'sakib',
                        name: 'Sakib Ibne Kamal',
                    },
                ]
            }
        ];


        const {players} = initialize_game({teams: JSON.parse(JSON.stringify(teams))});
        const player_1 = players.next_player();
        const player_2 = players.next_player();
        const player_3 = players.next_player();
        const player_4 = players.next_player();

        expect(player_1.team_handle).toBe(player_3.team_handle);
        expect(player_2.team_handle).toBe(player_4.team_handle);
    });

    it(`Should throw error if invalid number of teams`, function () {
        const teams = [
            {
                handle: 'team_a',
                players: [
                    {
                        handle: 'jabir',
                        name: 'Jabir Ibne Kamal',
                    },
                    {
                        handle: 'habiba',
                        name: 'Habiba Binte Kamal',
                    },
                ]
            }
        ];

        expect(() => {initialize_game({teams: JSON.parse(JSON.stringify(teams))})}).toThrow('INVALID_NUMBER_OF_TEAM');
    });

    it(`Should throw error if invalid number of players`, function () {
        const teams = [
            {
                handle: 'team_a',
                players: [
                    {
                        handle: 'jabir',
                        name: 'Jabir Ibne Kamal',
                    },
                    {
                        handle: 'habiba',
                        name: 'Habiba Binte Kamal',
                    },
                    {
                        handle: 'jabir',
                        name: 'Jabir Ibne Kamal',
                    },
                    {
                        handle: 'habiba',
                        name: 'Habiba Binte Kamal',
                    },
                ]
            },
            {
                handle: 'team_a',
                players: [
                    {
                        handle: 'jabir',
                        name: 'Jabir Ibne Kamal',
                    },
                    {
                        handle: 'habiba',
                        name: 'Habiba Binte Kamal',
                    },
                ]
            }
        ];

        expect(() => {initialize_game({teams: JSON.parse(JSON.stringify(teams))})}).toThrow('INVALID_NUMBER_OF_PLAYER');
    });
});