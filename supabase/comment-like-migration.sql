ALTER TABLE comments ADD COLUMN IF NOT EXISTS liked_by_org boolean NOT NULL DEFAULT false;
