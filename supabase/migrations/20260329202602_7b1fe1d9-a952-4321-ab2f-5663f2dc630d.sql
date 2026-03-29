
-- Add global tracking fields to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS meta_pixel_id text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS meta_access_token text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hotmart_token text;

-- Make campaign_id nullable in leads_clicks and cta_clicks
ALTER TABLE leads_clicks ALTER COLUMN campaign_id DROP NOT NULL;
ALTER TABLE cta_clicks ALTER COLUMN campaign_id DROP NOT NULL;

-- Add page_id to leads_clicks for page-based tracking
ALTER TABLE leads_clicks ADD COLUMN IF NOT EXISTS page_id uuid;
ALTER TABLE cta_clicks ADD COLUMN IF NOT EXISTS page_id uuid;

-- Add user_id to sales for direct ownership
ALTER TABLE sales ADD COLUMN IF NOT EXISTS user_id uuid;

-- Fix RLS on sales to support sales without campaign_id
DROP POLICY IF EXISTS "Users can view own sales" ON sales;
CREATE POLICY "Users can view own sales" ON sales
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM campaigns c
      WHERE c.id = sales.campaign_id AND c.user_id = auth.uid()
    )
  );

-- Fix RLS on leads_clicks to support leads without campaign_id (page-based)
DROP POLICY IF EXISTS "Users can view own leads" ON leads_clicks;
CREATE POLICY "Users can view own leads" ON leads_clicks
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campaigns c
      WHERE c.id = leads_clicks.campaign_id AND c.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM pages p
      WHERE p.id = leads_clicks.page_id AND p.user_id = auth.uid()
    )
  );

-- Fix RLS on cta_clicks to support clicks without campaign_id
DROP POLICY IF EXISTS "Users can view own cta_clicks" ON cta_clicks;
CREATE POLICY "Users can view own cta_clicks" ON cta_clicks
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campaigns c
      WHERE c.id = cta_clicks.campaign_id AND c.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM pages p
      WHERE p.id = cta_clicks.page_id AND p.user_id = auth.uid()
    )
  );

-- Fix RLS on capi_events_log to support events without campaign_id
DROP POLICY IF EXISTS "Users can view own capi events" ON capi_events_log;
ALTER TABLE capi_events_log ADD COLUMN IF NOT EXISTS user_id uuid;
CREATE POLICY "Users can view own capi events" ON capi_events_log
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM campaigns c
      WHERE c.id = capi_events_log.campaign_id AND c.user_id = auth.uid()
    )
  );
