CREATE POLICY "admins can delete feedback"
  ON feedback FOR DELETE
  USING (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()::text)
    AND (SELECT role FROM profiles WHERE id = auth.uid()::text) = 'admin'
  );
