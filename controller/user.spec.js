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

    test('never sends a password hash', async function () {
        const response = await request(app).post('/user/signin').send({handle: 'jabir', password: 'correct horse'});
        expect(JSON.stringify(response.body)).not.toMatch(/scrypt|password/);
    });
});
