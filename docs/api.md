# API contract

Base URL `http://localhost:3000`. Request bodies are JSON (`Content-Type: application/json`); urlencoded also
works. Auth means "uses the session cookie set by `/user/signin`". There is no global error handler, so thrown
errors come back as Express's default **HTML** 500 page, not JSON. Behaviour below was confirmed against a
running server.

## User

### `POST /user/signin`
Body `{handle, password}`. Test accounts: `jabir` / `1`, `sakib` / `123`.
- Success: `200`, empty body, sets cookie `connect.sid`.
- Wrong credentials: `302` redirect to `Referer` (or `/`). With `fetch`, look at `response.redirected` /
  status rather than the body.

### `POST /user/signup`
Stub. Always `200`, empty body, creates nothing.

### `GET /user/profile` (auth)
`200 {handle, name}`.
**Without a session it crashes the whole server process** (unhandled promise rejection). Only call it after
signing in.

There is no sign-out endpoint.

## Room

### `POST /room/create`
Body `{number_of_team, number_of_player_in_each_team}` (numbers or numeric strings, not validated).
`200 {id}`. `id` is a numeric string such as `"731791746123232"`. `administrator` is taken from the session;
it is `undefined` when not signed in (the request still succeeds).

### `GET /room/:id`
`200` with a Room, or `200` with an **empty body** when the id doesn't exist.

```jsonc
// Room
{
  "administrator": "jabir",
  "id": "731791746123232",
  "administrator": "jabir",
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

There are no endpoints to leave a room or list rooms.

## Table game

A full game for a room, run by the server (`entity/sequence_game.js`). Errors are JSON `{error, message}`, where
`message` is readable by players: `401 NOT_SIGNED_IN`, `403 NOT_A_PLAYER`, `404 ROOM_NOT_FOUND | GAME_NOT_FOUND`,
`409 GAME_ALREADY_STARTED | TABLE_NOT_FULL | NOT_YOUR_TURN | GAME_OVER`, and `400` for rule errors (`CELL_MISMATCH`,
`CELL_OCCUPIED`, `CORNER`, `OWN_CHIP`, `LOCKED_CHIP`, `NOT_DEAD`, `HAS_MOVES`, …).

### `POST /room/:id/start` (auth)
Deals a game once every seat is taken. Any seated player, or the table's creator, may start it. Seats alternate
teams (T1, T2, [T3,] T1, …), and the first seat moves first. Returns a GameView and broadcasts `room_updated` and
`game_updated`.

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
  "log": [{"kind": "place", "turn": 1, "player": "Jabir ibne kamal", "team": 0, "card": "4-Spade", "pos": {"row": 1, "column": 5}, "wild": false}, …]
}
```

### `POST /room/:id/game/play` (auth) — body `{hand_index, row, column}`
### `POST /room/:id/game/exchange` (auth) — body `{hand_index}` (a dead card, once per turn, before playing)
### `POST /room/:id/game/pass` (auth) — only when no card can be played or exchanged

Each applies the move for the current player, draws a replacement card, and returns the new GameView. Every change
broadcasts `game_updated`.

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
