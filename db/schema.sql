-- Initial PostgreSQL schema (simplified)

CREATE TABLE users (
id SERIAL PRIMARY KEY,
username TEXT NOT NULL UNIQUE,
email TEXT,
created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE games (
id SERIAL PRIMARY KEY,
name TEXT NOT NULL,
created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE events (
id SERIAL PRIMARY KEY,
game_id INTEGER REFERENCES games(id),
user_id INTEGER REFERENCES users(id),
name TEXT NOT NULL,
description TEXT,
start_time TIMESTAMP WITH TIME ZONE,
end_time TIMESTAMP WITH TIME ZONE,
category TEXT CHECK (category IN ('personal', 'work', 'games')),
source TEXT,
source_url TEXT,
is_automatic BOOLEAN DEFAULT false,
is_confirmed BOOLEAN DEFAULT false,
requires_action BOOLEAN NOT NULL DEFAULT false,
completed BOOLEAN NOT NULL DEFAULT false,
created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE event_tasks (
id SERIAL PRIMARY KEY,
event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
name TEXT NOT NULL,
completed BOOLEAN NOT NULL DEFAULT false,
sort_order INTEGER NOT NULL DEFAULT 0,
created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_tasks_event_id ON event_tasks (event_id);

CREATE TABLE reminders (
id SERIAL PRIMARY KEY,
event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
remind_at TIMESTAMP WITH TIME ZONE NOT NULL,
method TEXT DEFAULT 'push',
created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
completed BOOLEAN DEFAULT false,
dispatched_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE recurring_events (
id SERIAL PRIMARY KEY,
event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
rrule TEXT NOT NULL,
created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE notifications (
id SERIAL PRIMARY KEY,
reminder_id INTEGER REFERENCES reminders(id) ON DELETE SET NULL,
event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,
user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
type TEXT DEFAULT 'reminder',
payload JSONB,
sent BOOLEAN DEFAULT false,
created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Helpful index for dashboard lane queries (overdue / today / upcoming)
CREATE INDEX IF NOT EXISTS idx_events_actionable_incomplete
ON events (requires_action, completed, start_time, end_time);
