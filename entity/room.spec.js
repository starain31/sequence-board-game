const {
    RoomError,
    DEFAULT_SETTINGS,
    generate_name,
    normalize_name,
    slugify,
    generate_slug,
    is_slug,
    parse_settings,
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
        expect(DEFAULT_SETTINGS).toEqual({mode: 'standard', history: true, highlights: true, auto_draw_dead: false});
    });

    test('reads booleans and their string forms, and ignores unknown keys', function () {
        expect(parse_settings({history: 'false', highlights: false, auto_draw_dead: true, other: 1}))
            .toEqual({mode: 'standard', history: false, highlights: false, auto_draw_dead: true});
    });

    test('changes only the given keys of current settings', function () {
        const current = {mode: 'training', history: false, highlights: false, auto_draw_dead: true};
        expect(parse_settings({highlights: true}, current)).toEqual({mode: 'training', history: false, highlights: true, auto_draw_dead: true});
    });

    test('reads the game mode', function () {
        expect(parse_settings({mode: 'training'}).mode).toBe('training');
        for (const bad of ['TRAINING', 'hints', true]) {
            expect(function () {
                parse_settings({mode: bad});
            }).toThrow(expect.objectContaining({code: 'INVALID_SETTINGS'}));
        }
    });

    test('refuses values that are not booleans', function () {
        expect(function () {
            parse_settings({history: 'yes'});
        }).toThrow(expect.objectContaining({code: 'INVALID_SETTINGS'}));
    });
});
