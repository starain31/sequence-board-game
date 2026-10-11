# Game domain

## Cards

A card is `{name}`, where name is `<rank>-<Suit>`:
- rank: `2`–`10`, `J`, `Q`, `K`, `A`
- Suit: `Club`, `Diamond`, `Heart`, `Spade` (capitalised, singular)
- Board corners are the special name `Blank`.

The draw deck (`data/game_deck.json`) is 104 cards: every card twice, no jokers.

Jacks never appear on the board:
- **Two-eyed jacks** (`J-Club`, `J-Diamond`) are wild: place a chip on any unoccupied cell.
- **One-eyed jacks** (`J-Spade`, `J-Heart`) remove an opponent's chip.

## Board

`data/board_deck.json` is `Cell[10][10]`, indexed `[row][column]` from the top-left, `Cell = {name, occupied_by?}`.
`occupied_by` is the team handle that owns the chip; it is absent when the cell is empty. Every non-jack card
appears exactly twice. `**` below is `Blank` (the corners); D, H, S, C are the suits.

```
     0   1   2   3   4   5   6   7   8   9
0   **  6D  7D  8D  9D 10D  QD  KD  AD  **
1   5D  3H  2H  2S  3S  4S  5S  6S  7S  AC
2   4D  4H  KD  AD  AC  KC  QC 10C  8S  KC
3   3D  5H  QD  QH 10H  9H  8H  9C  9S  QC
4   2D  6H 10D  KH  3H  2H  7H  8C 10S 10C
5   AS  7H  9D  AH  4H  5H  6H  7C  QS  9C
6   KS  8H  8D  2C  3C  4C  5C  6C  KS  8C
7   QS  9H  7D  6D  5D  4D  3D  2D  AS  7C
8  10S 10H  QH  KH  AH  2C  3C  4C  5C  6C
9   **  9S  8S  7S  6S  5S  4S  3S  2S  **
```

## Move rules the code enforces

Validation in `entity/board.js` (`play` throws `'INVALID_MOVE'`); `controller/game.js` has the same logic
without the corner check:

| Hand card | Valid when | Effect |
|---|---|---|
| Normal card | Cell name equals card name and cell is empty | `occupied_by = team` |
| Two-eyed jack | Cell is empty (and not `Blank` in `entity/`) | `occupied_by = team` |
| One-eyed jack | Cell is occupied by another team | chip removed |
| Any | Target is `Blank` | invalid (`entity/` only) |

## Teams, seating, dealing (`entity/` only)

- 2 or 3 teams, the same number of players in each, 1–6 per team. Otherwise it throws
  `INVALID_NUMBER_OF_TEAM` / `INVALID_NUMBER_OF_PLAYER`.
- Seating alternates teams (T1, T2, [T3,] T1, T2, …). Within a team, players are taken from the **end** of
  the `players` array.
- Cards per player by total player count: 2→7, 3→6, 4→6, 6→5, 8→4, 9→4, 10→3, 12→3. Any other total
  (for example 3 teams × 5 players = 15) deals **zero cards** without an error.
- A turn: play `hand[i]` on `(row, column)`, then draw from the deck into the same hand slot, then the next
  player. An invalid move logs the error and the same player retries.

## Official rules that are not implemented

Compare with the [official rules](https://en.wikipedia.org/wiki/Sequence_(game)):
- **Sequences**: detecting 5 in a row (horizontal, vertical, diagonal), locking them, and allowing one chip to
  be shared by two sequences.
- **Win condition**: 2 sequences with 2 teams, 1 with 3 teams. There is no game-over state at all.
- **Corners as free chips** that count for every team. Here they simply can't be played.
- **Protection**: a one-eyed jack must not remove a chip that is part of a completed sequence.
- **Dead cards**: exchanging a card whose two board cells are both taken.
- Deck exhaustion (`deck.pop()` returns `undefined` once the deck is empty).
