-- A room's code (`id`) is now a slug of its name, e.g. "friday-night-k3m9". Older rooms keep their numeric
-- codes, which are slugs too, so links to them keep working.
ALTER TABLE rooms ADD CONSTRAINT rooms_id_is_slug CHECK (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

-- The name players see. Older rooms are named after their code.
ALTER TABLE rooms ADD COLUMN name TEXT;
UPDATE rooms SET name = 'Table ' || id;
ALTER TABLE rooms ALTER COLUMN name SET NOT NULL;
ALTER TABLE rooms ADD CONSTRAINT rooms_name_length CHECK (char_length(name) BETWEEN 1 AND 40);

-- Settings chosen by the room's creator. They can change until the game starts, then they are fixed.
ALTER TABLE rooms ADD COLUMN history_enabled    BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE rooms ADD COLUMN highlights_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE rooms ADD COLUMN auto_draw_dead     BOOLEAN NOT NULL DEFAULT false;
