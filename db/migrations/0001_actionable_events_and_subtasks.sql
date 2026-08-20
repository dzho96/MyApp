-- Migration 0001: actionable events + sub-tasks
-- Safe to run multiple times (idempotent). Run this against an existing
-- database that was created from an older version of db/schema.sql.

BEGIN;

-- 1. Add requires_action / completed to events, if not already present.
ALTER TABLE events ADD COLUMN IF NOT EXISTS requires_action BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS completed BOOLEAN NOT NULL DEFAULT false;

-- 2a. Normalize any legacy category values that predate the personal/work/games
--     set (e.g. 'school', 'game') so the new CHECK constraint doesn't fail.
--     Adjust this mapping if your data has other legacy values.
UPDATE events SET category = 'work' WHERE category = 'school';
UPDATE events SET category = 'games' WHERE category = 'game';
UPDATE events SET category = NULL WHERE category IS NOT NULL
    AND category NOT IN ('personal', 'work', 'games');

-- 2b. Restrict category to personal/work/games, if the constraint doesn't exist yet.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'events_category_check'
    ) THEN
        ALTER TABLE events
        ADD CONSTRAINT events_category_check
        CHECK (category IN ('personal', 'work', 'games'));
    END IF;
END $$;

-- 3. Index to speed up dashboard lane queries (overdue/today/upcoming).
CREATE INDEX IF NOT EXISTS idx_events_actionable_incomplete
ON events (requires_action, completed, start_time, end_time);

-- 4. Sub-tasks table.
CREATE TABLE IF NOT EXISTS event_tasks (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT false,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_tasks_event_id ON event_tasks (event_id);

COMMIT;
