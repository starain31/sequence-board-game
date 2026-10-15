# Architecture

## Stack

Node.js, Express `~4.16`, `express-session` (default in-memory store), `socket.io` (declared as `latest`, locked
to 2.3.0 by `package-lock.json`), PostgreSQL 16 through `pg` (plain SQL, no ORM), Jest for tests. CommonJS
modules, no build step, no TypeScript.

## Run

The whole development environment (PostgreSQL, this backend, and the frontend from the sibling
`../sequence-board-game-frontend` checkout) runs with Docker:

```bash
docker compose up            # frontend http://localhost:5173, backend http://localhost:3000, Postgres :5432
docker compose up db         # only Postgres, then run the backend on the host (below)
docker compose down -v       # stop everything and delete the database volume
```

Both app containers mount their source and reload on change (nodemon, Vite). They install dependencies with
`npm ci` into a container-only volume on each start, so the host's `node_modules` is not used. Change the host
ports with `DB_PORT`, `BACKEND_PORT`, `FRONTEND_PORT` (for example in a `.env` file next to `docker-compose.yml`).

On the host (needs Postgres, for example `docker compose up db`):

```bash
npm install
npm start            # node ./bin/www, applies migrations, listens on PORT or 3000
npm test             # jest; the database tests run only when DATABASE_URL is set
DATABASE_URL=postgres://sequence:sequence@localhost:5432/sequence npm test
npm run db:migrate   # apply pending migrations without starting the server
npm run debug        # nodemon
npm run debug_1      # terminal game, moves read from console_controller/input.txt
npm run debug_2      # terminal game, moves typed interactively (inquirer)
```

## Database

`DATABASE_URL` (default `postgres://sequence:sequence@localhost:5432/sequence`, the compose database) configures
the shared pool in `database/pool.js`. On boot, `bin/www` applies pending migrations and refuses to start if the
database is unreachable.

Migrations are plain SQL files in `database/migrations/`, applied in file name order, once each, by
`database/migrate.js`. Applied names are recorded in the `schema_migrations` table. Each file runs in its own
transaction, so a failing file leaves nothing behind, and an advisory lock serialises servers that start at the
same time. To change the schema, add the next numbered file (`0002_add_turns.sql`); never edit one that has
been applied.

## Layout

```
bin/www               Applies migrations, then HTTP server, attaches Socket.IO, listens on PORT
app.js                Express app: morgan, JSON/urlencoded body, static public/, session, /health, routers
docker-compose.yml    Development environment: Postgres, backend, frontend
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
  pool.js             PostgreSQL connection pool (DATABASE_URL) and ping() for /health
  migrate.js          SQL migration runner (also `npm run db:migrate`), tested in migrate.spec.js
  migrations/         Numbered .sql files (none yet)
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

PostgreSQL is wired in (see [Database](#database)), but no data uses it yet. Everything is still in memory and lost on restart: sessions, rooms, the legacy game (dealt once when
`controller/game.js` is first required, at server start), and the board. There is one global HTTP game for
the whole server, not one per room.

## Sessions

Cookie `connect.sid`, HttpOnly, 1-hour expiry, rolling. No `SameSite` or `Secure` flag is set, the secret is
hard-coded (`'work hard'`), and there is no CORS middleware. A frontend on another origin therefore needs a
same-origin dev proxy, or backend changes (CORS with credentials, cookie `SameSite`).
