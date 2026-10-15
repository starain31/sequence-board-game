-- How dead cards are handled at a table, chosen by its host.
--   dead_cards: 'manual' (players spot dead cards themselves and ask to exchange them) or 'indicator' (dead cards
--   are marked in the hand). Existing rooms keep the indicator they were created with; new rooms default to manual.
ALTER TABLE rooms ADD COLUMN dead_cards TEXT NOT NULL DEFAULT 'indicator' CHECK (dead_cards IN ('manual', 'indicator'));
ALTER TABLE rooms ALTER COLUMN dead_cards SET DEFAULT 'manual';

--   exchanges_per_turn: how many dead cards a player may exchange in one turn; NULL is unlimited. Existing rooms keep
--   the old rule of one per turn; new rooms default to unlimited.
ALTER TABLE rooms ADD COLUMN exchanges_per_turn SMALLINT DEFAULT 1 CHECK (exchanges_per_turn BETWEEN 1 AND 10);
ALTER TABLE rooms ALTER COLUMN exchanges_per_turn DROP DEFAULT;
