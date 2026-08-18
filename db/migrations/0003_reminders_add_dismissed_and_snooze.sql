-- Migration 0003: reminders — add dismissed/snooze/updated_at columns
-- Safe to run multiple times (idempotent). Corrects migration 0002, which
-- assumed `reminders` would be created fresh by CREATE TABLE IF NOT EXISTS.
-- In practice the table already existed (from the original db/schema.sql,
-- with only id/event_id/remind_at/method/created_at/completed/dispatched_at),
-- so 0002's CREATE TABLE silently no-op'd and its dismissed-column index
-- failed. This migration adds the missing columns/constraint instead.


BEGIN;


-- 1. Add the columns migration 0002 needed but never actually added,
--    since the table already pre-existed.
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS dismissed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS snoozed_from_id INTEGER REFERENCES reminders(id) ON DELETE SET NULL;
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();


-- 2. completed/method existed already from the original schema but
--    without NOT NULL — normalize any legacy NULLs before tightening.
UPDATE reminders SET completed = false WHERE completed IS NULL;
ALTER TABLE reminders ALTER COLUMN completed SET NOT NULL;
ALTER TABLE reminders ALTER COLUMN completed SET DEFAULT false;


UPDATE reminders SET method = 'push' WHERE method IS NULL;
ALTER TABLE reminders ALTER COLUMN method SET NOT NULL;
ALTER TABLE reminders ALTER COLUMN method SET DEFAULT 'push';


-- 3. Restrict method to supported delivery types, if the constraint
--    doesn't exist yet.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'reminders_method_check'
    ) THEN
        ALTER TABLE reminders
        ADD CONSTRAINT reminders_method_check
        CHECK (method IN ('push', 'web_push'));
    END IF;
END $$;


-- 4. Indexes that 0002 failed to create because of the missing column.
CREATE INDEX IF NOT EXISTS idx_reminders_due
ON reminders (remind_at)
WHERE completed = false AND dismissed = false;


CREATE INDEX IF NOT EXISTS idx_reminders_event_id ON reminders (event_id);


COMMIT;
