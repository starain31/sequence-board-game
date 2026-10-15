// The session module opens the database pool; presence only needs its secret.
jest.mock('../session', function () {
    return {session_secret: () => 'test secret'};
});
const presence = require('./presence');

describe('presence', function () {
    let changes;

    beforeEach(function () {
        jest.useFakeTimers();
        presence.reset();
        changes = [];
        presence.on_change(function (room_id, handle) {
            changes.push([room_id, handle, presence.is_present(room_id, handle)]);
        });
    });

    afterEach(function () {
        jest.useRealTimers();
    });

    test('a player is present while any of their sockets has the game open', function () {
        presence.arrive({room_id: 'otter-1', handle: 'alice', connection: 'a'});
        presence.arrive({room_id: 'otter-1', handle: 'alice', connection: 'b'});
        expect(presence.present('otter-1')).toEqual(['alice']);

        presence.depart({room_id: 'otter-1', handle: 'alice', connection: 'a'});
        expect(presence.is_present('otter-1', 'alice')).toBe(true);
        presence.depart({room_id: 'otter-1', handle: 'alice', connection: 'b'});
        expect(presence.is_present('otter-1', 'alice')).toBe(false);
        expect(changes).toEqual([['otter-1', 'alice', true], ['otter-1', 'alice', false]]);
    });

    test('tables are separate', function () {
        presence.arrive({room_id: 1, handle: 'alice', connection: 'a'});
        expect(presence.is_present('1', 'alice')).toBe(true);
        expect(presence.is_present('2', 'alice')).toBe(false);
    });

    test('a dropped socket that comes back within the grace period never counts as away', function () {
        presence.arrive({room_id: 'r', handle: 'bob', connection: 'a'});
        presence.depart({room_id: 'r', handle: 'bob', connection: 'a', grace_ms: 4000});
        jest.advanceTimersByTime(3000);
        presence.arrive({room_id: 'r', handle: 'bob', connection: 'a'});
        jest.advanceTimersByTime(5000);
        expect(presence.is_present('r', 'bob')).toBe(true);
        expect(changes).toEqual([['r', 'bob', true]]);
    });

    test('a dropped socket that stays away counts as away after the grace period', function () {
        presence.arrive({room_id: 'r', handle: 'bob', connection: 'a'});
        presence.depart({room_id: 'r', handle: 'bob', connection: 'a', grace_ms: 4000});
        expect(presence.is_present('r', 'bob')).toBe(true);
        jest.advanceTimersByTime(4000);
        expect(presence.is_present('r', 'bob')).toBe(false);
    });

    test('a token only proves the player and table it was made for', function () {
        const token = presence.token_for('r', 'alice');
        expect(presence.verify_token('r', 'alice', token)).toBe(true);
        expect(presence.verify_token('r', 'bob', token)).toBe(false);
        expect(presence.verify_token('s', 'alice', token)).toBe(false);
        expect(presence.verify_token('r', 'alice', 'nope')).toBe(false);
        expect(presence.verify_token('r', 'alice', undefined)).toBe(false);
    });
});
