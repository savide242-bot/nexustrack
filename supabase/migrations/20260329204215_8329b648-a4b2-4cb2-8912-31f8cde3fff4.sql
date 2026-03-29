
-- Drop unique constraint on transaction_id to allow duplicate webhooks
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_transaction_id_key;

-- Restrict INSERT on sales to service role only (anon cannot insert)
DROP POLICY IF EXISTS "System can insert sales" ON sales;
CREATE POLICY "Service role inserts sales" ON sales
  FOR INSERT TO anon
  WITH CHECK (false);

-- Restrict INSERT on capi_events_log to service role only
DROP POLICY IF EXISTS "System can insert capi events" ON capi_events_log;
CREATE POLICY "Service role inserts capi events" ON capi_events_log
  FOR INSERT TO anon
  WITH CHECK (false);
