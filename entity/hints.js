const {
    DIRECTIONS,
    card_kind,
    counts_for,
    in_bounds,
    can_exchange,
    is_dead_card,
    legal_targets,
    find_new_sequences,
} = require('./sequence_game');

// Hints for training games: one suggested move for the player whose turn it is, and why. The reason is data
// ({kind, length?, team?}) so clients can word it with their own team names. Deterministic: the same state
// always gives the same hint.

// Wild jacks are worth keeping, so a normal card that does as well is preferred.
const WILD_JACK_COST = 15;
const ONE_EYED_JACK_COST = 12;

/** The longest line through `pos` that counts for `team` (its chips and the corners), in any direction. */
function longest_line(chips, pos, team) {
    let longest = 0;
    DIRECTIONS.forEach(function (dir) {
        let length = 1;
        for (const sign of [1, -1]) {
            let p = {row: pos.row + sign * dir.row, column: pos.column + sign * dir.column};
            while (in_bounds(p) && counts_for(chips, p, team)) {
                length++;
                p = {row: p.row + sign * dir.row, column: p.column + sign * dir.column};
            }
        }
        longest = Math.max(longest, length);
    });
    return longest;
}

function with_chip(chips, pos, team) {
    const next = chips.map(function (row) {
        return row.slice();
    });
    next[pos.row][pos.column] = team;
    return next;
}

function opponents(state, team) {
    return Array.from({length: state.team_count}, function (_, t) {
        return t;
    }).filter(function (t) {
        return t !== team;
    });
}

/** Scores putting a chip on `pos`: completing a sequence, then the longer of building our line or blocking theirs. */
function placing(state, team, pos, wild) {
    const placed = with_chip(state.chips, pos, team);
    const cost = wild ? WILD_JACK_COST : 0;
    if (find_new_sequences(placed, state.sequences, team, pos).length > 0) {
        return {score: 1000 - cost, reason: {kind: 'sequence'}};
    }
    const own = longest_line(placed, pos, team);
    let block = {length: 0, team: null};
    opponents(state, team).forEach(function (other) {
        const length = longest_line(with_chip(state.chips, pos, other), pos, other);
        if (length > block.length) block = {length, team: other};
    });
    // A cell that would give an opponent five in a row must be taken now.
    const block_score = block.length >= 5 ? 900 : block.length * 9;
    if (own * 10 >= block_score) return {score: own * 10 - cost, reason: {kind: 'extend', length: own}};
    return {score: block_score - cost, reason: {kind: 'block', length: block.length, team: block.team}};
}

/** Scores removing the opponent chip on `pos` with a one-eyed jack, by the line it breaks. */
function removing(state, pos) {
    const owner = state.chips[pos.row][pos.column];
    const length = longest_line(state.chips, pos, owner);
    return {score: length * 9 - ONE_EYED_JACK_COST, reason: {kind: 'break', length, team: owner}};
}

/**
 * The suggested move for the current player, or null once the game is over:
 * {type: 'play', hand_index, target, reason} | {type: 'exchange', hand_index, reason} | {type: 'pass', reason}.
 */
function suggest_move(state) {
    if (state.winner !== null) return null;
    const hand = state.hands[state.current];
    const team = state.players[state.current].team;

    if (can_exchange(state)) {
        const hand_index = hand.findIndex(function (card) {
            return is_dead_card(state, card);
        });
        return {type: 'exchange', hand_index, reason: {kind: 'dead'}};
    }

    let best = null;
    hand.forEach(function (card, hand_index) {
        const kind = card_kind(card);
        legal_targets(state, hand_index).forEach(function (target) {
            const scored = kind === 'one-eyed-jack' ? removing(state, target) : placing(state, team, target, kind === 'two-eyed-jack');
            // Ties go to the earlier card, then the earlier cell, so hints are stable.
            if (best === null || scored.score > best.score) {
                best = {score: scored.score, move: {type: 'play', hand_index, target, reason: scored.reason}};
            }
        });
    });
    return best === null ? {type: 'pass', reason: {kind: 'pass'}} : best.move;
}

module.exports = {suggest_move, longest_line};
