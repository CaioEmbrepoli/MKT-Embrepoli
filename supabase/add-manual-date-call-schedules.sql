ALTER TABLE call_schedules ADD COLUMN IF NOT EXISTS manual_date boolean NOT NULL DEFAULT false;
