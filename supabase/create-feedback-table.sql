CREATE TABLE IF NOT EXISTS feedback (
  id              text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL,
  created_by      text NOT NULL,
  kind            text NOT NULL CHECK (kind IN ('duvida','problema','ideia')),
  description     text NOT NULL,
  attachments     jsonb NOT NULL DEFAULT '[]',
  status          text NOT NULL DEFAULT 'novo' CHECK (status IN ('novo','visto','resolvido')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can insert own feedback"
  ON feedback FOR INSERT
  WITH CHECK (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()::text));

CREATE POLICY "org members can read feedback"
  ON feedback FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()::text));
