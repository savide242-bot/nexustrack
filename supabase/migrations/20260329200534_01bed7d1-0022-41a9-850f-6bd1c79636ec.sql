-- New table: pages
CREATE TABLE public.pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  url text NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own pages" ON public.pages FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- New table: capi_events_log
CREATE TABLE public.capi_events_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE,
  event_name text NOT NULL,
  event_id text NOT NULL,
  payload jsonb,
  status text DEFAULT 'sent',
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.capi_events_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own capi events" ON public.capi_events_log FOR SELECT USING (
  EXISTS (SELECT 1 FROM campaigns c WHERE c.id = capi_events_log.campaign_id AND c.user_id = auth.uid())
);
CREATE POLICY "System can insert capi events" ON public.capi_events_log FOR INSERT WITH CHECK (true);

-- Add FB columns to campaigns
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS fb_access_token text;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS fb_ad_account_id text;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications_log;