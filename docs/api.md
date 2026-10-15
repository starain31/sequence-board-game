# API contract

Base URL `http://localhost:3000`. Request bodies are JSON (`Content-Type: application/json`); urlencoded also
works. Auth means "uses the session cookie set by `/user/signin`". There is no global error handler, so thrown
errors come back as Express's default **HTML** 500 page, not JSON. Behaviour below was confirmed against a
running server.

## Health

### `GET /health`
`200 {status: 'ok', database: 'up'}` when PostgreSQL answers, `503 {status: 'error', database: 'down'}` when it
doesn't. Used by the backend's Docker healthcheck.

## User

Errors are JSON `{error: CODE, message}`; `message` is readable by players. Handles are case-insensitive:
they are trimmed and lower-cased before use, and responses always carry the stored lower-case form.

### `POST /user/signup`
Body `{handle, name, password}`. Creates the account and signs it in (sets cookie `connect.sid`).
- Success: `201 {handle, name}`.
- `400 INVALID_HANDLE` (3–20 of `a-z 0-9 _`), `400 INVALID_NAME` (1–50 characters after trimming),
  `400 WEAK_PASSWORD` (8–200 characters).
- `409 HANDLE_TAKEN`.
- `429 TOO_MANY_ATTEMPTS` after 20 sign-ups from one IP within an hour.

### `POST /user/signin`
Body `{handle, password}`. Development accounts (created by `npm run db:seed`): `jabir` / `1`, `sakib` / `123`.
- Success: `200 {handle, name}`, sets cookie `connect.sid` (a new session id on every sign-in).
- `401 INVALID_CREDENTIALS` for a wrong password or an unknown handle (the two are indistinguishable).
- `429 TOO_MANY_ATTEMPTS` after 10 failed sign-ins from one IP within 15 minutes. Successful sign-ins don't count.

### `POST /user/signout`
Ends the session on the server and clears the cookie. Always `204`, with or without a session.

### `GET /user/profile` (auth)
`200 {handle, name}`, or `401 NOT_SIGNED_IN`. Clients can use it to ask "am I signed in?".

### `GET /user/rooms` (auth)
One page of the tables you created or sat at, newest first. Query `page` (from 1, default 1) and `per_page`
(default 10, at most 50); missing or invalid values use the defaults. A page past the end has no rooms.
`401 NOT_SIGNED_IN` without a session.

```jsonc
{
 "page": 1, "per_page": 10, "total": 23, "pages": 3,
 "rooms": [{
  "id": "friday-night-k3m9", "name": "Friday Night", "created_at": "…", "administrator": "jabir",
  "administrator_name": "Jabir ibne kamal",
  "team_count": 2, "players_per_team": 1, "seats_taken": 2,
  "settings": {"mode": "standard", "history": false, "highlights": false, "auto_draw_dead": false, "turn_seconds": 90},
  "your_team": 0,                      // null when you only created the table
  "status": "playing",                 // open (no game yet) | playing | finished
  "started_at": "…", "last_move_at": "…", "finished_at": null, "winner_team": null,
  "move_count": 12
 }, …]
}
```

### `GET /user/current-game` (auth)
`200 {room}`: the game in progress where you have a seat that moved most recently (the room as in
`GET /user/rooms`), or `{room: null}`. For a dashboard's "resume your game". `401 NOT_SIGNED_IN` without a session.

## Room

Rooms, seats, games and every move are stored in PostgreSQL, so tables and games in progress survive restarts.

