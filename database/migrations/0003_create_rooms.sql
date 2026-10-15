-- A table people sit at. `id` is the code players share (a numeric string today).
CREATE TABLE rooms (
    id               TEXT        PRIMARY KEY,
    administrator_id BIGINT      NOT NULL REFERENCES users (id),
    team_count       SMALLINT    NOT NULL CHECK (team_count BETWEEN 2 AND 3),
    players_per_team SMALLINT    NOT NULL CHECK (players_per_team BETWEEN 1 AND 6),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Who took which seat. Rows are only ever added: seats are kept after the game, as the room's history.
CREATE TABLE room_seats (
    room_id   TEXT        NOT NULL REFERENCES rooms (id),
    team      SMALLINT    NOT NULL CHECK (team >= 0),
    seat      SMALLINT    NOT NULL CHECK (seat >= 0),
    user_id   BIGINT      NOT NULL REFERENCES users (id),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (room_id, team, seat),
    -- One seat per player per room.
    UNIQUE (room_id, user_id)
);

-- "My tables": the rooms a user sat at or created.
CREATE INDEX room_seats_user_index ON room_seats (user_id);
CREATE INDEX rooms_administrator_index ON rooms (administrator_id);
