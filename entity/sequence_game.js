const board_deck = require('../data/board_deck.json');
const game_deck = require('../data/game_deck.json');

// Rules engine for a full game of Sequence. Every function takes a state and returns a new
// one, so a rejected move never leaves a half-applied state behind. The rules match the
// frontend's engine (sequence-board-game-frontend/src/engine), and so does the log format.

const BOARD_SIZE = 10;
const SEQUENCE_LENGTH = 5;
const BLANK = 'Blank';
const BOARD_LAYOUT = board_deck.map(function (row) {
    return row.map(function (cell) {
        return cell.name;
    });
});

/** Cards dealt to each player, keyed by total player count. Other totals are not playable. */
const HAND_SIZE_BY_PLAYER_COUNT = {2: 7, 3: 6, 4: 6, 6: 5, 8: 4, 9: 4, 10: 3, 12: 3};

const TWO_EYED_JACKS = ['J-Club', 'J-Diamond'];
const ONE_EYED_JACKS = ['J-Spade', 'J-Heart'];

const DIRECTIONS = [
    {row: 0, column: 1},
    {row: 1, column: 0},
    {row: 1, column: 1},
    {row: 1, column: -1},
];

class RuleError extends Error {
    constructor(code, message) {
        super(message);
        this.name = 'RuleError';
        this.code = code;
    }
}

function is_supported_table(team_count, players_per_team) {
    return (team_count === 2 || team_count === 3)
        && players_per_team >= 1 && players_per_team <= 6
        && HAND_SIZE_BY_PLAYER_COUNT[team_count * players_per_team] !== undefined;
}

function sequences_to_win(team_count) {
    return team_count === 2 ? 2 : 1;
}

function card_kind(card) {
    if (TWO_EYED_JACKS.includes(card)) return 'two-eyed-jack';
    if (ONE_EYED_JACKS.includes(card)) return 'one-eyed-jack';
    return 'normal';
}

function shuffle(items, random) {
    const result = items.slice();
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        const temp = result[i];
        result[i] = result[j];
        result[j] = temp;
    }
    return result;
}

function in_bounds(pos) {
    return pos.row >= 0 && pos.row < BOARD_SIZE && pos.column >= 0 && pos.column < BOARD_SIZE;
}

function is_corner(pos) {
    return BOARD_LAYOUT[pos.row][pos.column] === BLANK;
}

function pos_key(pos) {
    return `${pos.row},${pos.column}`;
}

function positions_of(card) {
    const positions = [];
    BOARD_LAYOUT.forEach(function (row, r) {
        row.forEach(function (name, c) {
            if (name === card) positions.push({row: r, column: c});
        });
    });
    return positions;
}

function empty_chip_grid() {
    return Array.from({length: BOARD_SIZE}, function () {
        return Array(BOARD_SIZE).fill(null);
    });
}

/**
 * @param {Array<{handle: string, players: Array<{handle: string, name: string}>}>} teams
 *        Full teams, in team order. Seats alternate teams: T1, T2, [T3,] T1, T2, …
 */
function create_game({teams, random = Math.random}) {
    const team_count = teams.length;
    const players_per_team = teams.length > 0 ? teams[0].players.length : 0;
    const evenly_divided = teams.every(function (team) {
        return team.players.length === players_per_team;
    });
    if (!evenly_divided || !is_supported_table(team_count, players_per_team)) {
        throw new RuleError('UNSUPPORTED_TABLE', `A game can't be dealt for ${team_count} teams of ${players_per_team}.`);
    }

    const players = [];
    for (let seat = 0; seat < team_count * players_per_team; seat++) {
        const team = seat % team_count;
        const player = teams[team].players[Math.floor(seat / team_count)];
        players.push({handle: player.handle, name: player.name, team});
    }

    const hand_size = HAND_SIZE_BY_PLAYER_COUNT[players.length];
    const deck = shuffle(game_deck.map(function (card) {
        return card.name;
    }), random);
    const hands = players.map(function () {
        return deck.splice(0, hand_size);
    });

    return {
        team_count,
        players,
        hands,
        chips: empty_chip_grid(),
        deck,
        discard: [],
        current: 0,
        turn: 1,
        exchanged_this_turn: false,
        sequences: [],
        winner: null,
        log: [],
    };
}

function current_player(state) {
    return state.players[state.current];
}

/** A dead card is a normal card whose two board cells are both covered. Jacks are never dead. */
function is_dead_card(state, card) {
    if (card_kind(card) !== 'normal') return false;
    return positions_of(card).every(function (p) {
        return state.chips[p.row][p.column] !== null;
    });
}

function is_locked(sequences, pos) {
    return sequences.some(function (s) {
        return s.cells.some(function (p) {
            return p.row === pos.row && p.column === pos.column;
        });
    });
}

