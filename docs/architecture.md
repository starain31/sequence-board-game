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
npm test             # jest: entity/*.spec.js (7 tests, all pass)
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
  board.js            serves data/board_deck.json (module singleton, also used as live board state)
  game.js             LEGACY global game: 4 hard-coded players, deal on module load, play endpoint
  index.js            Dead code (unattached socket.io instance, unused inquirer controller)
database/
  users.js            Hard-coded users: jabir/1, sakib/123 → {name, password}
  rooms.js            In-memory rooms keyed by id
entity/               CLEAN domain layer (tested), not wired to HTTP
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

## Two game implementations

| | `entity/` + `use_case/` | `controller/game.js` |
|---|---|---|
| Used by | Terminal runners and tests | HTTP API (`/game/*`) |
| Players | From the `teams` argument | Hard-coded: jabir, sakib (`team1`), habiba, humaira (`team2`) |
| Dealing | Official counts by player count | 5 cards each |
| Turn order | Enforced, teams alternate | None |
| Draw after play | Yes | No |
| Corners | Rejected as targets | Not checked |
| Board state | Per-game copy | Mutates the shared `data/board_deck.json` module, which `/board/deck` returns |
| Works? | Yes | No, `current_team` is never defined, so valid moves throw |

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
