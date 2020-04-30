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

        expect(players[0].team_handle).toBe(players[2].team_handle);
        expect(players[1].team_handle).toBe(players[3].team_handle);
    });

    it(`Should return correct number of team and player`, function () {
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

        expect(players.length).toBe(4);
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