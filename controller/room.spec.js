// HTTP tests for rooms and table games. Need PostgreSQL, see database/test_database.js.
const request = require('supertest');
const {has_database, use_test_schema} = require('../database/test_database');

const describe_with_database = has_database ? describe : describe.skip;

describe_with_database('rooms and table games', function () {
    let database;
    let app;
    const agents = {};

    async function sign_up(handle) {
        agents[handle] = request.agent(app);
        await agents[handle].post('/user/signup').send({handle, name: `Player ${handle}`, password: 'long enough'}).expect(201);
    }

    async function open_room(handle, teams = 2, players = 1) {
        const response = await agents[handle].post('/room/create')
            .send({number_of_team: teams, number_of_player_in_each_team: players}).expect(200);
        return response.body.id;
    }

    function join(handle, id, team_handle) {
        return agents[handle].post(`/room/${id}/join`).send({team_handle}).then(function (response) {
            return response.body.message;
        });
    }

    // A legal move for whoever's turn it is, found with the rules engine from the stored game.
    async function legal_play(id) {
        const {legal_targets} = require('../entity/sequence_game');
        const state = await require('../database/games').get({room_id: id});
        const player = state.players[state.current];
        for (let hand_index = 0; hand_index < state.hands[state.current].length; hand_index++) {
            const [target] = legal_targets(state, hand_index);
            if (target) return {handle: player.handle, body: {hand_index, row: target.row, column: target.column}};
        }
        throw new Error('no legal play in this deal');
    }

    beforeAll(async function () {
        database = await use_test_schema('room');
        app = require('../app');
        for (const handle of ['alice', 'bob', 'carol', 'dave']) await sign_up(handle);
    });

    afterAll(async function () {
        // The restart test loads a second copy of the app, with its own pool.
        const current = require('../database/pool').pool;
        if (current !== database.pool) await current.end();
        await database.drop();
    });

    describe('POST /room/create', function () {
        test('needs a signed-in user', async function () {
            const response = await request(app).post('/room/create').send({number_of_team: 2, number_of_player_in_each_team: 1});
            expect(response.status).toBe(401);
            expect(response.body.error).toBe('NOT_SIGNED_IN');
        });

        test('refuses table sizes the rules cannot deal for', async function () {
            for (const [teams, players] of [[4, 1], [2, 0], [3, 5], ['x', 1]]) {
                const response = await agents.alice.post('/room/create')
                    .send({number_of_team: teams, number_of_player_in_each_team: players});
                expect(response.status).toBe(400);
                expect(response.body.error).toBe('UNSUPPORTED_TABLE');
            }
        });

        test('stores the room with empty seats', async function () {
            const id = await open_room('alice', 3, 2);
            const room = (await request(app).get(`/room/${id}`)).body;
            expect(room).toMatchObject({id, administrator: 'alice', game_started: false});
            expect(room.teams).toEqual([
                {handle: 'TEAM_1', players: [null, null]},
                {handle: 'TEAM_2', players: [null, null]},
                {handle: 'TEAM_3', players: [null, null]},
            ]);
        });
    });

    describe('names, slugs and settings', function () {
        test('the code is a slug of the name, and settings default sensibly', async function () {
            const response = await agents.alice.post('/room/create')
                .send({number_of_team: 2, number_of_player_in_each_team: 1, name: '  Friday   Night Café '}).expect(200);
            expect(response.body.id).toMatch(/^friday-night-cafe-[a-z0-9]{4}$/);
            const room = (await request(app).get(`/room/${response.body.id}`)).body;
            expect(room.name).toBe('Friday Night Café');
            expect(room.settings).toEqual({mode: 'standard', history: true, highlights: true, auto_draw_dead: false});
        });

        test('a table without a name gets a generated one', async function () {
            const id = await open_room('alice');
            const room = (await request(app).get(`/room/${id}`)).body;
            expect(room.name).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
            expect(id.startsWith(room.name.toLowerCase().replace(' ', '-') + '-')).toBe(true);
        });

        test('two tables with the same name get different codes', async function () {
            const ids = await Promise.all([1, 2, 3].map(function () {
                return agents.alice.post('/room/create').send({number_of_team: 2, number_of_player_in_each_team: 1, name: 'Same'})
                    .then(function (response) {
                        return response.body.id;
                    });
            }));
            expect(new Set(ids).size).toBe(3);
        });

        test('settings chosen at creation are stored', async function () {
            const response = await agents.alice.post('/room/create').send({
                number_of_team: 2, number_of_player_in_each_team: 1, mode: 'training', history: false, highlights: 'false', auto_draw_dead: true,
            }).expect(200);
            const room = (await request(app).get(`/room/${response.body.id}`)).body;
            expect(room.settings).toEqual({mode: 'training', history: false, highlights: false, auto_draw_dead: true});
            const bad = await agents.alice.post('/room/create').send({number_of_team: 2, number_of_player_in_each_team: 1, mode: 'easy'});
            expect([bad.status, bad.body.error]).toEqual([400, 'INVALID_SETTINGS']);
        });

        test('refuses a bad name or setting', async function () {
            const base = {number_of_team: 2, number_of_player_in_each_team: 1};
            const long = await agents.alice.post('/room/create').send(Object.assign({name: 'x'.repeat(41)}, base));
            expect([long.status, long.body.error]).toEqual([400, 'INVALID_NAME']);
            const bad = await agents.alice.post('/room/create').send(Object.assign({history: 'maybe'}, base));
            expect([bad.status, bad.body.error]).toEqual([400, 'INVALID_SETTINGS']);
        });

        test('only the host changes settings, and only before the game starts', async function () {
            const id = await open_room('alice');
            const changed = await agents.alice.patch(`/room/${id}/settings`).send({name: 'Renamed', highlights: false});
            expect(changed.status).toBe(200);
            expect(changed.body).toMatchObject({id, name: 'Renamed', settings: {history: true, highlights: false, auto_draw_dead: false}});

            expect((await agents.bob.patch(`/room/${id}/settings`).send({history: false})).body.error).toBe('NOT_HOST');
            expect((await request(app).patch(`/room/${id}/settings`).send({history: false})).status).toBe(401);
            expect((await agents.alice.patch('/room/nope/settings').send({})).status).toBe(404);
            expect((await agents.alice.patch(`/room/${id}/settings`).send({history: 1})).body.error).toBe('INVALID_SETTINGS');

            await join('alice', id, 'TEAM_1');
            await join('bob', id, 'TEAM_2');
            await agents.alice.post(`/room/${id}/start`).expect(200);
            const late = await agents.alice.patch(`/room/${id}/settings`).send({history: false});
            expect([late.status, late.body.error]).toEqual([409, 'GAME_ALREADY_STARTED']);
        });
    });

    test('GET /room/:id of an unknown id is an empty 200, as before', async function () {
        const response = await request(app).get('/room/does-not-exist');
        expect(response.status).toBe(200);
        expect(response.text).toBe('');
    });

    describe('POST /room/:id/join', function () {
        test('seats players and reports every refusal', async function () {
            const id = await open_room('alice', 2, 1);
            expect(await join('alice', id, 'TEAM_1')).toBe('success');
            expect(await join('alice', id, 'TEAM_2')).toBe('ALREADY_SEATED');
            expect(await join('bob', id, 'TEAM_1')).toBe('SEAT_TAKEN');
            expect(await join('bob', id, 'TEAM_9')).toBe('TEAM_NOT_FOUND');
            expect(await join('bob', 'nope', 'TEAM_1')).toBe('ROOM_NOT_FOUND');
            expect((await request(app).post(`/room/${id}/join`).send({team_handle: 'TEAM_2'})).body.message).toBe('NOT_SIGNED_IN');

            const room = (await request(app).get(`/room/${id}`)).body;
            expect(room.teams[0].players).toEqual([{handle: 'alice', name: 'Player alice'}]);
        });

        test('gives a contested last seat to exactly one player', async function () {
            const id = await open_room('alice', 2, 1);
            await join('alice', id, 'TEAM_1');
            const results = await Promise.all(['bob', 'carol', 'dave'].map(function (handle) {
                return join(handle, id, 'TEAM_2');
            }));
            expect(results.sort()).toEqual(['SEAT_TAKEN', 'SEAT_TAKEN', 'success']);
        });
    });

    describe('table game', function () {
        test('starts a full table, then plays moves in turn', async function () {
            const id = await open_room('alice', 2, 1);
            await join('alice', id, 'TEAM_1');
            expect((await agents.alice.post(`/room/${id}/start`)).body.error).toBe('TABLE_NOT_FULL');
            await join('bob', id, 'TEAM_2');
            expect((await agents.carol.post(`/room/${id}/start`)).body.error).toBe('NOT_HOST');
            const seated_guest = await agents.bob.post(`/room/${id}/start`);
            expect([seated_guest.status, seated_guest.body.error]).toEqual([403, 'NOT_HOST']);
            expect(seated_guest.body.message).toMatch(/alice/);

            const started = await agents.alice.post(`/room/${id}/start`);
            expect(started.status).toBe(200);
            expect(started.body.hand).toHaveLength(7);
            expect((await agents.alice.post(`/room/${id}/start`)).body.error).toBe('GAME_ALREADY_STARTED');
            expect((await join('carol', id, 'TEAM_2'))).toBe('GAME_ALREADY_STARTED');
            expect((await request(app).get(`/room/${id}`)).body.game_started).toBe(true);

            const first = await legal_play(id);
            const other = first.handle === 'alice' ? 'bob' : 'alice';
            expect((await agents[other].post(`/room/${id}/game/play`).send(first.body)).body.error).toBe('NOT_YOUR_TURN');
            const played = await agents[first.handle].post(`/room/${id}/game/play`).send(first.body);
            expect(played.status).toBe(200);
            expect(played.body.turn).toBe(2);
            expect(played.body.current_player).toBe(other);
            expect(played.body.log[0]).toMatchObject({kind: 'place', pos: {row: first.body.row, column: first.body.column}});

            const {rows: turns} = await database.pool.query(
                `SELECT turns.move_number, turns.turn, users.handle, turns.kind, turns.card,
                        turns.cell_row, turns.cell_column, turns.events
                 FROM turns JOIN games ON games.id = turns.game_id JOIN users ON users.id = turns.user_id
                 WHERE games.room_id = $1`,
                [id]
            );
            expect(turns).toEqual([{
                move_number: 1, turn: 1, handle: first.handle, kind: 'play', card: expect.any(String),
                cell_row: first.body.row, cell_column: first.body.column, events: played.body.log,
            }]);
            expect(turns[0].events[0].card).toBe(turns[0].card);
        });

        test('lets only one of two simultaneous moves through', async function () {
            const id = await open_room('carol', 2, 1);
            await join('carol', id, 'TEAM_1');
            await join('dave', id, 'TEAM_2');
            await agents.carol.post(`/room/${id}/start`).expect(200);

            const move = await legal_play(id);
            const results = await Promise.all([1, 2].map(function () {
                return agents[move.handle].post(`/room/${id}/game/play`).send(move.body);
            }));
            expect(results.map(function (r) {
                return r.status;
            }).sort()).toEqual([200, 409]);
            const {rows} = await database.pool.query(
                'SELECT count(*) FROM turns JOIN games ON games.id = turns.game_id WHERE games.room_id = $1', [id]);
            expect(rows[0].count).toBe('1');
        });

        test('rooms and games survive a server restart, with their name and rules', async function () {
            const id = (await agents.bob.post('/room/create').send({
                number_of_team: 2, number_of_player_in_each_team: 1, name: 'Resume me', highlights: false, auto_draw_dead: true,
            }).expect(200)).body.id;
            await join('bob', id, 'TEAM_1');
            await join('dave', id, 'TEAM_2');
            await agents.bob.post(`/room/${id}/start`).expect(200);
            const move = await legal_play(id);
            await agents[move.handle].post(`/room/${id}/game/play`).send(move.body).expect(200);
            const before = (await agents.bob.get(`/room/${id}/game`)).body;

            // A fresh copy of every module: nothing can come from process memory.
            jest.resetModules();
            const restarted = require('../app');
            const cookie = (await request(restarted).post('/user/signin')
                .send({handle: 'bob', password: 'long enough'})).headers['set-cookie'][0].split(';')[0];
            const room = (await request(restarted).get(`/room/${id}`)).body;
            expect(room.teams[1].players[0].handle).toBe('dave');
            expect(room).toMatchObject({name: 'Resume me', game_started: true, settings: {highlights: false, auto_draw_dead: true}});
            expect((await request(restarted).get(`/room/${id}/game`).set('Cookie', cookie)).body).toEqual(before);
            const {rows: [stored]} = await database.pool.query('SELECT state FROM games WHERE room_id = $1', [id]);
            expect(stored.state.rules).toEqual({auto_draw_dead: true});
        });
    });

    test('a pass and an exchange are recorded without a cell', async function () {
        const id = await open_room('alice', 2, 1);
        await join('alice', id, 'TEAM_1');
        await join('bob', id, 'TEAM_2');
        await agents.alice.post(`/room/${id}/start`).expect(200);
        const db_game = require('../database/games');
        const {transaction} = require('../database/pool');
        const state = await db_game.get({room_id: id});
        const handle = state.players[state.current].handle;

        await transaction(async function (client) {
            const exchanged = Object.assign({}, state, {log: state.log.concat({kind: 'exchange', card: state.hands[state.current][0]})});
            await db_game.record_move({room_id: id, previous: state, next: exchanged, handle, move: {type: 'exchange', hand_index: 0}, client});
            const passed = Object.assign({}, exchanged, {log: exchanged.log.concat({kind: 'pass'})});
            await db_game.record_move({room_id: id, previous: exchanged, next: passed, handle, move: {type: 'pass'}, client});
        });
        const {rows: [unfinished]} = await database.pool.query('SELECT winner_team, finished_at FROM games WHERE room_id = $1', [id]);
        expect(unfinished).toEqual({winner_team: null, finished_at: null});

        await transaction(async function (client) {
            const previous = await db_game.get({room_id: id, client, lock: true});
            const won = Object.assign({}, previous, {winner: 1, log: previous.log.concat({kind: 'win', team: 1})});
            await db_game.record_move({room_id: id, previous, next: won, handle, move: {type: 'pass'}, client});
        });
        const {rows: [finished]} = await database.pool.query('SELECT winner_team, finished_at FROM games WHERE room_id = $1', [id]);
        expect(finished.winner_team).toBe(1);
        expect(finished.finished_at).toBeInstanceOf(Date);
        const {rows} = await database.pool.query(
            `SELECT move_number, kind, card, cell_row, events FROM turns JOIN games ON games.id = turns.game_id
             WHERE games.room_id = $1 AND move_number <= 2 ORDER BY move_number`, [id]);
        expect(rows).toEqual([
            {move_number: 1, kind: 'exchange', card: state.hands[state.current][0], cell_row: null, events: [{kind: 'exchange', card: state.hands[state.current][0]}]},
            {move_number: 2, kind: 'pass', card: null, cell_row: null, events: [{kind: 'pass'}]},
        ]);
    });

    describe('game modes', function () {
        async function started(mode) {
            const id = (await agents.alice.post('/room/create')
                .send({number_of_team: 2, number_of_player_in_each_team: 1, mode}).expect(200)).body.id;
            await join('alice', id, 'TEAM_1');
            await join('bob', id, 'TEAM_2');
            await agents.alice.post(`/room/${id}/start`).expect(200);
            return id;
        }

        test('a training game hints the player whose turn it is, and nobody else', async function () {
            const id = await started('training');
            const state = await require('../database/games').get({room_id: id});
            const current = state.players[state.current].handle;
            const waiting = current === 'alice' ? 'bob' : 'alice';

            const mine = (await agents[current].get(`/room/${id}/game`)).body;
            expect(mine.settings.mode).toBe('training');
            expect(mine.hint).toEqual(require('../entity/hints').suggest_move(state));
            expect(mine.hint.type).toMatch(/^(play|exchange|pass)$/);
            expect((await agents[waiting].get(`/room/${id}/game`)).body.hint).toBeNull();
            expect((await request(app).get(`/room/${id}/game`)).body.hint).toBeNull();

            // The hinted move is legal.
            if (mine.hint.type === 'play') {
                const body = {hand_index: mine.hint.hand_index, row: mine.hint.target.row, column: mine.hint.target.column};
                const played = await agents[current].post(`/room/${id}/game/play`).send(body);
                expect(played.status).toBe(200);
                expect(played.body.hint).toBeNull();
            }
        });

        test('a standard game never sends a hint', async function () {
            const id = await started('standard');
            for (const handle of ['alice', 'bob']) {
                expect((await agents[handle].get(`/room/${id}/game`)).body.hint).toBeNull();
            }
        });
    });

    describe('history', function () {
        test('GET /room/:id/turns lists the moves with their players, without hands', async function () {
            const id = await open_room('carol', 2, 1);
            await join('carol', id, 'TEAM_1');
            await join('bob', id, 'TEAM_2');
            expect((await request(app).get(`/room/${id}/turns`)).body.error).toBe('GAME_NOT_FOUND');
            await agents.carol.post(`/room/${id}/start`).expect(200);
            expect((await request(app).get(`/room/${id}/turns`)).body).toEqual([]);

            const first = await legal_play(id);
            await agents[first.handle].post(`/room/${id}/game/play`).send(first.body).expect(200);
            const second = await legal_play(id);
            await agents[second.handle].post(`/room/${id}/game/play`).send(second.body).expect(200);

            const turns = (await request(app).get(`/room/${id}/turns`)).body;
            expect(turns.map(function (t) {
                return [t.move_number, t.turn, t.player.handle, t.kind, t.cell];
            })).toEqual([
                [1, 1, first.handle, 'play', {row: first.body.row, column: first.body.column}],
                [2, 2, second.handle, 'play', {row: second.body.row, column: second.body.column}],
            ]);
            expect(turns[0].player.name).toBe(`Player ${first.handle}`);
            expect(JSON.stringify(turns)).not.toMatch(/"(hands?|deck|discard)"/);
            expect((await request(app).get('/room/nope/turns')).status).toBe(404);
        });

        test('a table without history hides its turns and keeps only the latest move in the game view', async function () {
            const response = await agents.carol.post('/room/create')
                .send({number_of_team: 2, number_of_player_in_each_team: 1, name: 'Quiet', history: false}).expect(200);
            const id = response.body.id;
            await join('carol', id, 'TEAM_1');
            await join('bob', id, 'TEAM_2');
            const started = await agents.carol.post(`/room/${id}/start`).expect(200);
            expect(started.body.name).toBe('Quiet');
            expect(started.body.settings).toEqual({mode: 'standard', history: false, highlights: true, auto_draw_dead: false});

            for (let i = 0; i < 3; i++) {
                const move = await legal_play(id);
                await agents[move.handle].post(`/room/${id}/game/play`).send(move.body).expect(200);
            }
            const game = (await agents.carol.get(`/room/${id}/game`)).body;
            expect(game.log.every(function (entry) {
                return entry.turn >= game.turn - 1;
            })).toBe(true);
            const turns = await request(app).get(`/room/${id}/turns`);
            expect([turns.status, turns.body.error]).toEqual([403, 'HISTORY_DISABLED']);
            // Still recorded, so "Your tables" can count the moves.
            const rooms = (await agents.carol.get('/user/rooms')).body;
            expect(rooms.find(function (r) {
                return r.id === id;
            })).toMatchObject({name: 'Quiet', move_count: 3, settings: {history: false}});
        });

        test('GET /user/rooms lists the tables a user created or sat at, newest first', async function () {
            await sign_up('erin');
            await sign_up('frank');
            const created_only = await open_room('erin', 2, 1);
            const played = await open_room('frank', 2, 1);
            await join('frank', played, 'TEAM_1');
            await join('erin', played, 'TEAM_2');
            await agents.frank.post(`/room/${played}/start`).expect(200);
            const move = await legal_play(played);
            await agents[move.handle].post(`/room/${played}/game/play`).send(move.body).expect(200);
            await open_room('frank', 2, 1); // not Erin's

            const rooms = (await agents.erin.get('/user/rooms')).body;
            expect(rooms.map(function (r) {
                return [r.id, r.administrator, r.your_team, r.seats_taken, r.status, r.move_count];
            })).toEqual([
                [played, 'frank', 1, 2, 'playing', 1],
                [created_only, 'erin', null, 0, 'open', 0],
            ]);
            expect(rooms[0].started_at).toEqual(expect.any(String));
            expect(rooms[0].finished_at).toBeNull();

            const response = await request(app).get('/user/rooms');
            expect(response.status).toBe(401);
        });
    });
});