/** Returns why `card` can't target `pos`, or null if it can. */
function target_problem(state, card, team, pos) {
    if (!in_bounds(pos)) return 'OUT_OF_BOUNDS';
    if (is_corner(pos)) return 'CORNER';
    const occupant = state.chips[pos.row][pos.column];
    switch (card_kind(card)) {
        case 'one-eyed-jack':
            if (occupant === null) return 'NOTHING_TO_REMOVE';
            if (occupant === team) return 'OWN_CHIP';
            return is_locked(state.sequences, pos) ? 'LOCKED_CHIP' : null;
        case 'two-eyed-jack':
            return occupant === null ? null : 'CELL_OCCUPIED';
        default:
            if (BOARD_LAYOUT[pos.row][pos.column] !== card) return 'CELL_MISMATCH';
            return occupant === null ? null : 'CELL_OCCUPIED';
    }
}

const TARGET_MESSAGES = {
    OUT_OF_BOUNDS: 'That cell is not on the board.',
    CORNER: 'Corners are free spaces for every team, so no chip can go there.',
    NOTHING_TO_REMOVE: "A one-eyed jack removes a chip, and this cell is empty. Pick an opponent's chip.",
    OWN_CHIP: "A one-eyed jack can't remove your own team's chip. Pick an opponent's chip.",
    LOCKED_CHIP: "That chip is part of a completed sequence and can't be removed. Pick another chip.",
    CELL_MISMATCH: 'That card can only go on a cell showing the same card.',
    CELL_OCCUPIED: 'That cell already has a chip. Pick an empty cell.',
};

function legal_targets(state, hand_index) {
    if (state.winner !== null) return [];
    const card = state.hands[state.current][hand_index];
    if (!card) return [];
    const team = current_player(state).team;
    const targets = [];
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let column = 0; column < BOARD_SIZE; column++) {
            if (target_problem(state, card, team, {row, column}) === null) targets.push({row, column});
        }
    }
    return targets;
}

function has_legal_play(state) {
    return state.hands[state.current].some(function (_, i) {
        return legal_targets(state, i).length > 0;
    });
}

function can_exchange(state) {
    return state.winner === null && !state.exchanged_this_turn && state.hands[state.current].some(function (card) {
        return is_dead_card(state, card);
    });
}

function can_pass(state) {
    return state.winner === null && !has_legal_play(state) && !can_exchange(state);
}

/**
 * Applies a move for the player with `handle`. Throws RuleError for illegal moves.
 * @param move {type: 'play', hand_index, target: {row, column}} | {type: 'exchange', hand_index} | {type: 'pass'}
 */
function apply_move(state, handle, move, random = Math.random) {
    if (state.winner !== null) throw new RuleError('GAME_OVER', 'The game is over.');
    if (current_player(state).handle !== handle) {
        throw new RuleError('NOT_YOUR_TURN', `It's ${current_player(state).name}'s turn.`);
    }
    switch (move.type) {
        case 'play':
            return play(state, move.hand_index, move.target, random);
        case 'exchange':
            return exchange(state, move.hand_index, random);
        case 'pass': {
            if (!can_pass(state)) {
                throw new RuleError('HAS_MOVES', 'You still have a card you can play, so you cannot pass.');
            }
            const {name, team} = current_player(state);
            return end_turn(Object.assign({}, state, {
                log: state.log.concat({kind: 'pass', turn: state.turn, player: name, team}),
            }));
        }
        default:
            throw new RuleError('UNKNOWN_MOVE', 'Unknown move.');
    }
}

function card_at(state, hand_index) {
    const card = Number.isInteger(hand_index) ? state.hands[state.current][hand_index] : undefined;
    if (!card) throw new RuleError('NO_SUCH_CARD', 'That card is not in your hand.');
    return card;
}

function play(state, hand_index, target, random) {
    const player = current_player(state);
    const card = card_at(state, hand_index);
    if (!target || !Number.isInteger(target.row) || !Number.isInteger(target.column)) {
        throw new RuleError('OUT_OF_BOUNDS', TARGET_MESSAGES.OUT_OF_BOUNDS);
    }
    const problem = target_problem(state, card, player.team, target);
    if (problem) throw new RuleError(problem, TARGET_MESSAGES[problem]);

    const pos = {row: target.row, column: target.column};
    const chips = state.chips.map(function (row) {
        return row.slice();
    });
    const log = state.log.slice();
    let sequences = state.sequences;
    let winner = null;

    if (card_kind(card) === 'one-eyed-jack') {
        const removed_team = chips[pos.row][pos.column];
        chips[pos.row][pos.column] = null;
        log.push({kind: 'remove', turn: state.turn, player: player.name, team: player.team, card, pos, removedTeam: removed_team});
    } else {
        chips[pos.row][pos.column] = player.team;
        log.push({kind: 'place', turn: state.turn, player: player.name, team: player.team, card, pos, wild: card_kind(card) === 'two-eyed-jack'});
        const found = find_new_sequences(chips, sequences, player.team, pos);
        if (found.length > 0) {
            sequences = sequences.concat(found);
            found.forEach(function (s) {
                log.push({kind: 'sequence', turn: state.turn, team: s.team, cells: s.cells});
            });
            const team_sequences = sequences.filter(function (s) {
                return s.team === player.team;
            }).length;
            if (team_sequences >= sequences_to_win(state.team_count)) {
                winner = player.team;
                log.push({kind: 'win', turn: state.turn, team: player.team});
            }
        }
    }

    const drawn = replace_card(Object.assign({}, state, {chips, sequences, log}), hand_index, random);
    return winner !== null ? Object.assign(drawn, {winner}) : end_turn(drawn);
}