### `POST /room/create` (auth)
Body `{number_of_team, number_of_player_in_each_team, name?, mode?, history?, highlights?, auto_draw_dead?,
turn_seconds?}`. Counts are numbers or numeric strings; `mode` is `"standard"` or `"training"`; `turn_seconds` is a
whole number from 15 to 600; the other settings are booleans (or `"true"` / `"false"`).
`200 {id}`. `id` is the table's code: a slug of its name plus a 4-character suffix, such as `"friday-night-k3m9"`.
Without a name the table gets a generated one ("Lucky Otter"). The signed-in user becomes `administrator` (the host).
Errors are JSON `{error, message}`: `401 NOT_SIGNED_IN`, `400 UNSUPPORTED_TABLE` for a table size the rules
can't deal for (2 or 3 teams; 2, 3, 4, 6, 8, 9, 10 or 12 players in total), `400 INVALID_NAME` (over 40
characters), `400 INVALID_SETTINGS`.

Settings and their defaults:

| Setting | Default | Effect |
|---|---|---|
| `mode` | `"standard"` | `"training"`: the player whose turn it is gets a `hint` in the GameView. Standard games never get hints |
| `history` | `false` | Off: `GET /room/:id/turns` is `403 HISTORY_DISABLED` and the GameView's `log` keeps only the latest move |
| `highlights` | `false` | Off: clients don't light up legal cells (the server only reports the setting) |
| `turn_seconds` | `90` | Seconds each player has for a turn. Clients offer 30, 60, 90, 120 and 180, or any whole number from 15 to 600 |
| `auto_draw_dead` | `false` | On: a dead card is exchanged automatically when its owner's turn starts (their one exchange for that turn), logged as `{kind: "exchange", auto: true, …}` |

Room codes created before slugs are numeric strings (`"731791746123232"`) and still work.

### `PATCH /room/:id/settings` (auth, host)
Body `{name?, mode?, history?, highlights?, auto_draw_dead?, turn_seconds?}`; missing keys keep their value. The code never changes.
`200` with the Room, and `room_updated` is broadcast. `401 NOT_SIGNED_IN`, `403 NOT_HOST`, `404 ROOM_NOT_FOUND`,
`409 GAME_ALREADY_STARTED` (settings are fixed once the game starts), `400 INVALID_NAME | INVALID_SETTINGS`.

### `GET /room/:id`
`200` with a Room, or `200` with an **empty body** when the id doesn't exist.

```jsonc
// Room
{
  "administrator": "jabir",                  // the host's handle
  "administrator_name": "Jabir ibne kamal",  // the host's display name, for messages
  "id": "friday-night-k3m9",
  "name": "Friday Night",
  "settings": {"mode": "standard", "history": false, "highlights": false, "auto_draw_dead": false, "turn_seconds": 90},
  "created_at": "2026-10-15T05:48:22.696Z",
  "teams": [
    { "handle": "TEAM_1", "players": [ {"handle": "jabir", "name": "Jabir ibne kamal"}, null ] },
    { "handle": "TEAM_2", "players": [ null, null ] }
  ],
  "game_started": false
}
```
Team handles are `TEAM_1 … TEAM_n`. Empty seats are `null`. Player objects are `{handle, name}`.

### `POST /room/:id/join` (auth)
Body `{team_handle}`. Takes the first empty seat in that team. Always HTTP `200`; check `message`:
- `{"message": "success"}`, then the server broadcasts `room_updated`.
- `{"message": "SEAT_TAKEN"}` when the team is full.
- `{"message": "ALREADY_SEATED"}` when you already have a seat at this table.
- `{"message": "NOT_SIGNED_IN"}` without a session.
- `{"message": "GAME_ALREADY_STARTED"}` once the table's game has started.
- `{"message": "ROOM_NOT_FOUND"}` or `{"message": "TEAM_NOT_FOUND"}`.

Joins to the same room are serialised, so a contested last seat goes to exactly one player.

### `POST /room/:id/leave` (auth)
Stand up from your seat before the game starts, to take another seat or let the host reshuffle the teams.
`200` with the Room, and `room_updated` is broadcast. JSON errors: `401 NOT_SIGNED_IN`, `404 ROOM_NOT_FOUND`,
`409 NOT_SEATED` (you have no seat here), `409 GAME_ALREADY_STARTED` (seats are fixed once the game starts).

