-- How the room's game is played: `standard`, or `training`, where the player whose turn it is gets hints.
ALTER TABLE rooms ADD COLUMN game_mode TEXT NOT NULL DEFAULT 'standard' CHECK (game_mode IN ('standard', 'training'));
