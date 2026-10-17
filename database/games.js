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

async function create({room_id, state, turn_deadline = null, client = pool}) {
    await client.query('INSERT INTO games (room_id, state, turn_deadline) VALUES ($1, $2, $3)', [room_id, state, turn_deadline]);
}

// Saves the state after an accepted move and appends the move to `turns`. Call inside the transaction that
// read `previous` with a lock. `turn_deadline` is when the next turn's timer runs out (null once the game is
// over); `timed_out` marks a move made for a player who ran out of time.
async function record_move({room_id, previous, next, handle, move, turn_deadline = null, timed_out = false, client}) {
    const player = previous.players[previous.current];
    const card = move.type === 'pass' ? null : previous.hands[previous.current][move.hand_index];
    const cell = move.type === 'play' ? move.target : {row: null, column: null};
    const events = next.log.slice(previous.log.length);

    const {rows} = await client.query(
        `UPDATE games
         SET state = $2, updated_at = now(), winner_team = $3,
             finished_at = CASE WHEN $3::SMALLINT IS NULL THEN NULL ELSE now() END,
             turn_deadline = CASE WHEN $3::SMALLINT IS NULL THEN $4::TIMESTAMPTZ ELSE NULL END
         WHERE room_id = $1
         RETURNING id`,
        [room_id, next, next.winner, turn_deadline]
    );
    await client.query(
        `INSERT INTO turns (game_id, move_number, turn, user_id, team, kind, card, cell_row, cell_column, events, timed_out)
         VALUES ($1, (SELECT count(*) + 1 FROM turns WHERE game_id = $1), $2,
                 (SELECT id FROM users WHERE handle = $3), $4, $5, $6, $7, $8, $9, $10)`,
        [rows[0].id, previous.turn, handle, player.team, move.type, card, cell.row, cell.column, JSON.stringify(events), timed_out]
    );
}

// Saves a change to the game that isn't a move (a turn pausing or resuming), with the turn's new deadline.
async function save_state({room_id, state, turn_deadline = null, client = pool}) {
    await client.query(
        'UPDATE games SET state = $2, updated_at = now(), turn_deadline = $3 WHERE room_id = $1',
        [String(room_id), state, turn_deadline]
    );
}

// Games in progress whose turn timer ran out at or before `now`, oldest deadline first: [room_id].
async function overdue({now = new Date(), client = pool} = {}) {
    const {rows} = await client.query(
        `SELECT room_id FROM games WHERE finished_at IS NULL AND turn_deadline <= $1 ORDER BY turn_deadline`,
        [now]
    );
    return rows.map(function (row) {
        return row.room_id;
    });
}

// When the game's current turn runs out, or null.
async function get_deadline({room_id, client = pool}) {
    const {rows} = await client.query('SELECT turn_deadline FROM games WHERE room_id = $1', [String(room_id)]);
    return rows[0] === undefined ? null : rows[0].turn_deadline;
}

// The room's moves in play order, with who made them. Only public information: no hands, no deck.
async function list_turns({room_id, client = pool}) {
    const {rows} = await client.query(
        `SELECT turns.move_number, turns.turn, users.handle, users.name, turns.team, turns.kind, turns.card,
                turns.cell_row, turns.cell_column, turns.events, turns.timed_out, turns.created_at
         FROM turns
         JOIN games ON games.id = turns.game_id
         JOIN users ON users.id = turns.user_id
         WHERE games.room_id = $1
         ORDER BY turns.move_number`,
        [String(room_id)]
    );
    return rows.map(function (row) {
        return {
            move_number: row.move_number,
            turn: row.turn,
            player: {handle: row.handle, name: row.name},
            team: row.team,
            kind: row.kind,
            card: row.card,
            cell: row.cell_row === null ? null : {row: row.cell_row, column: row.cell_column},
            events: row.events,
            timed_out: row.timed_out,
            created_at: row.created_at,
        };
    });
}

module.exports = {get, create, record_move, save_state, list_turns, overdue, get_deadline};
