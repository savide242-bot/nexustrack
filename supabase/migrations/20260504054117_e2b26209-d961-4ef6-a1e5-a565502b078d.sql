
-- Restrict Realtime Broadcast/Presence: deny by default.
-- Postgres_changes still works because it relies on RLS of source tables.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny all broadcast/presence by default" ON realtime.messages;
CREATE POLICY "Deny all broadcast/presence by default"
  ON realtime.messages
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);