function exchange(state, hand_index, random) {
    const card = card_at(state, hand_index);
    if (state.exchanged_this_turn) {
        throw new RuleError('ALREADY_EXCHANGED', 'You can exchange one dead card per turn. Play a card instead.');
    }
    if (!is_dead_card(state, card)) throw new RuleError('NOT_DEAD', "That card still has an open cell, so it isn't dead.");
    const player = current_player(state);
    const next = replace_card(state, hand_index, random);
    return Object.assign(next, {
        exchanged_this_turn: true,
        log: next.log.concat({kind: 'exchange', turn: state.turn, player: player.name, team: player.team, card}),
    });
}

/** Discards hand[hand_index] and draws into the same slot, reshuffling the discard pile if the deck is empty. */
function replace_card(state, hand_index, random) {
    const hand = state.hands[state.current].slice();
    const played = hand.splice(hand_index, 1)[0];
    let deck = state.deck;
    let discard = state.discard.concat(played);
    if (deck.length === 0) {
        deck = shuffle(discard, random);
        discard = [];
    }
    deck = deck.slice();
    const drawn = deck.shift();
    if (drawn) hand.splice(hand_index, 0, drawn);
    const hands = state.hands.map(function (h, i) {
        return i === state.current ? hand : h;
    });
    return Object.assign({}, state, {hands, deck, discard});
}

function end_turn(state) {
    return Object.assign({}, state, {
        current: (state.current + 1) % state.players.length,
        turn: state.turn + 1,
        exchanged_this_turn: false,
    });
}

/** Corners are free spaces that count for every team. */
function counts_for(chips, pos, team) {
    return is_corner(pos) || chips[pos.row][pos.column] === team;
}

function run_through(chips, origin, dir, team) {
    let start = origin;
    for (;;) {
        const prev = {row: start.row - dir.row, column: start.column - dir.column};
        if (!in_bounds(prev) || !counts_for(chips, prev, team)) break;
        start = prev;
    }
    const run = [];
    for (let p = start; in_bounds(p) && counts_for(chips, p, team); p = {row: p.row + dir.row, column: p.column + dir.column}) {
        run.push(p);
    }
    return run;
}

/**
 * New sequences completed by `team` placing a chip at `placed`. Each 5-long window through the
 * new chip counts if it shares at most one cell with the team's sequences so far, so a 9-long
 * line makes two sequences but a 6-long line makes one.
 */
function find_new_sequences(chips, existing, team, placed) {
    if (!counts_for(chips, placed, team)) return [];
    const claimed = new Set();
    existing.filter(function (s) {
        return s.team === team;
    }).forEach(function (s) {
        s.cells.forEach(function (p) {
            claimed.add(pos_key(p));
        });
    });
    const found = [];

    DIRECTIONS.forEach(function (dir) {
        const run = run_through(chips, placed, dir, team);
        if (run.length < SEQUENCE_LENGTH) return;
        const at = run.findIndex(function (p) {
            return p.row === placed.row && p.column === placed.column;
        });
        const first_start = Math.max(0, at - (SEQUENCE_LENGTH - 1));
        const last_start = Math.min(at, run.length - SEQUENCE_LENGTH);
        for (let start = first_start; start <= last_start; start++) {
            const cells = run.slice(start, start + SEQUENCE_LENGTH);
            const shared = cells.filter(function (p) {
                return claimed.has(pos_key(p));
            }).length;
            if (shared > 1) continue;
            found.push({team, cells});
            cells.forEach(function (p) {
                claimed.add(pos_key(p));
            });
        }
    });
    return found;
}

/** What one player may see: everything except other players' hands and the deck order. */
function view_for(state, handle) {
    const seat = state.players.findIndex(function (p) {
        return p.handle === handle;
    });
    const is_current = seat === state.current && state.winner === null;
    return {
        team_count: state.team_count,
        sequences_to_win: sequences_to_win(state.team_count),
        players: state.players.map(function (p, i) {
            return {handle: p.handle, name: p.name, team: p.team, hand_count: state.hands[i].length};
        }),
        current_player: state.winner === null ? current_player(state).handle : null,
        turn: state.turn,
        board: BOARD_LAYOUT.map(function (row, r) {
            return row.map(function (name, c) {
                return {name, team: state.chips[r][c]};
            });
        }),
        viewer: seat === -1 ? null : state.players[seat].handle,
        hand: seat === -1 ? [] : state.hands[seat],
        can_exchange: is_current && can_exchange(state),
        can_pass: is_current && can_pass(state),
        deck_count: state.deck.length,
        sequences: state.sequences,
        winner: state.winner,
        log: state.log,
    };
}

module.exports = {
    RuleError,
    create_game,
    apply_move,
    view_for,
    legal_targets,
    is_dead_card,
    is_supported_table,
    find_new_sequences,
    empty_chip_grid,
};
