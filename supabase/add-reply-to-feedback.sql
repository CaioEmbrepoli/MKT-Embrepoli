ALTER TABLE feedback ADD COLUMN IF NOT EXISTS reply text;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS replied_by text;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS replied_at timestamptz;
