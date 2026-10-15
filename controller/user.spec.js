// HTTP tests for the account endpoints. Need PostgreSQL, see database/test_database.js.
const request = require('supertest');
const {has_database, use_test_schema} = require('../database/test_database');

const describe_with_database = has_database ? describe : describe.skip;

describe_with_database('account endpoints', function () {
    let database;
    let app;

    beforeAll(async function () {
        database = await use_test_schema('user');
        app = require('../app');
        const {hash_password} = require('../entity/user');
        await database.pool.query(
            'INSERT INTO users (handle, name, password_hash) VALUES ($1, $2, $3)',
            ['jabir', 'Jabir ibne kamal', await hash_password('correct horse')]
        );
    });

    afterAll(async function () {
        await database.drop();
    });

    describe('POST /user/signin', function () {
        test('signs in with the right password and returns the profile', async function () {
            const agent = request.agent(app);
            const response = await agent.post('/user/signin').send({handle: 'jabir', password: 'correct horse'});
            expect(response.status).toBe(200);
            expect(response.body).toEqual({handle: 'jabir', name: 'Jabir ibne kamal'});
            expect(response.headers['set-cookie'][0]).toMatch(/HttpOnly; SameSite=Lax/);

            const profile = await agent.get('/user/profile');
            expect(profile.body).toEqual({handle: 'jabir', name: 'Jabir ibne kamal'});
        });

        test('accepts the handle in any case and with spaces', async function () {
            const response = await request(app).post('/user/signin').send({handle: ' JABIR ', password: 'correct horse'});
            expect(response.status).toBe(200);
        });

        test('rejects a wrong password and an unknown handle the same way', async function () {
            for (const body of [
                {handle: 'jabir', password: 'wrong'},
                {handle: 'nobody', password: 'correct horse'},
                {},
            ]) {
                const response = await request(app).post('/user/signin').send(body);
                expect(response.status).toBe(401);
                expect(response.body.error).toBe('INVALID_CREDENTIALS');
                expect(response.headers['set-cookie']).toBeUndefined();
            }
        });

        test('gives a new session id on sign-in', async function () {
            const agent = request.agent(app);
            const first = await agent.post('/user/signin').send({handle: 'jabir', password: 'correct horse'});
            const second = await agent.post('/user/signin').send({handle: 'jabir', password: 'correct horse'});
            expect(second.headers['set-cookie'][0].split(';')[0]).not.toBe(first.headers['set-cookie'][0].split(';')[0]);
        });
    });

    describe('GET /user/profile', function () {
        test('is 401 without a session instead of crashing', async function () {
            const response = await request(app).get('/user/profile');
            expect(response.status).toBe(401);
            expect(response.body.error).toBe('NOT_SIGNED_IN');
        });
    });

    describe('POST /user/signup', function () {
        test('creates the account, signs it in, and the password works afterwards', async function () {
            const agent = request.agent(app);
            const response = await agent.post('/user/signup')
                .send({handle: ' New_Player ', name: ' New Player ', password: 'long enough'});
            expect(response.status).toBe(201);
            expect(response.body).toEqual({handle: 'new_player', name: 'New Player'});
            expect((await agent.get('/user/profile')).body.handle).toBe('new_player');

            const signin = await request(app).post('/user/signin').send({handle: 'new_player', password: 'long enough'});
            expect(signin.status).toBe(200);

            const {rows} = await database.pool.query("SELECT password_hash FROM users WHERE handle = 'new_player'");
            expect(rows[0].password_hash).toMatch(/^scrypt\$/);
        });

        test('refuses a taken handle in any case', async function () {
            const response = await request(app).post('/user/signup')
                .send({handle: 'JABIR', name: 'Impostor', password: 'long enough'});
            expect(response.status).toBe(409);
            expect(response.body.error).toBe('HANDLE_TAKEN');
        });

        test('explains which field is invalid', async function () {
            const cases = [
                [{handle: 'a', name: 'A', password: 'long enough'}, 'INVALID_HANDLE'],
                [{handle: 'valid_one', name: '', password: 'long enough'}, 'INVALID_NAME'],
                [{handle: 'valid_one', name: 'Valid', password: 'short'}, 'WEAK_PASSWORD'],
            ];
            for (const [body, error] of cases) {
                const response = await request(app).post('/user/signup').send(body);
                expect(response.status).toBe(400);
                expect(response.body.error).toBe(error);
                expect(typeof response.body.message).toBe('string');
            }
            const {rows} = await database.pool.query("SELECT count(*) FROM users WHERE handle = 'valid_one'");
            expect(rows[0].count).toBe('0');
        });
    });

    describe('POST /user/signout', function () {
        test('ends the session on the server', async function () {
            const agent = request.agent(app);
            const signin = await agent.post('/user/signin').send({handle: 'jabir', password: 'correct horse'});
            const cookie = signin.headers['set-cookie'][0].split(';')[0];
            expect((await request(app).get('/user/profile').set('Cookie', cookie)).status).toBe(200);

            expect((await agent.post('/user/signout')).status).toBe(204);
            expect((await agent.get('/user/profile')).status).toBe(401);
            // A copy of the old cookie is useless too: the session row is gone.
            expect((await request(app).get('/user/profile').set('Cookie', cookie)).status).toBe(401);
        });

        test('is harmless without a session', async function () {
            expect((await request(app).post('/user/signout')).status).toBe(204);
        });
    });

    test('never sends a password hash', async function () {
        const response = await request(app).post('/user/signin').send({handle: 'jabir', password: 'correct horse'});
        expect(JSON.stringify(response.body)).not.toMatch(/scrypt|password/);
    });
});

describe_with_database('sign-in rate limit', function () {
    let database;
    let app;

    beforeAll(async function () {
        jest.resetModules();
        database = await use_test_schema('limit');
        app = require('../app');
    });

    afterAll(async function () {
        await database.drop();
    });

    test('blocks an address after 10 failed sign-ins', async function () {
        for (let attempt = 0; attempt < 10; attempt++) {
            expect((await request(app).post('/user/signin').send({handle: 'jabir', password: 'guess'})).status).toBe(401);
        }
        const blocked = await request(app).post('/user/signin').send({handle: 'jabir', password: 'guess'});
        expect(blocked.status).toBe(429);
        expect(blocked.body.error).toBe('TOO_MANY_ATTEMPTS');
    });
});
