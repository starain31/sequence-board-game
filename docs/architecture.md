# Architecture

## Stack

Node.js, Express `~4.16`, `express-session` (stored in PostgreSQL by `connect-pg-simple`), `express-rate-limit`, `socket.io` (declared as `latest`, locked
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
npm run db:seed      # create the development accounts jabir/1 and sakib/123 (compose does this itself)
npm run dev          # nodemon
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
same time. To change the schema, add the next numbered file (`0005_add_something.sql`); never edit one that has
been applied.

## Layout

```
bin/www               Applies migrations, then HTTP server, attaches Socket.IO, listens on PORT
app.js                Express app: morgan, JSON/urlencoded body, static public/, session, /health, routers
docker-compose.yml    Development environment: Postgres, backend, frontend
socket.js             Single Socket.IO server + broadcast({event, data}) to every connected socket

routes/               Thin routers: user, room, game, board
controller/
  user.js             signup, signin, signout, profile (JSON errors)
  room.js             create / get / join room, change its settings (host only), broadcasts room_updated
  room_game.js        start a table's game, view it, play / exchange / pass; broadcasts game_updated
  board.js            serves data/board_deck.json (module singleton, also used as live board state)
  game.js             LEGACY global game: 4 hard-coded players, deal on module load, play endpoint
  index.js            Dead code (unattached socket.io instance, unused inquirer controller)
database/
  pool.js             PostgreSQL connection pool (DATABASE_URL) and ping() for /health
  migrate.js          SQL migration runner (also `npm run db:migrate`), tested in migrate.spec.js
  migrations/         Numbered .sql files: 0001 users, 0002 session, 0003 rooms + room_seats, 0004 games + turns,
                      0005 room names, slug codes and settings, 0006 game mode,
                      0007 highlights and history off by default, 0008 turn timer
  users.js            Accounts in the users table; only find_credentials() reads password_hash
  seed.js             Development accounts jabir/1, sakib/123 (`npm run db:seed`)
  test_database.js    Gives a spec its own migrated schema (needs DATABASE_URL)
  rooms.js            Rooms and seats; join() takes a seat under a room lock; list_for_user() for history
  games.js            Table game state (JSONB) and the turns history; kept apart so room payloads never carry hands
entity/               Domain layer (tested)
  user.js             Sign-up rules, scrypt password hashing
  room.js             Room names, slug codes and settings (defaults and parsing), game modes
  hints.js            Training hints: suggest_move() for the current player
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
| Board state | Per-game, immutable updates, stored in PostgreSQL | Per-game copy | Mutates the shared `data/board_deck.json` module, which `/board/deck` returns |

The `use_case` loop talks to the outside world through a controller object:
`next_move() → {hand_card_index, row, column} | undefined` (undefined ends the game),
`broadcast_board({board})`, `log({message})`, `error({message})`. A web adapter could implement the same interface.

## State and lifetime

Accounts, sessions, rooms, seats, table games and their turns are stored in PostgreSQL and survive restarts.
Only the legacy developer game is still in memory and lost on restart (dealt once when
`controller/game.js` is first required, at server start), and the board. There is one global HTTP game for
the whole server, not one per room.

## Rooms, games and history

| Table | One row per | Notes |
|---|---|---|
| `rooms` | table | Code (`id`, a slug of the name such as `friday-night-k3m9`; older rooms have numeric codes), name, creator, team layout, settings (`game_mode`, `history_enabled`, `highlights_enabled`, `auto_draw_dead`, `turn_seconds`), creation time |
| `room_seats` | taken seat | Primary key (room, team, seat) and unique (room, user): one player per seat, one seat per player |
| `games` | room's game | Full rules state as JSONB (hands and deck included, so only `view_for()` output is ever sent), started / updated / finished time, winning team |
| `turns` | accepted move | Append-only: move number, game turn, player, team, kind, card, cell, and the log events the move produced |

A move is one transaction in `controller/room_game.js`: read the game `FOR UPDATE`, apply the rules
(`entity/sequence_game.js`), then `record_move()` saves the new state and appends the turn. A rejected move
changes nothing, and moves on one table can't interleave. Joining and starting lock the room row the same way.

Settings can change (by the room's creator) until the game starts, then they are fixed. Rules that change play
(`auto_draw_dead`) are also copied into the game state's `rules` when it is dealt, so a resumed game always plays by
the rules it started with. Display settings (`mode`, `history`, `highlights`) are read from the room for every GameView; in a training room
the current player's view also carries a hint from `entity/hints.js`. Only the host can start the game.
With history off, `turns` is still written (the "Your tables" move count uses it) but never served.

The rules engine has no clock: `controller/room_game.js` stamps `turn_started_at` into the stored state whenever
a new turn begins (an exchange keeps the turn and its time), so turn timers survive restarts too.

Everything a client needs to resume is in these tables: who sat where, the settings, and the full game state.
After a restart, `GET /user/rooms` lists a player's tables and `GET /room/:id/game` returns the game as it was.

The game state also carries its own `log`, which the GameView shows; `turns` is the queryable history of the same
moves, keyed to user ids rather than display names.

## Sessions

Cookie `connect.sid`: HttpOnly, `SameSite=Lax`, expires after 7 days without a request (rolling). The session
row lives in the `session` table, holds only `handle`, and is deleted by `POST /user/signout`. There is no
CORS middleware, so a frontend on another origin needs a same-origin proxy (the frontend's Vite dev server is one).

Passwords are hashed with scrypt (`entity/user.js`). The hash string records its salt and cost parameters,
so the cost can be raised without breaking existing accounts. Sign-in and sign-up are rate limited per client
IP in memory (see [api.md](api.md#user)); limits reset when the server restarts.

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | the compose database on localhost | PostgreSQL connection |
| `SESSION_SECRET` | a fixed development value | Signs the session cookie. **Required** when `NODE_ENV=production` |
| `COOKIE_SECURE` | off | `true` adds the `Secure` flag; set it when serving over HTTPS |
| `TRUST_PROXY` | off | Express `trust proxy` (e.g. `1`), so rate limits see client IPs behind a reverse proxy |
| `PORT` | `3000` | HTTP port |
