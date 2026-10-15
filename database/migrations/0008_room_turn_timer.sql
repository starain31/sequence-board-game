-- How long each player has for a turn, in seconds (presets 30-180 in entity/room.js, or any value in range).
ALTER TABLE rooms ADD COLUMN turn_seconds SMALLINT NOT NULL DEFAULT 90 CHECK (turn_seconds BETWEEN 15 AND 600);
