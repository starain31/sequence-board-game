-- New rooms play without legal-cell highlights and without move history unless the host turns them on.
-- Existing rooms keep the settings they were created with.
ALTER TABLE rooms ALTER COLUMN history_enabled SET DEFAULT false;
ALTER TABLE rooms ALTER COLUMN highlights_enabled SET DEFAULT false;
