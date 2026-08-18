-- Migration 0002: reminders
-- Safe to run multiple times (idempotent). Adds a reminders table so
-- events can have one or more scheduled notification times, independent
-- of the event's own start_time/end_time. Supports the mobile push
-- notification and snooze features.


BEGIN;


-- 1. Reminders table. Each row is a single scheduled notification for an
--    event. Multiple reminders per event are allowed (e.g. "3 days before"
--    and "1 hour before" for the same deadline).
CREATE TABLE IF NOT EXISTS reminders (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    remind_at TIMESTAMP WITH TIME ZONE NOT NULL,
    method TEXT NOT NULL DEFAULT 'push',
    completed BOOLEAN NOT NULL DEFAULT false,
    dismissed BOOLEAN NOT NULL DEFAULT false,
    dispatched_at TIMESTAMP WITH TIME ZONE,
    snoozed_from_id INTEGER REFERENCES reminders(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);


-- 2. Restrict method to supported delivery types, if the constraint
--    doesn't exist yet. 'push' is the only mobile-native type today;
--    'web_push' is reserved for a future PC/web notification feature.
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


-- 3. Indexes to speed up "reminders due soon" polling/dispatch queries
--    and per-event reminder lookups (used by the event detail screen).
CREATE INDEX IF NOT EXISTS idx_reminders_due
ON reminders (remind_at)
WHERE completed = false AND dismissed = false;


CREATE INDEX IF NOT EXISTS idx_reminders_event_id ON reminders (event_id);


COMMIT;
