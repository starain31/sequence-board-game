-- The game played at a room (one per room).
CREATE TABLE games (
    id          BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    room_id     TEXT        NOT NULL UNIQUE REFERENCES rooms (id),
    -- The full rules state from entity/sequence_game.js, enough to resume after a restart. It includes every
    -- hand and the deck order, so it is never sent as is: view_for() picks what each player may see.
    state       JSONB       NOT NULL,
    winner_team SMALLINT,
    started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ,
    CHECK ((winner_team IS NULL) = (finished_at IS NULL))
);

-- Every accepted move, in order. Append-only: rows are never updated or deleted.
CREATE TABLE turns (
    game_id     BIGINT      NOT NULL REFERENCES games (id),
    -- 1, 2, 3… across the game. `turn` is the game's turn counter: an exchange shares it with the play after it.
    move_number INTEGER     NOT NULL CHECK (move_number > 0),
    turn        INTEGER     NOT NULL CHECK (turn > 0),
    user_id     BIGINT      NOT NULL REFERENCES users (id),
    team        SMALLINT    NOT NULL,
    kind        TEXT        NOT NULL CHECK (kind IN ('play', 'exchange', 'pass')),
    -- The card played or exchanged (public once used); null for a pass.
    card        TEXT,
    cell_row    SMALLINT,
    cell_column SMALLINT,
    -- What the move did, as game log entries: place/remove, then any sequence and win.
    events      JSONB       NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (game_id, move_number),
    CHECK ((kind = 'pass') = (card IS NULL)),
    CHECK ((kind = 'play') = (cell_row IS NOT NULL AND cell_column IS NOT NULL))
);
