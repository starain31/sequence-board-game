const {New_board} = require('./board');
const new_board_deck = require('../data/board_deck.json');

describe(`Make_Board`, function () {
    it(`Should return new board with new deck`, function () {
        const board = New_board();
        expect(board.get_deck()).toEqual(new_board_deck);
    });
});

describe(`make_a_move`, function () {
    it(`Should return place card on the board`, function () {
        const board = New_board();
        const row = 0, column = 1;
        const team_name = 'lal_dol';
        const hand_card = {name: "6-Diamond"};

        board.play({index: {row, column}, team_name, hand_card});
        expect(board.get_deck()[row][column].occupied_by).toBe(team_name);
    });

    it(`Should throw invalid move`, function () {
        const board = New_board();
        const row = 0, column = 1;
        const hand_card = {name: "7-Diamond"};

        expect(function () {
            board.play({index: {row, column}, hand_card});
        }).toThrow('INVALID_MOVE');
    });

    it(`Should throw invalid move for occupied cell`, function () {
        const board = New_board();
        const row = 0, column = 1;
        const team_name = 'lal_dol';
        const hand_card = {name: "6-Diamond"};

        board.play({index: {row, column}, team_name, hand_card});

        expect(function () {
            board.play({index: {row, column}, team_name, hand_card});
        }).toThrow('INVALID_MOVE');
    });
});