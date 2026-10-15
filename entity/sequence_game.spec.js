const {create_game, apply_move, view_for, legal_targets, find_new_sequences, empty_chip_grid, random_move} = require('./sequence_game');
const board_deck = require('../data/board_deck.json');

function teams_of(team_count, players_per_team) {
    return Array.from({length: team_count}, function (_, t) {
        return {
            handle: `TEAM_${t + 1}`,
            players: Array.from({length: players_per_team}, function (_, p) {
                return {handle: `t${t}p${p}`, name: `Player ${t}-${p}`};
            }),
        };
    });
}

/** A game where the current player's first card is `card`. */
function with_card(state, card) {
    const hands = state.hands.map(function (h) {
        return h.slice();
    });
    hands[state.current][0] = card;
    return Object.assign({}, state, {hands});
}

describe('create_game', function () {
    it('seats players alternating teams and deals by table size', function () {
        const game = create_game({teams: teams_of(2, 2)});
        expect(game.players.map(function (p) {
            return [p.handle, p.team];
        })).toEqual([['t0p0', 0], ['t1p0', 1], ['t0p1', 0], ['t1p1', 1]]);
        expect(game.hands.every(function (h) {
            return h.length === 6;
        })).toBe(true);
        expect(game.deck.length).toBe(104 - 24);
    });

    it('rejects tables the rules cannot deal for', function () {
        expect(function () {
            create_game({teams: teams_of(3, 5)});
        }).toThrow(/can't be dealt/);
    });
});

describe('apply_move', function () {
    it('places a chip, draws a card and passes the turn', function () {
        const game = with_card(create_game({teams: teams_of(2, 1)}), '6-Diamond');
        const deck_before = game.deck.length;
        const next = apply_move(game, 't0p0', {type: 'play', hand_index: 0, target: {row: 0, column: 1}});
        expect(next.chips[0][1]).toBe(0);
        expect(next.hands[0].length).toBe(7);
        expect(next.deck.length).toBe(deck_before - 1);
        expect(next.current).toBe(1);
        expect(next.turn).toBe(2);
        expect(game.chips[0][1]).toBeNull();
    });

    it('rejects a move out of turn', function () {
        const game = create_game({teams: teams_of(2, 1)});
        expect(function () {
            apply_move(game, 't1p0', {type: 'pass'});
        }).toThrow(/turn/);
    });

    it('rejects a card on the wrong cell', function () {
        const game = with_card(create_game({teams: teams_of(2, 1)}), '6-Diamond');
        expect(function () {
            apply_move(game, 't0p0', {type: 'play', hand_index: 0, target: {row: 0, column: 2}});
        }).toThrow(expect.objectContaining({code: 'CELL_MISMATCH'}));
    });

    it('lets a one-eyed jack remove an opponent chip', function () {
        let game = create_game({teams: teams_of(2, 1)});
        game.chips[4][4] = 1;
        game = with_card(game, 'J-Spade');
        expect(legal_targets(game, 0)).toEqual([{row: 4, column: 4}]);
        const next = apply_move(game, 't0p0', {type: 'play', hand_index: 0, target: {row: 4, column: 4}});
        expect(next.chips[4][4]).toBeNull();
    });

    it('detects a sequence and declares a winner with two', function () {
        let game = create_game({teams: teams_of(2, 1)});
        // Row 0 with its corner: (0,0) is a free corner, so (0,1)…(0,4) completes a sequence.
        [1, 2, 3].forEach(function (c) {
            game.chips[0][c] = 0;
        });
        // A second, already completed sequence for team 0.
        game.sequences = [{team: 0, cells: [5, 6, 7, 8, 9].map(function (c) {
            return {row: 9, column: c};
        })}];
        game = with_card(game, board_deck[0][4].name);
        const next = apply_move(game, 't0p0', {type: 'play', hand_index: 0, target: {row: 0, column: 4}});
        expect(next.sequences.length).toBe(2);
        expect(next.winner).toBe(0);
        expect(next.log.map(function (e) {
            return e.kind;
        })).toEqual(['place', 'sequence', 'win']);
        expect(function () {
            apply_move(next, 't1p0', {type: 'pass'});
        }).toThrow(/over/);
    });
});

describe('find_new_sequences', function () {
    it('counts a 9-long line as two sequences', function () {
        const chips = empty_chip_grid();
        for (let c = 0; c < 9; c++) chips[2][c] = 0;
        expect(find_new_sequences(chips, [], 0, {row: 2, column: 4}).length).toBe(2);
    });

    it('counts a 6-long line once', function () {
        const chips = empty_chip_grid();
        for (let c = 1; c < 7; c++) chips[2][c] = 0;
        expect(find_new_sequences(chips, [], 0, {row: 2, column: 6}).length).toBe(1);
    });
});

describe('view_for', function () {
    it("shows only the viewer's own hand", function () {
        const game = create_game({teams: teams_of(2, 1)});
        const view = view_for(game, 't1p0');
        expect(view.hand).toEqual(game.hands[1]);
        expect(JSON.stringify(view)).not.toContain('"deck":');
        expect(view.current_player).toBe('t0p0');
        expect(view_for(game, 'stranger').hand).toEqual([]);
    });
});

describe('room rules', function () {
    function cells_of(card) {
        const cells = [];
        board_deck.forEach(function (row, r) {
            row.forEach(function (cell, c) {
                if (cell.name === card) cells.push({row: r, column: c});
            });
        });
        return cells;
    }

    // Both 6-Diamond cells covered, a 6-Diamond in the second player's hand, and a wild jack for the first.
    function with_dead_card_for_next_player(rules) {
        const game = create_game({teams: teams_of(2, 1), rules});
        const chips = game.chips.map(function (row) {
            return row.slice();
        });
        cells_of('6-Diamond').forEach(function (p) {
            chips[p.row][p.column] = 0;
        });
        const hands = game.hands.map(function (h) {
            return h.filter(function (card) {
                return card !== '6-Diamond';
            }).slice(0, 6);
        });
        hands[0] = ['J-Club'].concat(hands[0]);
        hands[1] = ['6-Diamond'].concat(hands[1]);
        return Object.assign({}, game, {chips, hands, log: []});
    }

    it('exchanges a dead card when its owner\'s turn starts, with auto_draw_dead', function () {
        const game = with_dead_card_for_next_player({auto_draw_dead: true});
        expect(game.rules).toEqual({auto_draw_dead: true});
        const next = apply_move(game, 't0p0', {type: 'play', hand_index: 0, target: {row: 5, column: 5}});
        expect(next.current).toBe(1);
        expect(next.hands[1]).not.toContain('6-Diamond');
        expect(next.hands[1]).toHaveLength(7);
        expect(next.discard).toContain('6-Diamond');
        expect(next.exchanged_this_turn).toBe(true);
        expect(next.log.at(-1)).toEqual({kind: 'exchange', turn: 2, player: 'Player 1-0', team: 1, card: '6-Diamond', auto: true});
    });

    it('leaves dead cards alone without the rule, and for games stored before rules existed', function () {
        const game = with_dead_card_for_next_player({});
        expect(game.rules).toEqual({auto_draw_dead: false});
        const legacy = Object.assign({}, game);
        delete legacy.rules;
        for (const state of [game, legacy]) {
            const next = apply_move(state, 't0p0', {type: 'play', hand_index: 0, target: {row: 5, column: 5}});
            expect(next.hands[1][0]).toBe('6-Diamond');
            expect(next.exchanged_this_turn).toBe(false);
        }
    });

    it('view_for keeps only the latest move when history is off, and passes the settings on', function () {
        let game = create_game({teams: teams_of(2, 1)});
        for (const handle of ['t0p0', 't1p0', 't0p0']) {
            game = apply_move(with_card(game, 'J-Club'), handle, {type: 'play', hand_index: 0, target: {row: game.turn, column: 5}});
        }
        expect(view_for(game, 't0p0').log).toHaveLength(3);
        const settings = {history: false, highlights: true, auto_draw_dead: false};
        const view = view_for(game, 't0p0', settings);
        expect(view.log.map(function (entry) {
            return entry.turn;
        })).toEqual([3]);
        expect(view.settings).toEqual(settings);
    });
});

describe('random_move', function () {
    function sequence(values) {
        let i = 0;
        return function () {
            return values[i++ % values.length];
        };
    }

    it('plays a random playable card on a random legal cell', function () {
        const game = create_game({teams: teams_of(2, 1)});
        for (let i = 0; i < 20; i++) {
            const move = random_move(game);
            expect(move.type).toBe('play');
            expect(legal_targets(game, move.hand_index)).toContainEqual(move.target);
            expect(function () {
                apply_move(game, 't0p0', move);
            }).not.toThrow();
        }
        // The first draw picks the card, the second the cell.
        const hand = ['J-Club', '6-Diamond'];
        const fixed = Object.assign({}, game, {hands: [hand, game.hands[1]]});
        expect(random_move(fixed, sequence([0.99, 0]))).toEqual({type: 'play', hand_index: 1, target: legal_targets(fixed, 1)[0]});
    });

    it('exchanges a dead card when nothing can be played, then passes when that is done', function () {
        const game = create_game({teams: teams_of(2, 1)});
        const chips = game.chips.map(function (row) {
            return row.slice();
        });
        // Both 6-Diamond cells are covered, so a hand of only 6-Diamond has nothing to play.
        board_deck.forEach(function (row, r) {
            row.forEach(function (cell, c) {
                if (cell.name === '6-Diamond') chips[r][c] = 0;
            });
        });
        const dead = Object.assign({}, game, {chips, hands: [['6-Diamond'], game.hands[1]]});
        expect(random_move(dead)).toEqual({type: 'exchange', hand_index: 0});
        expect(random_move(Object.assign({}, dead, {exchanged_this_turn: true}))).toEqual({type: 'pass'});
    });
});
