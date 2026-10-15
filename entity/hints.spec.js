const {create_game} = require('./sequence_game');
const {suggest_move, longest_line} = require('./hints');
const board_deck = require('../data/board_deck.json');

function two_players() {
    return create_game({
        teams: [
            {handle: 'TEAM_1', players: [{handle: 'ana', name: 'Ana'}]},
            {handle: 'TEAM_2', players: [{handle: 'ben', name: 'Ben'}]},
        ],
        random: function () {
            return 0.5;
        },
    });
}

/** The game with the current player's hand and some chips replaced. */
function setup(hand, chips = []) {
    const game = two_players();
    const grid = game.chips.map(function (row) {
        return row.slice();
    });
    chips.forEach(function ([row, column, team]) {
        grid[row][column] = team;
    });
    const hands = game.hands.slice();
    hands[game.current] = hand;
    return Object.assign({}, game, {hands, chips: grid});
}

function card_at(row, column) {
    return board_deck[row][column].name;
}

describe('longest_line', function () {
    test('counts the team\'s chips and corners through a cell', function () {
        const {chips} = setup([], [[0, 1, 0], [0, 2, 0], [1, 1, 1]]);
        expect(longest_line(chips, {row: 0, column: 3}, 0)).toBe(4); // corner, 0-1, 0-2, the cell itself
        expect(longest_line(chips, {row: 0, column: 3}, 1)).toBe(1);
    });
});

describe('suggest_move', function () {
    test('completes a sequence when it can', function () {
        // Row 1, columns 1-4 are team 0; the card for column 5 finishes five in a row.
        const chips = [1, 2, 3, 4].map(function (c) {
            return [1, c, 0];
        });
        const hint = suggest_move(setup(['J-Club', card_at(1, 5)], chips));
        expect(hint).toEqual({type: 'play', hand_index: 1, target: {row: 1, column: 5}, reason: {kind: 'sequence'}});
    });

    test('blocks an opponent about to make five', function () {
        const chips = [1, 2, 3, 4].map(function (c) {
            return [3, c, 1];
        });
        const hint = suggest_move(setup([card_at(3, 5), card_at(8, 8)], chips));
        expect(hint).toMatchObject({hand_index: 0, target: {row: 3, column: 5}, reason: {kind: 'block', length: 5, team: 1}});
    });

    test('prefers a normal card over a wild jack for the same cell', function () {
        const hint = suggest_move(setup(['J-Diamond', card_at(1, 1)]));
        expect(hint.hand_index).toBe(1);
        expect(hint.reason.kind).toBe('extend');
    });

    test('breaks the longest opponent line with a one-eyed jack', function () {
        const chips = [[5, 2, 1], [5, 3, 1], [5, 4, 1], [7, 7, 1]];
        const hint = suggest_move(setup(['J-Spade'], chips));
        expect(hint.type).toBe('play');
        expect(hint.target.row).toBe(5);
        expect(hint.reason).toEqual({kind: 'break', length: 3, team: 1});
    });

    test('suggests exchanging a dead card first', function () {
        const dead = card_at(2, 2);
        const cells = [];
        board_deck.forEach(function (row, r) {
            row.forEach(function (cell, c) {
                if (cell.name === dead) cells.push([r, c, 1]);
            });
        });
        expect(suggest_move(setup(['J-Club', dead], cells))).toEqual({type: 'exchange', hand_index: 1, reason: {kind: 'dead'}});
    });

    test('suggests passing with nothing to play, and nothing once the game is over', function () {
        // A one-eyed jack with no opponent chip on the board has no target.
        expect(suggest_move(setup(['J-Heart']))).toEqual({type: 'pass', reason: {kind: 'pass'}});
        expect(suggest_move(Object.assign(setup(['J-Heart']), {winner: 0}))).toBeNull();
    });
});
