const {UserError, validate_signup, hash_password, verify_password} = require('./user');

describe('validate_signup', function () {
    const valid = {handle: 'jabir', name: 'Jabir ibne kamal', password: 'correct horse'};

    function code_of(fields) {
        try {
            validate_signup(Object.assign({}, valid, fields));
        } catch (e) {
            return e instanceof UserError ? e.code : e;
        }
        return 'VALID';
    }

    test('normalises the handle and trims the name', function () {
        expect(validate_signup(Object.assign({}, valid, {handle: '  Jabir_01 ', name: '  Jabir  '})))
            .toEqual({handle: 'jabir_01', name: 'Jabir', password: 'correct horse'});
    });

    test('rejects handles that are too short, too long or have other characters', function () {
        expect(code_of({handle: 'ab'})).toBe('INVALID_HANDLE');
        expect(code_of({handle: 'a'.repeat(21)})).toBe('INVALID_HANDLE');
        expect(code_of({handle: 'jabir!'})).toBe('INVALID_HANDLE');
        expect(code_of({handle: undefined})).toBe('INVALID_HANDLE');
        expect(code_of({handle: 'a'.repeat(20)})).toBe('VALID');
    });

    test('requires a display name of at most 50 characters', function () {
        expect(code_of({name: '   '})).toBe('INVALID_NAME');
        expect(code_of({name: 'x'.repeat(51)})).toBe('INVALID_NAME');
        expect(code_of({name: 42})).toBe('INVALID_NAME');
    });

    test('requires a password of 8 to 200 characters', function () {
        expect(code_of({password: '1234567'})).toBe('WEAK_PASSWORD');
        expect(code_of({password: 'x'.repeat(201)})).toBe('WEAK_PASSWORD');
        expect(code_of({password: 12345678})).toBe('WEAK_PASSWORD');
        expect(code_of({password: '12345678'})).toBe('VALID');
    });
});

describe('password hashing', function () {
    test('verifies the right password and rejects others', async function () {
        const hash = await hash_password('correct horse');
        expect(hash).toMatch(/^scrypt\$32768\$8\$1\$/);
        expect(hash).not.toContain('correct horse');
        expect(await verify_password('correct horse', hash)).toBe(true);
        expect(await verify_password('Correct horse', hash)).toBe(false);
        expect(await verify_password(undefined, hash)).toBe(false);
    });

    test('salts every hash', async function () {
        expect(await hash_password('same')).not.toBe(await hash_password('same'));
    });

    test('checks old hashes with the cost they were made with', async function () {
        const cheap = await hash_password('pw', {N: 1024, r: 8, p: 1});
        expect(await verify_password('pw', cheap)).toBe(true);
    });

    test('rejects malformed stored hashes', async function () {
        expect(await verify_password('pw', 'plain-text')).toBe(false);
        expect(await verify_password('pw', null)).toBe(false);
    });
});
