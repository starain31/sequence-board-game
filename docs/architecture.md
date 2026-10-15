# Architecture

## Stack

Node.js, Express `~4.16`, `express-session` (default in-memory store), `socket.io` (version unpinned as
`latest`; check `node_modules/socket.io/package.json` to see which major you actually got, a fresh
install here resolved to 2.3.0), Jest for tests. CommonJS modules, no build step, no TypeScript, no database.
`package-lock.json` is git-ignored, so the `npm ci` step in the GitHub workflow has no lockfile to use.

## Run

```bash
npm install
npm start            # node ./bin/www, listens on PORT or 3000
npm test             # jest: entity/*.spec.js
npm run debug        # nodemon
npm run debug_1      # terminal game, moves read from console_controller/input.txt
npm run debug_2      # terminal game, moves typed interactively (inquirer)
```

## Layout

```
bin/www               HTTP server, attaches Socket.IO, listens on PORT
app.js                Express app: morgan, JSON/urlencoded body, static public/, session, routers
socket.js             Single Socket.IO server + broadcast({event, data}) to every connected socket

routes/               Thin routers: user, room, game, board
controller/
  user.js             signin (authenticate + service), profile
  room.js             create / get / join room, broadcasts room_updated
  room_game.js        start a table's game, view it, play / exchange / pass; broadcasts game_updated
  board.js            serves data/board_deck.json (module singleton, also used as live board state)
  game.js             LEGACY global game: 4 hard-coded players, deal on module load, play endpoint
  index.js            Dead code (unattached socket.io instance, unused inquirer controller)
database/
  users.js            Hard-coded users: jabir/1, sakib/123 → {name, password}
  rooms.js            In-memory rooms keyed by id; seats hold {handle, name}
  games.js            In-memory table games keyed by room id (kept apart so room payloads never carry hands)
entity/               Domain layer (tested)
  sequence_game.js    Full rules for table games: dealing, turns, jacks, dead cards, sequences, win. Wired to HTTP
  board.js            New_board(): get_deck, play, pretty_deck; move validation
  players.js          create_players({teams}): seating order, hands, team/player count validation
  game.js             initialize_game({teams}): board + players + shuffled deck + deal
use_case/game.js      start({teams, controller}): turn loop (play, draw, next player)
console_controller/   Terminal adapter: reads moves from input.txt
console_controller_2/ Terminal adapter: interactive prompts
data/
  board_deck.json     10×10 grid of {name}, see game-domain.md
  game_deck.json      104 cards (two 52-card decks, no jokers) as {name}
public/               Old Vue 2 prototype UI (index.html, views/, javascripts/) + card SVGs
```

## Three game implementations

| | `entity/sequence_game.js` | `entity/` + `use_case/` | `controller/game.js` |
|---|---|---|---|
| Used by | HTTP table games (`/room/:id/start`, `/room/:id/game/*`) | Terminal runners and tests | Legacy HTTP API (`/game/*`) |
| Players | A room's seats | From the `teams` argument | Hard-coded: jabir, sakib (`team1`), habiba, humaira (`team2`) |
| Dealing | Official counts by player count | Official counts by player count | 5 cards each |
| Turn order | Enforced | Enforced, teams alternate | None |
| Draw after play | Yes, reshuffles the discard pile | Yes | Yes |
| Sequences / win / dead cards | Yes | No | No |
| Board state | Per-game, immutable updates | Per-game copy | Mutates the shared `data/board_deck.json` module, which `/board/deck` returns |

The `use_case` loop talks to the outside world through a controller object:
`next_move() → {hand_card_index, row, column} | undefined` (undefined ends the game),
`broadcast_board({board})`, `log({message})`, `error({message})`. A web adapter could implement the same interface.

## State and lifetime

Everything is in memory and lost on restart: sessions, rooms, the legacy game (dealt once when
`controller/game.js` is first required, at server start), and the board. There is one global HTTP game for
the whole server, not one per room.

## Sessions

Cookie `connect.sid`, HttpOnly, 1-hour expiry, rolling. No `SameSite` or `Secure` flag is set, the secret is
hard-coded (`'work hard'`), and there is no CORS middleware. A frontend on another origin therefore needs a
same-origin dev proxy, or backend changes (CORS with credentials, cookie `SameSite`).
