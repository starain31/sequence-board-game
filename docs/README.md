# Sequence backend — docs

Node.js/Express backend for the card-and-board game [Sequence](https://en.wikipedia.org/wiki/Sequence_(game)).
These docs describe the code as of commit `c42b27f` (branch `development`) so an agent or developer can work with
the project without reading the source.

| File | What it covers |
|---|---|
| [architecture.md](architecture.md) | Layers, files, where state lives, how to run |
| [api.md](api.md) | HTTP endpoints and Socket.IO events (the frontend contract) |
| [game-domain.md](game-domain.md) | Cards, board layout, rules the code enforces and rules it doesn't |
| [known-issues.md](known-issues.md) | Bugs and gaps confirmed by running the server |

## In one paragraph

Express 4 serves a small REST API plus static files from `public/`, with cookie sessions (`express-session`)
and a Socket.IO server attached to the same HTTP server. Accounts, sessions, rooms, games and every move are
stored in PostgreSQL. Games are played at a room's table (`entity/sequence_game.js`: dealing, turns, jacks,
dead cards, sequences, winning). An older global test game (`controller/game.js`) and a terminal-only domain layer
(`entity/` + `use_case/`) also remain; see [architecture.md](architecture.md#three-game-implementations) and
[known-issues.md](known-issues.md).

## Status at a glance

| Area | State |
|---|---|
| Sign up / sign in / sign out | Works; accounts and sessions in PostgreSQL, scrypt hashes, rate limited |
| Create/join room, live room updates | Works; named tables with slug codes and host-set options |
| Room options | Standard or training mode (hints), move history, legal-move highlights, dead-card auto-draw |
| Start a game from a room, play it | Works (`/room/:id/start` by the host, `/room/:id/game/*`) |
| Turn order, dealing, drawing, sequences, winning, dead cards | Works in table games (`entity/sequence_game.js`) |
| Persistence | Accounts, sessions, rooms, seats, settings, games and turn history (only the legacy dev game is in memory) |
| CORS | Not configured |
| Local environment | `docker compose up` (Postgres, backend, frontend), see [architecture.md](architecture.md#run) |
