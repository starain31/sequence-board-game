CREATE TABLE users (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    -- Stored normalised (trimmed, lower case), so uniqueness is case-insensitive.
    handle        TEXT        NOT NULL UNIQUE CHECK (handle ~ '^[a-z0-9_]{3,20}$'),
    name          TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 50),
    -- `scrypt$<N>$<r>$<p>$<salt>$<hash>`, see entity/user.js. Never sent to clients.
    password_hash TEXT        NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
