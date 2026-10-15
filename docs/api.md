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
The tables you created or sat at, newest first (at most 50). `401 NOT_SIGNED_IN` without a session.

```jsonc
[{
  "id": "friday-night-k3m9", "name": "Friday Night", "created_at": "…", "administrator": "jabir",
  "team_count": 2, "players_per_team": 1, "seats_taken": 2,
  "settings": {"history": true, "highlights": true, "auto_draw_dead": false},
  "your_team": 0,                      // null when you only created the table
  "status": "playing",                 // open (no game yet) | playing | finished
  "started_at": "…", "finished_at": null, "winner_team": null,
  "move_count": 12
}, …]
```

## Room

Rooms, seats, games and every move are stored in PostgreSQL, so tables and games in progress survive restarts.

### `POST /room/create` (auth)
Body `{number_of_team, number_of_player_in_each_team, name?, history?, highlights?, auto_draw_dead?}`. Counts are
numbers or numeric strings; settings are booleans (or `"true"` / `"false"`).
`200 {id}`. `id` is the table's code: a slug of its name plus a 4-character suffix, such as `"friday-night-k3m9"`.
Without a name the table gets a generated one ("Lucky Otter"). The signed-in user becomes `administrator` (the host).
Errors are JSON `{error, message}`: `401 NOT_SIGNED_IN`, `400 UNSUPPORTED_TABLE` for a table size the rules
can't deal for (2 or 3 teams; 2, 3, 4, 6, 8, 9, 10 or 12 players in total), `400 INVALID_NAME` (over 40
characters), `400 INVALID_SETTINGS`.

Settings and their defaults:

| Setting | Default | Effect |
|---|---|---|
| `history` | `true` | Off: `GET /room/:id/turns` is `403 HISTORY_DISABLED` and the GameView's `log` keeps only the latest move |
| `highlights` | `true` | Off: clients don't light up legal cells (the server only reports the setting) |
| `auto_draw_dead` | `false` | On: a dead card is exchanged automatically when its owner's turn starts (their one exchange for that turn), logged as `{kind: "exchange", auto: true, …}` |

Room codes created before slugs are numeric strings (`"731791746123232"`) and still work.

### `PATCH /room/:id/settings` (auth, host)
Body `{name?, history?, highlights?, auto_draw_dead?}`; missing keys keep their value. The code never changes.
`200` with the Room, and `room_updated` is broadcast. `401 NOT_SIGNED_IN`, `403 NOT_HOST`, `404 ROOM_NOT_FOUND`,
`409 GAME_ALREADY_STARTED` (settings are fixed once the game starts), `400 INVALID_NAME | INVALID_SETTINGS`.

### `GET /room/:id`
`200` with a Room, or `200` with an **empty body** when the id doesn't exist.

```jsonc
// Room
{
  "administrator": "jabir",
  "id": "friday-night-k3m9",
  "name": "Friday Night",
  "settings": {"history": true, "highlights": true, "auto_draw_dead": false},
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
There is no endpoint to leave a room. To list your rooms, see [`GET /user/rooms`](#get-userrooms-auth).

## Table game

A full game for a room, run by the server (`entity/sequence_game.js`). Errors are JSON `{error, message}`, where
`message` is readable by players: `401 NOT_SIGNED_IN`, `403 NOT_A_PLAYER`, `404 ROOM_NOT_FOUND | GAME_NOT_FOUND`,
`409 GAME_ALREADY_STARTED | TABLE_NOT_FULL | NOT_YOUR_TURN | GAME_OVER`, and `400` for rule errors (`CELL_MISMATCH`,
`CELL_OCCUPIED`, `CORNER`, `OWN_CHIP`, `LOCKED_CHIP`, `NOT_DEAD`, `HAS_MOVES`, …).

### `POST /room/:id/start` (auth)
Deals a game once every seat is taken. Any seated player, or the table's creator, may start it. Seats alternate
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
  "settings": {"history": true, "highlights": true, "auto_draw_dead": false},
  "log": [{"kind": "place", "turn": 1, "player": "Jabir ibne kamal", "team": 0, "card": "4-Spade", "pos": {"row": 1, "column": 5}, "wild": false}, …]
}
```

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
| `game_updated` | `{room_id}` | After a table game starts or changes. Re-fetch `GET /room/:id/game`; the payload has no hands |

No client → server events are handled. For the legacy game there are no events, so clients must re-fetch
`/board/deck` and `/game/hand_cards` themselves.

## Static assets

Card images: `GET /images/card_deck/Cards-<name>.svg`, where `<name>` is a card name (`10-Heart`, `J-Spade`,
`Blank`), plus `Cards-Reverse.svg` (card back) and three joker images that the game never uses.
