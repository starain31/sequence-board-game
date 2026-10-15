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
and a Socket.IO server attached to the same HTTP server. Accounts and sessions are stored in PostgreSQL;
rooms and games still live in process memory. There are **two separate game
implementations**: a clean, tested domain layer (`entity/` + `use_case/`) that is only used by the terminal
runners, and an older HTTP game (`controller/game.js`) that the API actually serves. Rooms and games are not
connected, nothing detects a completed sequence or a winner, and every valid move over HTTP currently fails
with a 500 error (see [known-issues.md](known-issues.md)).

## Status at a glance

| Area | State |
|---|---|
| Sign up / sign in / sign out | Works; accounts and sessions in PostgreSQL, scrypt hashes, rate limited |
| Create/join room, live room updates | Works, with gaps |
| Start a game from a room | Not implemented |
| Play a move over HTTP | Broken (500 on every valid move) |
| Turn order, dealing, drawing | Only in `entity/` + `use_case/` (terminal runners) |
| Sequence detection, win condition, dead cards | Not implemented anywhere |
| Persistence | Accounts and sessions; rooms and games are still in memory |
| CORS | Not configured |
| Local environment | `docker compose up` (Postgres, backend, frontend), see [architecture.md](architecture.md#run) |