### `POST /room/:id/shuffle` (auth, host)
Deals the seated players out to the seats at random before the game starts, keeping teams as even as possible
(seat 1 of every team first, then seat 2, …). `200` with the Room, and `room_updated` is broadcast. `401`, `403
NOT_HOST`, `404 ROOM_NOT_FOUND`, `409 GAME_ALREADY_STARTED`. To list your rooms, see [`GET /user/rooms`](#get-userrooms-auth).

## Table game

A full game for a room, run by the server (`entity/sequence_game.js`). Errors are JSON `{error, message}`, where
`message` is readable by players: `401 NOT_SIGNED_IN`, `403 NOT_A_PLAYER | NOT_HOST`, `404 ROOM_NOT_FOUND | GAME_NOT_FOUND`,
`409 GAME_ALREADY_STARTED | TABLE_NOT_FULL | NOT_YOUR_TURN | GAME_OVER`, and `400` for rule errors (`CELL_MISMATCH`,
`CELL_OCCUPIED`, `CORNER`, `OWN_CHIP`, `LOCKED_CHIP`, `NOT_DEAD`, `HAS_MOVES`, …).

### `POST /room/:id/start` (auth)
Deals a game once every seat is taken. Only the table's creator (the host, `administrator`) may start it; anyone
else gets `403 NOT_HOST`. Seats alternate
teams (T1, T2, [T3,] T1, …), and the first seat moves first. Returns a GameView and broadcasts `room_updated` and
`game_updated`.

Moves on one table are applied one at a time: of two simultaneous moves by the current player, the second
gets `409 NOT_YOUR_TURN`. Every accepted move is recorded (see [`GET /room/:id/turns`](#get-roomidturns)).

### `GET /room/:id/game`
The GameView for the session's user. Anyone may watch; only seated players see a hand (their own).

```jsonc
// GameView
{
  "team_count": 2, "sequences_to_win": 2,
  "players": [{"handle": "jabir", "name": "Jabir ibne kamal", "team": 0, "hand_count": 7}, …],
  "current_player": "jabir",          // null once the game is won
  "turn": 1,
  "board": [[{"name": "Blank", "team": null}, {"name": "6-Diamond", "team": 0}, …], …],   // 10×10, team is 0|1|2|null
  "viewer": "jabir",                  // null for a spectator
  "hand": ["4-Spade", "J-Club", …],
  "can_exchange": false, "can_pass": false,
  "deck_count": 90,
  "sequences": [{"team": 0, "cells": [{"row": 0, "column": 1}, …]}],
  "winner": null,
  "name": "Friday Night",            // the room's name
  "hint": null,                      // training games only, for the current player, see below
  "turn_started_at": "2026-10-15T06:55:15.349Z",   // when the current turn began (null for games stored before)
  "turn_deadline": "2026-10-15T06:56:45.349Z",     // when the turn's timer runs out (null once the game is over)
  "server_time": "2026-10-15T06:55:21.002Z",       // the server's clock now, to run a turn timer despite clock skew
  "settings": {"mode": "standard", "history": false, "highlights": false, "auto_draw_dead": false, "turn_seconds": 90},
  "log": [{"kind": "place", "turn": 1, "player": "Jabir ibne kamal", "team": 0, "card": "4-Spade", "pos": {"row": 1, "column": 5}, "wild": false}, …]
}
```

`hint` is null except for the player whose turn it is in a training game, where it is the suggested move
(`entity/hints.js`):

```jsonc
{"type": "play", "hand_index": 2, "target": {"row": 3, "column": 5}, "reason": {"kind": "block", "length": 5, "team": 1}}
{"type": "exchange", "hand_index": 0, "reason": {"kind": "dead"}}
{"type": "pass", "reason": {"kind": "pass"}}
```

`reason.kind` is `sequence` (completes one), `extend` (builds your line to `length`), `block` (takes the cell that
would give `team` a line of `length`), `break` (a one-eyed jack breaking `team`'s line of `length`), `dead` or `pass`.

When `turn_deadline` passes, the server plays for the current player: a random card from their hand that can be
played, on a random legal cell (after exchanging a dead card if nothing else can be played; a pass if nothing can be
done). It is recorded like any move, with `timed_out: true` on the turn and on the log entries it made, and
`game_updated` is broadcast.

### `POST /room/:id/game/play` (auth) — body `{hand_index, row, column}`
### `POST /room/:id/game/exchange` (auth) — body `{hand_index}` (a dead card, once per turn, before playing)
### `POST /room/:id/game/pass` (auth) — only when no card can be played or exchanged

Each applies the move for the current player, draws a replacement card, and returns the new GameView. Every change
broadcasts `game_updated`.

### `GET /room/:id/turns`
The table's moves so far, oldest first. Public, like the game view, and never includes hands or the deck.
`404 ROOM_NOT_FOUND | GAME_NOT_FOUND`, `403 HISTORY_DISABLED` when the room plays without history; `[]` when the
game has started but nobody has moved.

```jsonc
[{
  "move_number": 1,                    // 1, 2, 3… across the game
  "turn": 1,                           // the game's turn counter; an exchange shares it with the next play
  "player": {"handle": "jabir", "name": "Jabir ibne kamal"},
  "team": 0,
  "kind": "play",                      // play | exchange | pass
  "card": "4-Spade",                   // null for a pass
  "cell": {"row": 1, "column": 5},     // only for a play
  "events": [{"kind": "place", …}],    // the log entries the move produced (also sequence and win)
  "timed_out": false,                  // true when the server played it because the turn timer ran out
  "created_at": "2026-10-15T05:48:22.705Z"
}, …]
```

## Board

### `GET /board/deck`
`200 {deck: Cell[10][10]}`, where `Cell = {name: string, occupied_by?: string}`. This is the legacy game's
live board: `occupied_by` would be set to a team handle (`team1` / `team2`) after a successful move. See
[game-domain.md](game-domain.md) for the layout.

## Game (legacy global game)

### `GET /game/hand_cards?player_handler=<handle>`
`200 {cards_in_hand: [{name}]}` (5 cards). Valid handles: `jabir`, `sakib`, `habiba`, `humaira`; any other
handle gives a `500`. The session is not used; anyone can read any hand.

### `GET /game/play` (a GET that changes state)
Query string:
- `player_handler`: handle as above
- `hand_card_index`: index into that player's hand
- `board_card_index`: URL-encoded JSON `{"row": r, "column": c}`

Responses:
- Invalid move: `404`, plain text `Invalid Move`.
- Valid move: `200 {verdict: "Valid", team}`. The chip is placed (or removed by a one-eyed jack) and the played card
  is replaced from the deck. There is still no turn order; use the table game for real play.
- (Before the fix, every valid move was a `500` because
  `current_team` is undefined. The board is not changed and no card is drawn.

## Socket.IO

Same origin and port as HTTP, default path `/socket.io`. The server also serves the matching client script at
`/socket.io/socket.io.js`. Use a `socket.io-client` with the **same major version** as the installed server.

| Event (server → client) | Payload | When |
|---|---|---|
| `room_updated` | Room (see above) | After every successful join or game start, sent to **every** connected socket |
| `teams_shuffled` | `{room_id, by: {handle, name}, room}` | After the host shuffles the teams (`room` is the new seating), so clients can tell players their new team |
| `game_updated` | `{room_id}` | After a table game starts or changes. Re-fetch `GET /room/:id/game`; the payload has no hands |

No client → server events are handled. For the legacy game there are no events, so clients must re-fetch
`/board/deck` and `/game/hand_cards` themselves.

## Static assets

Card images: `GET /images/card_deck/Cards-<name>.svg`, where `<name>` is a card name (`10-Heart`, `J-Spade`,
`Blank`), plus `Cards-Reverse.svg` (card back) and three joker images that the game never uses.
