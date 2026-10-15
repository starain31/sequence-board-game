# sequence-board-game
Sequence, an abstract strategy board-and-card game, was invented by Douglas Reuter in Owatonna, Minnesota, over a two-year period in the 1970s. Mr. Reuter originally called the game, "Sequence Five". Reuter spent years developing the concept, and, in June 1981, granted Jax Ltd. an exclusive license to manufacture, distribute and sell the board game, Sequence, and its subsequent variations. The game was first sold in a retail store in 1982.

## Development

With Docker, from this directory (the frontend repo must be checked out next to it as `../sequence-board-game-frontend`):

```bash
docker compose up
```

This starts PostgreSQL, this backend on http://localhost:3000 and the frontend on http://localhost:5173.
See [docs/architecture.md](docs/architecture.md#run) for running parts of it on the host, and [docs/](docs/README.md)
for the rest of the documentation.
