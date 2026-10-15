// Rules for a room (a table people sit at): its name, the slug that is its code, and its settings.
// Pure functions, so they can be tested without a database.

const NAME_MAX_LENGTH = 40;
const SLUG_BASE_MAX_LENGTH = 32;
const SLUG_SUFFIX_LENGTH = 4;
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const ADJECTIVES = ['amber', 'brave', 'calm', 'clever', 'cosmic', 'golden', 'jolly', 'lucky', 'mellow', 'nimble', 'quiet', 'rapid', 'royal', 'swift', 'velvet', 'witty'];
const NOUNS = ['badger', 'comet', 'falcon', 'harbor', 'lantern', 'maple', 'meadow', 'otter', 'pebble', 'raven', 'river', 'summit', 'thistle', 'tiger', 'willow', 'zephyr'];

/**
 * How a game is played. `training` is for learning: the player whose turn it is gets hints (a suggested move and
 * why). `standard` games never get hints.
 */
const GAME_MODES = Object.freeze(['standard', 'training']);

/** Turn timer choices offered to hosts, in seconds. Any whole number of seconds in the allowed range also works. */
const TURN_TIMER_PRESETS = Object.freeze([30, 60, 90, 120, 180]);
const TURN_SECONDS_MIN = 15;
const TURN_SECONDS_MAX = 600;

/** What a room does when its creator doesn't say otherwise. */
const DEFAULT_SETTINGS = Object.freeze({
    mode: 'standard',
    // Players can read every move so far (the move log and GET /room/:id/turns). Off unless the host turns it on.
    history: false,
    // Legal cells light up when a card is picked. Off unless the host turns it on.
    highlights: false,
    // A dead card is exchanged automatically at the start of its owner's turn.
    auto_draw_dead: false,
    // How long each player has for a turn.
    turn_seconds: 90,
});

class RoomError extends Error {
    constructor(code, message) {
        super(message);
        this.name = 'RoomError';
        this.code = code;
    }
}

function pick(list, random) {
    return list[Math.floor(random() * list.length)];
}

function capitalise(word) {
    return word.charAt(0).toUpperCase() + word.slice(1);
}

/** A friendly name such as "Lucky Otter", for rooms created without one. */
function generate_name(random = Math.random) {
    return `${capitalise(pick(ADJECTIVES, random))} ${capitalise(pick(NOUNS, random))}`;
}

/** Trims and collapses spaces. Undefined, null or blank gives a generated name. Throws INVALID_NAME. */
function normalize_name(name, random = Math.random) {
    if (name === undefined || name === null || String(name).trim() === '') {
        return generate_name(random);
    }
    if (typeof name !== 'string') {
        throw new RoomError('INVALID_NAME', 'A table name must be text.');
    }
    const normalized = name.trim().replace(/\s+/g, ' ');
    if (normalized.length > NAME_MAX_LENGTH) {
        throw new RoomError('INVALID_NAME', `A table name can be at most ${NAME_MAX_LENGTH} characters.`);
    }
    return normalized;
}

/** "Friday Night Café!" → "friday-night-cafe". Empty when nothing usable is left. */
function slugify(text) {
    return String(text)
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, SLUG_BASE_MAX_LENGTH)
        .replace(/-+$/, '');
}

/**
 * The room's code: the slug of its name plus a short random suffix, so two "Friday Night" tables get
 * different codes, e.g. "friday-night-k3m9".
 */
function generate_slug(name, random = Math.random) {
    const base = slugify(name) || 'table';
    let suffix = '';
    for (let i = 0; i < SLUG_SUFFIX_LENGTH; i++) {
        suffix += Math.floor(random() * 36).toString(36);
    }
    return `${base}-${suffix}`;
}

/** Room codes are slugs. Older rooms have numeric codes, which are slugs too. */
function is_slug(text) {
    return typeof text === 'string' && SLUG_PATTERN.test(text);
}

/**
 * Deals seated players out to seats at random, keeping teams as even as possible: seats are filled seat 0 of
 * every team, then seat 1 of every team, and so on. Returns [{team, seat, player}].
 */
function shuffle_seats(players, team_count, players_per_team, random = Math.random) {
    const shuffled = players.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        const temp = shuffled[i];
        shuffled[i] = shuffled[j];
        shuffled[j] = temp;
    }
    const seats = [];
    for (let seat = 0; seat < players_per_team; seat++) {
        for (let team = 0; team < team_count; team++) seats.push({team, seat});
    }
    return shuffled.slice(0, seats.length).map(function (player, i) {
        return Object.assign({player}, seats[i]);
    });
}

function parse_mode(value) {
    if (GAME_MODES.includes(value)) return value;
    throw new RoomError('INVALID_SETTINGS', `The setting "mode" must be one of: ${GAME_MODES.join(', ')}.`);
}

function parse_turn_seconds(value) {
    const seconds = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
    if (Number.isInteger(seconds) && seconds >= TURN_SECONDS_MIN && seconds <= TURN_SECONDS_MAX) return seconds;
    throw new RoomError(
        'INVALID_SETTINGS',
        `The turn timer must be a whole number of seconds from ${TURN_SECONDS_MIN} to ${TURN_SECONDS_MAX}.`
    );
}

const PARSERS = {
    mode: parse_mode,
    turn_seconds: parse_turn_seconds,
};

function parse_flag(value, key) {
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    throw new RoomError('INVALID_SETTINGS', `The setting "${key}" must be true or false.`);
}

/**
 * Reads settings from a request body. Only keys in DEFAULT_SETTINGS are read; a missing key keeps the value
 * from `current` (the defaults for a new room). Throws INVALID_SETTINGS for an unknown mode, a turn timer out of
 * range, or a flag that isn't a boolean.
 */
function parse_settings(body = {}, current = DEFAULT_SETTINGS) {
    const settings = Object.assign({}, current);
    Object.keys(DEFAULT_SETTINGS).forEach(function (key) {
        if (body[key] !== undefined) settings[key] = PARSERS[key] ? PARSERS[key](body[key]) : parse_flag(body[key], key);
    });
    return settings;
}

module.exports = {
    RoomError,
    DEFAULT_SETTINGS,
    GAME_MODES,
    TURN_TIMER_PRESETS,
    TURN_SECONDS_MIN,
    TURN_SECONDS_MAX,
    NAME_MAX_LENGTH,
    generate_name,
    normalize_name,
    slugify,
    generate_slug,
    is_slug,
    parse_settings,
    shuffle_seats,
};
