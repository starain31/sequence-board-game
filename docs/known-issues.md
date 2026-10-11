# Known issues

Confirmed by running the server and calling it with curl. Highest impact first.

## Breaks the game

1. **Every valid move fails.** `controller/game.js` reads and writes `current_team`, which is never declared,
   so `GET /game/play` throws a `ReferenceError` and returns `500`. It also calls `alternate_team`, which
   doesn't exist.
2. **Rooms and games are not connected.** There is no way to start a game from a room. The HTTP game uses
   4 hard-coded players and one global board shared by the whole server.
3. **No sequence detection or win condition**, in either implementation.
4. **The HTTP game has no turn order and no drawing.** Any player can move at any time, and played cards are
   never replaced.

## Stability

5. `GET /user/profile` without a session **crashes the Node process** (`user` is undefined inside an unhandled
   promise).
6. `GET /game/hand_cards` with an unknown handle returns `500`. A missing room returns `200` with an empty body.
7. Errors come back as Express's HTML error page, and status codes are not meaningful (`404` for an invalid
   move, `200` for a failed join).

## Security

8. Room payloads (HTTP and the `room_updated` broadcast) include users' **plain-text passwords**.
9. `room_updated` is sent to every connected socket, not just members of that room.
10. Hands are readable by anyone (`player_handler` comes from the query string, not the session), and play is
    a state-changing `GET`.
11. Hard-coded session secret. Users are hard-coded with plain-text passwords. Signup is a stub.

## Data integrity

12. `room/create` works without a session (`administrator` is undefined) and doesn't validate the team or
    player counts, so a room can be configured in a way `entity/` would reject.
13. The same user can occupy several seats. Joining without a session reports `success` but fills nothing.
14. The legacy game mutates the `require`d `data/board_deck.json` module, so the "static" board data *is*
    the live state.
15. In `entity/`, an unsupported total player count (for example 15) silently deals no cards.

## Tooling

16. `socket.io` is pinned to `latest`, and `package-lock.json` is git-ignored, so installs are not
    reproducible and CI's `npm ci` has no lockfile.
17. `controller/index.js` is dead code. `public/views/room.html` is empty, `signin.html` posts to `/signin`
    (the real route is `/user/signin`), and the prototype UI loads an unpinned Vue from unpkg (now Vue 3,
    while the code is written for Vue 2).
