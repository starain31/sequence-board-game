-- When the current turn's timer runs out (turn start + the room's turn_seconds). Null once the game is over, and
-- for games from before turn timers until their next move.
ALTER TABLE games ADD COLUMN turn_deadline TIMESTAMPTZ;

-- The sweeper looks for games in progress whose deadline has passed.
CREATE INDEX games_turn_deadline_index ON games (turn_deadline) WHERE finished_at IS NULL;

-- Moves made for a player whose turn timer ran out.
ALTER TABLE turns ADD COLUMN timed_out BOOLEAN NOT NULL DEFAULT false;
