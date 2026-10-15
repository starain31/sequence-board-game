# Known issues

Confirmed by running the server and calling it with curl. Highest impact first.

## Breaks the game

1. ~~Every valid move fails~~ (fixed: the legacy game uses the player's team and draws a replacement card).
2. ~~Rooms and games are not connected~~ (fixed: `POST /room/:id/start` and the table game endpoints, see
   [api.md](api.md#table-game)). The legacy `/game/*` endpoints still use 4 hard-coded players and one global board.
3. ~~No sequence detection or win condition~~ (fixed in the table game; the legacy game still has none).
4. **The legacy HTTP game has no turn order.** Any player can move at any time. The table game enforces turns.

## Stability

5. ~~`GET /user/profile` without a session crashes the Node process~~ (fixed: `401 NOT_SIGNED_IN`).
6. `GET /game/hand_cards` with an unknown handle returns `500`. A missing room returns `200` with an empty body.
7. Errors come back as Express's HTML error page, and status codes are not meaningful (`404` for an invalid
   move, `200` for a failed join).

## Security

8. ~~Room payloads include plain-text passwords~~ (fixed: seats store only `handle` and `name`).
9. `room_updated` is sent to every connected socket, not just members of that room.
10. Hands are readable by anyone (`player_handler` comes from the query string, not the session), and play is
    a state-changing `GET`.
11. ~~Hard-coded session secret, plain-text passwords, stub signup~~ (fixed: `SESSION_SECRET`, scrypt hashes in
    PostgreSQL, working sign-up).

## Data integrity

12. ~~`room/create` works without a session and doesn't validate the team or player counts~~ (fixed:
    `401 NOT_SIGNED_IN`, `400 UNSUPPORTED_TABLE`).
13. ~~The same user can occupy several seats~~ (fixed: `ALREADY_SEATED`; joining without a session is `NOT_SIGNED_IN`).
14. The legacy game mutates the `require`d `data/board_deck.json` module, so the "static" board data *is*
    the live state. (It also used to empty the shared `data/game_deck.json` array while shuffling, which left table
    games with no cards; it now shuffles a copy.)
15. In `entity/`, an unsupported total player count (for example 15) silently deals no cards.

## Tooling

16. `socket.io` is declared as `latest`. The committed `package-lock.json` keeps it on 2.3.0, but any
    `npm install` that re-resolves it can jump a major (the frontend pins `socket.io-client@2.3.0`).
17. `controller/index.js` is dead code. `public/views/room.html` is empty, `signin.html` posts to `/signin`
    (the real route is `/user/signin`), and the prototype UI loads an unpinned Vue from unpkg (now Vue 3,
    while the code is written for Vue 2).
