const {
    RoomError,
    DEFAULT_SETTINGS,
    TURN_TIMER_PRESETS,
    generate_name,
    normalize_name,
    slugify,
    generate_slug,
    is_slug,
    parse_settings,
    shuffle_seats,
} = require('./room');

function fixed(value) {
    return function () {
        return value;
    };
}

describe('room names', function () {
    test('trims and collapses spaces', function () {
        expect(normalize_name('  Friday   night ')).toBe('Friday night');
    });

    test('generates a name when none is given', function () {
        for (const blank of [undefined, null, '', '   ']) {
            expect(normalize_name(blank, fixed(0))).toBe('Amber Badger');
        }
        expect(generate_name(fixed(0.999))).toBe('Witty Zephyr');
    });

    test('refuses names that are too long or not text', function () {
        expect(function () {
            normalize_name('x'.repeat(41));
        }).toThrow(RoomError);
        expect(function () {
            normalize_name(42);
        }).toThrow(expect.objectContaining({code: 'INVALID_NAME'}));
    });
});

describe('slugs', function () {
    test('slugify keeps letters and digits, joined by single hyphens', function () {
        expect(slugify('Friday Night Café!')).toBe('friday-night-cafe');
        expect(slugify('  --Room #7--  ')).toBe('room-7');
        expect(slugify('🎲🎲')).toBe('');
        expect(slugify('a'.repeat(31) + ' b')).toBe('a'.repeat(31));
    });

    test('a generated slug is the name plus a 4-character suffix', function () {
        expect(generate_slug('Friday Night', fixed(0))).toBe('friday-night-0000');
        expect(generate_slug('🎲', fixed(0.5))).toBe('table-iiii');
        expect(is_slug(generate_slug('Anything at all'))).toBe(true);
    });

    test('is_slug accepts slugs and the older numeric codes', function () {
        expect(is_slug('lucky-otter-k3m9')).toBe(true);
        expect(is_slug('731791746123232')).toBe(true);
        for (const bad of ['', 'Upper', 'trailing-', '-leading', 'double--hyphen', 'sp ace', 42]) {
            expect(is_slug(bad)).toBe(false);
        }
    });
});

describe('settings', function () {
    test('missing keys keep the defaults', function () {
        expect(parse_settings({})).toEqual(DEFAULT_SETTINGS);
        expect(DEFAULT_SETTINGS).toEqual({
            mode: 'standard', history: false, highlights: false, auto_draw_dead: false, turn_seconds: 90,
            dead_cards: 'manual', exchanges_per_turn: null,
        });
    });

    test('reads booleans and their string forms, and ignores unknown keys', function () {
        expect(parse_settings({history: 'false', highlights: false, auto_draw_dead: true, other: 1}))
            .toEqual(Object.assign({}, DEFAULT_SETTINGS, {auto_draw_dead: true}));
    });

    test('changes only the given keys of current settings', function () {
        const current = {mode: 'training', history: false, highlights: false, auto_draw_dead: true, turn_seconds: 90};
        expect(parse_settings({highlights: true}, current)).toEqual({mode: 'training', history: false, highlights: true, auto_draw_dead: true, turn_seconds: 90});
    });

    test('reads the game mode', function () {
        expect(parse_settings({mode: 'training'}).mode).toBe('training');
        for (const bad of ['TRAINING', 'hints', true]) {
            expect(function () {
                parse_settings({mode: bad});
            }).toThrow(expect.objectContaining({code: 'INVALID_SETTINGS'}));
        }
    });

    test('reads the turn timer: 90 seconds by default, any whole number from 15 to 600', function () {
        expect(DEFAULT_SETTINGS.turn_seconds).toBe(90);
        expect(TURN_TIMER_PRESETS).toContain(90);
        expect(parse_settings({turn_seconds: 30}).turn_seconds).toBe(30);
        expect(parse_settings({turn_seconds: '45'}).turn_seconds).toBe(45);
        expect(parse_settings({turn_seconds: 600}).turn_seconds).toBe(600);
        for (const bad of [14, 601, 30.5, '', 'fast', null, true]) {
            expect(function () {
                parse_settings({turn_seconds: bad});
            }).toThrow(expect.objectContaining({code: 'INVALID_SETTINGS'}));
        }
    });

    test('reads how dead cards are found: by hand (the default) or marked', function () {
        expect(DEFAULT_SETTINGS.dead_cards).toBe('manual');
        expect(parse_settings({dead_cards: 'indicator'}).dead_cards).toBe('indicator');
        for (const bad of ['auto', true, null]) {
            expect(function () {
                parse_settings({dead_cards: bad});
            }).toThrow(expect.objectContaining({code: 'INVALID_SETTINGS'}));
        }
    });

    test('reads dead card exchanges per turn: unlimited by default, or 1 to 10', function () {
        expect(DEFAULT_SETTINGS.exchanges_per_turn).toBe(null);
        expect(parse_settings({exchanges_per_turn: 1}).exchanges_per_turn).toBe(1);
        expect(parse_settings({exchanges_per_turn: '3'}).exchanges_per_turn).toBe(3);
        expect(parse_settings({exchanges_per_turn: 'unlimited'}, Object.assign({}, DEFAULT_SETTINGS, {exchanges_per_turn: 2})).exchanges_per_turn).toBe(null);
        expect(parse_settings({exchanges_per_turn: null}).exchanges_per_turn).toBe(null);
        for (const bad of [0, 11, 1.5, '', 'many', true]) {
            expect(function () {
                parse_settings({exchanges_per_turn: bad});
            }).toThrow(expect.objectContaining({code: 'INVALID_SETTINGS'}));
        }
    });

    test('refuses values that are not booleans', function () {
        expect(function () {
            parse_settings({history: 'yes'});
        }).toThrow(expect.objectContaining({code: 'INVALID_SETTINGS'}));
    });
});

describe('shuffle_seats', function () {
    test('deals players out so teams stay even', function () {
        const seats = shuffle_seats(['a', 'b', 'c'], 3, 2, fixed(0));
        expect(seats.map(function (s) {
            return [s.team, s.seat];
        })).toEqual([[0, 0], [1, 0], [2, 0]]);
        expect(seats.map(function (s) {
            return s.player;
        }).sort()).toEqual(['a', 'b', 'c']);
    });

    test('fills every seat of a full table exactly once', function () {
        const seats = shuffle_seats(['a', 'b', 'c', 'd'], 2, 2);
        expect(new Set(seats.map(function (s) {
            return `${s.team}-${s.seat}`;
        })).size).toBe(4);
    });
});
