const {pool} = require('./pool');

// A room's game and its move history. Every function takes an optional `client`, so the controller can read,
// change and record a game in one transaction. Kept apart from rooms so a room payload never carries hands.

// The game state, or undefined before the game starts. `lock` holds the row until the transaction ends,
// so concurrent moves on one table run one after another.
async function get({room_id, client = pool, lock = false}) {
    const {rows} = await client.query(
        `SELECT state FROM games WHERE room_id = $1 ${lock ? 'FOR UPDATE' : ''}`,
        [String(room_id)]
    );
    return rows[0] === undefined ? undefined : rows[0].state;
}

async function create({room_id, state, client = pool}) {
    await client.query('INSERT INTO games (room_id, state) VALUES ($1, $2)', [room_id, state]);
}

// Saves the state after an accepted move and appends the move to `turns`. Call inside the transaction that
// read `previous` with a lock.
async function record_move({room_id, previous, next, handle, move, client}) {
    const player = previous.players[previous.current];
    const card = move.type === 'pass' ? null : previous.hands[previous.current][move.hand_index];
    const cell = move.type === 'play' ? move.target : {row: null, column: null};
    const events = next.log.slice(previous.log.length);

    const {rows} = await client.query(
        `UPDATE games
         SET state = $2, updated_at = now(), winner_team = $3,
             finished_at = CASE WHEN $3::SMALLINT IS NULL THEN NULL ELSE now() END
         WHERE room_id = $1
         RETURNING id`,
        [room_id, next, next.winner]
    );
    await client.query(
        `INSERT INTO turns (game_id, move_number, turn, user_id, team, kind, card, cell_row, cell_column, events)
         VALUES ($1, (SELECT count(*) + 1 FROM turns WHERE game_id = $1), $2,
                 (SELECT id FROM users WHERE handle = $3), $4, $5, $6, $7, $8, $9)`,
        [rows[0].id, previous.turn, handle, player.team, move.type, card, cell.row, cell.column, JSON.stringify(events)]
    );
}

module.exports = {get, create, record_move};
