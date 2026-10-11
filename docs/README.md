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

Express 4 serves a small REST API plus static files from `public/`, with cookie sessions (`express-session`,
in memory) and a Socket.IO server attached to the same HTTP server. All data lives in process memory: two
hard-coded users, rooms in a module-level object, and one global game. There are **two separate game
implementations**: a clean, tested domain layer (`entity/` + `use_case/`) that is only used by the terminal
runners, and an older HTTP game (`controller/game.js`) that the API actually serves. Rooms and games are not
connected, nothing detects a completed sequence or a winner, and every valid move over HTTP currently fails
with a 500 error (see [known-issues.md](known-issues.md)).

## Status at a glance

| Area | State |
|---|---|
| Sign in / session | Works (hard-coded users) |
| Sign up | Stub, does nothing |
| Create/join room, live room updates | Works, with gaps |
| Start a game from a room | Not implemented |
| Play a move over HTTP | Broken (500 on every valid move) |
| Turn order, dealing, drawing | Only in `entity/` + `use_case/` (terminal runners) |
| Sequence detection, win condition, dead cards | Not implemented anywhere |
| Persistence | None, everything resets on restart |
| CORS | Not configured |
