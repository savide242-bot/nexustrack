-- ================================================================
-- NexusTrack Intelligence v2 — SCHEMA COMPLETO ATUALIZADO
-- Gerado em: 2026-10-11 19:35
-- Executa este ficheiro inteiro no SQL Editor do teu Supabase
-- ================================================================

-- ────────────────────────────────────────
-- Migração: 20260329185244_7aa93a2f-d4d9-4e8e-a30a-5014a6965e66.sql
-- ────────────────────────────────────────

-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  company TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Campaigns table
CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  domain TEXT,
  meta_pixel_id TEXT,
  meta_access_token TEXT,
  google_ads_id TEXT,
  tiktok_pixel_id TEXT,
  tiktok_access_token TEXT,
  hotmart_token TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own campaigns" ON public.campaigns FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Leads/Clicks table
CREATE TABLE public.leads_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  fingerprint TEXT,
  ip_address TEXT,
  user_agent TEXT,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  fbc TEXT,
  fbp TEXT,
  email TEXT,
  phone TEXT,
  name TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  zip_code TEXT,
  page_url TEXT,
  time_on_page INTEGER DEFAULT 0,
  lead_score INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.leads_clicks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own leads" ON public.leads_clicks FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND c.user_id = auth.uid()));
CREATE POLICY "Anyone can insert leads" ON public.leads_clicks FOR INSERT WITH CHECK (true);

-- CTA Clicks table
CREATE TABLE public.cta_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads_clicks(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  button_id TEXT,
  button_text TEXT,
  page_url TEXT,
  converted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cta_clicks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own cta_clicks" ON public.cta_clicks FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND c.user_id = auth.uid()));
CREATE POLICY "Anyone can insert cta_clicks" ON public.cta_clicks FOR INSERT WITH CHECK (true);

-- Sales table
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads_clicks(id) ON DELETE SET NULL,
  platform TEXT NOT NULL DEFAULT 'hotmart',
  transaction_id TEXT UNIQUE,
  buyer_name TEXT,
  buyer_email TEXT,
  buyer_phone TEXT,
  product_name TEXT,
  original_amount NUMERIC(12,2) NOT NULL,
  original_currency TEXT NOT NULL DEFAULT 'USD',
  exchange_rate NUMERIC(12,6),
  amount_mzn NUMERIC(12,2),
  status TEXT NOT NULL DEFAULT 'approved',
  hotmart_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own sales" ON public.sales FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND c.user_id = auth.uid()));
CREATE POLICY "System can insert sales" ON public.sales FOR INSERT WITH CHECK (true);

-- Notifications log
CREATE TABLE public.notifications_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT DEFAULT 'sent'
);
ALTER TABLE public.notifications_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own notifications" ON public.notifications_log FOR SELECT USING (auth.uid() = user_id);

-- Push subscriptions
CREATE TABLE public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own subscriptions" ON public.push_subscriptions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ────────────────────────────────────────
-- Migração: 20260329200534_01bed7d1-0022-41a9-850f-6bd1c79636ec.sql
-- ────────────────────────────────────────
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

-- ────────────────────────────────────────
-- Migração: 20260329202602_7b1fe1d9-a952-4321-ab2f-5663f2dc630d.sql
-- ────────────────────────────────────────

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


-- ────────────────────────────────────────
-- Migração: 20260329204215_8329b648-a4b2-4cb2-8912-31f8cde3fff4.sql
-- ────────────────────────────────────────

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


-- ────────────────────────────────────────
-- Migração: 20260329210511_71aab0da-89b8-46a0-9d80-eac9490d3029.sql
-- ────────────────────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS fb_ad_account_id text;

-- ────────────────────────────────────────
-- Migração: 20260329215429_31c3898e-4698-422c-b10e-5c202de77916.sql
-- ────────────────────────────────────────
-- Tighten leads_clicks INSERT: only allow if page_id or campaign_id actually exists
DROP POLICY IF EXISTS "Anyone can insert leads" ON public.leads_clicks;
CREATE POLICY "Anyone can insert leads"
  ON public.leads_clicks
  FOR INSERT
  TO public
  WITH CHECK (
    (campaign_id IS NULL OR EXISTS (SELECT 1 FROM campaigns c WHERE c.id = campaign_id))
    AND
    (page_id IS NULL OR EXISTS (SELECT 1 FROM pages p WHERE p.id = page_id))
    AND
    (campaign_id IS NOT NULL OR page_id IS NOT NULL)
  );

-- Tighten cta_clicks INSERT: only allow if page_id or campaign_id actually exists
DROP POLICY IF EXISTS "Anyone can insert cta_clicks" ON public.cta_clicks;
CREATE POLICY "Anyone can insert cta_clicks"
  ON public.cta_clicks
  FOR INSERT
  TO public
  WITH CHECK (
    (campaign_id IS NULL OR EXISTS (SELECT 1 FROM campaigns c WHERE c.id = campaign_id))
    AND
    (page_id IS NULL OR EXISTS (SELECT 1 FROM pages p WHERE p.id = page_id))
    AND
    (campaign_id IS NOT NULL OR page_id IS NOT NULL)
  );

-- ────────────────────────────────────────
-- Migração: 20260330002122_c50c7719-9c78-4593-a1cf-e0a40a18ccf2.sql
-- ────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.capi_events_log;

-- ────────────────────────────────────────
-- Migração: 20260331065222_b7356477-efa5-476b-935e-1cbcd4643a03.sql
-- ────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS sales_transaction_id_unique 
ON public.sales (transaction_id) 
WHERE transaction_id IS NOT NULL;


-- ────────────────────────────────────────
-- Migração: 20260408063136_6c131e7b-9c35-43dd-af63-81b2b1f2f2fc.sql
-- ────────────────────────────────────────
-- Fix sales with wrong currency: MXN recorded as USD
UPDATE sales SET 
  original_currency = 'MXN',
  exchange_rate = (SELECT rate.r FROM (VALUES ('MXN', 3.5)) AS rate(c, r) LIMIT 1),
  amount_mzn = original_amount * 3.5
WHERE transaction_id IN ('HP3345919576', 'HP3677573128');

-- Fix EUR sale recorded as USD
UPDATE sales SET
  original_currency = 'EUR',
  exchange_rate = 70.0,
  amount_mzn = original_amount * 70.0
WHERE transaction_id = 'HP1900478731';

-- Fix GBP sale recorded as USD
UPDATE sales SET
  original_currency = 'GBP',
  exchange_rate = 82.0,
  amount_mzn = original_amount * 82.0
WHERE transaction_id = 'HP1289882227';

-- ────────────────────────────────────────
-- Migração: 20260420185922_6ee6c8f3-b291-4f86-b5cf-63bf02651e8f.sql
-- ────────────────────────────────────────
CREATE TABLE public.lead_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  lead_id uuid NOT NULL,
  is_hot boolean NOT NULL DEFAULT true,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, lead_id)
);

ALTER TABLE public.lead_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own lead flags"
  ON public.lead_flags
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_lead_flags_user_lead ON public.lead_flags(user_id, lead_id);

-- ────────────────────────────────────────
-- Migração: 20260421092949_ce953d87-b21d-4b4a-9254-3241a5ea2def.sql
-- ────────────────────────────────────────

CREATE TABLE public.notification_prefs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  push_sales BOOLEAN NOT NULL DEFAULT true,
  push_refunds BOOLEAN NOT NULL DEFAULT true,
  push_milestones BOOLEAN NOT NULL DEFAULT true,
  daily_summary BOOLEAN NOT NULL DEFAULT true,
  timezone TEXT NOT NULL DEFAULT 'Africa/Maputo',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own notification prefs"
ON public.notification_prefs
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER notification_prefs_updated_at
BEFORE UPDATE ON public.notification_prefs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ────────────────────────────────────────
-- Migração: 20260422152152_d959f2dd-08f6-4589-b235-5b5efa57aedd.sql
-- ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.hotmart_to_timestamptz(value text)
RETURNS timestamptz
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  cleaned text;
BEGIN
  cleaned := NULLIF(trim(value), '');
  IF cleaned IS NULL THEN
    RETURN NULL;
  END IF;

  IF cleaned ~ '^\d{13}$' THEN
    RETURN to_timestamp((cleaned::numeric / 1000.0)::double precision);
  END IF;

  IF cleaned ~ '^\d{10}$' THEN
    RETURN to_timestamp(cleaned::double precision);
  END IF;

  RETURN cleaned::timestamptz;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS sale_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS hotmart_event TEXT,
ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
ADD COLUMN IF NOT EXISTS last_webhook_at TIMESTAMP WITH TIME ZONE DEFAULT now();

UPDATE public.sales
SET
  sale_date = COALESCE(
    sale_date,
    public.hotmart_to_timestamptz(hotmart_payload #>> '{data,purchase,order_date}'),
    public.hotmart_to_timestamptz(hotmart_payload #>> '{data,purchase,purchase_date}'),
    public.hotmart_to_timestamptz(hotmart_payload #>> '{data,purchase,approved_date}'),
    public.hotmart_to_timestamptz(hotmart_payload #>> '{data,purchase,date}'),
    public.hotmart_to_timestamptz(hotmart_payload #>> '{purchase,order_date}'),
    public.hotmart_to_timestamptz(hotmart_payload #>> '{purchase,purchase_date}'),
    public.hotmart_to_timestamptz(hotmart_payload #>> '{purchase,approved_date}'),
    public.hotmart_to_timestamptz(hotmart_payload #>> '{purchase,date}'),
    created_at
  ),
  approved_at = COALESCE(
    approved_at,
    CASE WHEN status IN ('approved', 'realized') THEN COALESCE(
      public.hotmart_to_timestamptz(hotmart_payload #>> '{data,purchase,approved_date}'),
      public.hotmart_to_timestamptz(hotmart_payload #>> '{purchase,approved_date}')
    ) END
  ),
  status_updated_at = COALESCE(status_updated_at, created_at),
  first_seen_at = COALESCE(first_seen_at, created_at),
  last_webhook_at = COALESCE(last_webhook_at, created_at),
  hotmart_event = COALESCE(hotmart_event, hotmart_payload->>'event', hotmart_payload #>> '{data,event}')
WHERE sale_date IS NULL
   OR status_updated_at IS NULL
   OR first_seen_at IS NULL
   OR last_webhook_at IS NULL
   OR hotmart_event IS NULL;

ALTER TABLE public.sales
ALTER COLUMN sale_date SET DEFAULT now(),
ALTER COLUMN first_seen_at SET DEFAULT now(),
ALTER COLUMN last_webhook_at SET DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS sales_transaction_id_unique
ON public.sales (transaction_id)
WHERE transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sales_user_sale_date
ON public.sales (user_id, sale_date DESC);

CREATE INDEX IF NOT EXISTS idx_sales_campaign_sale_date
ON public.sales (campaign_id, sale_date DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_log_user_sale_title
ON public.notifications_log (user_id, sale_id, title)
WHERE sale_id IS NOT NULL;

-- ────────────────────────────────────────
-- Migração: 20260422152944_8d1104e0-e901-4301-8d19-aca3330b318b.sql
-- ────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS sales_transaction_id_unique_idx
ON public.sales (transaction_id)
WHERE transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS sales_user_sale_date_idx
ON public.sales (user_id, sale_date DESC);

CREATE INDEX IF NOT EXISTS sales_user_status_sale_date_idx
ON public.sales (user_id, status, sale_date DESC);

CREATE INDEX IF NOT EXISTS sales_user_platform_sale_date_idx
ON public.sales (user_id, platform, sale_date DESC);

CREATE INDEX IF NOT EXISTS sales_user_approved_at_idx
ON public.sales (user_id, approved_at DESC)
WHERE approved_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS sales_transaction_lookup_idx
ON public.sales (transaction_id)
WHERE transaction_id IS NOT NULL;

-- ────────────────────────────────────────
-- Migração: 20260504054041_c8b511ce-44b1-4a0b-ad13-6b9de8e7a01b.sql
-- ────────────────────────────────────────

-- Add length/format constraints to public-insert tracking tables
ALTER TABLE public.leads_clicks
  ADD CONSTRAINT leads_email_length CHECK (email IS NULL OR char_length(email) <= 254),
  ADD CONSTRAINT leads_phone_length CHECK (phone IS NULL OR char_length(phone) <= 32),
  ADD CONSTRAINT leads_name_length CHECK (name IS NULL OR char_length(name) <= 200),
  ADD CONSTRAINT leads_city_length CHECK (city IS NULL OR char_length(city) <= 120),
  ADD CONSTRAINT leads_state_length CHECK (state IS NULL OR char_length(state) <= 120),
  ADD CONSTRAINT leads_country_length CHECK (country IS NULL OR char_length(country) <= 120),
  ADD CONSTRAINT leads_zip_length CHECK (zip_code IS NULL OR char_length(zip_code) <= 32),
  ADD CONSTRAINT leads_ua_length CHECK (user_agent IS NULL OR char_length(user_agent) <= 1000),
  ADD CONSTRAINT leads_referrer_length CHECK (referrer IS NULL OR char_length(referrer) <= 2000),
  ADD CONSTRAINT leads_page_url_length CHECK (page_url IS NULL OR char_length(page_url) <= 2000),
  ADD CONSTRAINT leads_fingerprint_length CHECK (fingerprint IS NULL OR char_length(fingerprint) <= 128),
  ADD CONSTRAINT leads_ip_length CHECK (ip_address IS NULL OR char_length(ip_address) <= 64),
  ADD CONSTRAINT leads_utm_source_length CHECK (utm_source IS NULL OR char_length(utm_source) <= 200),
  ADD CONSTRAINT leads_utm_medium_length CHECK (utm_medium IS NULL OR char_length(utm_medium) <= 200),
  ADD CONSTRAINT leads_utm_campaign_length CHECK (utm_campaign IS NULL OR char_length(utm_campaign) <= 200),
  ADD CONSTRAINT leads_utm_content_length CHECK (utm_content IS NULL OR char_length(utm_content) <= 200),
  ADD CONSTRAINT leads_utm_term_length CHECK (utm_term IS NULL OR char_length(utm_term) <= 200);

ALTER TABLE public.cta_clicks
  ADD CONSTRAINT cta_button_text_length CHECK (button_text IS NULL OR char_length(button_text) <= 300),
  ADD CONSTRAINT cta_button_id_length CHECK (button_id IS NULL OR char_length(button_id) <= 200),
  ADD CONSTRAINT cta_page_url_length CHECK (page_url IS NULL OR char_length(page_url) <= 2000);


-- ────────────────────────────────────────
-- Migração: 20260504054117_e2b26209-d961-4ef6-a1e5-a565502b078d.sql
-- ────────────────────────────────────────

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


-- ────────────────────────────────────────
-- Migração: 20260504054731_29c50f61-8095-4aab-8ece-781d45ca514b.sql
-- ────────────────────────────────────────

-- ============================================================
-- 1. Private vault for third-party tokens
-- ============================================================
CREATE TABLE public.user_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind)
);

ALTER TABLE public.user_secrets ENABLE ROW LEVEL SECURITY;

-- Default-deny: no policies for authenticated/anon. Only service_role bypasses RLS.
CREATE POLICY "deny_all_secrets_select" ON public.user_secrets FOR SELECT TO authenticated, anon USING (false);
CREATE POLICY "deny_all_secrets_insert" ON public.user_secrets FOR INSERT TO authenticated, anon WITH CHECK (false);
CREATE POLICY "deny_all_secrets_update" ON public.user_secrets FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);
CREATE POLICY "deny_all_secrets_delete" ON public.user_secrets FOR DELETE TO authenticated, anon USING (false);

CREATE INDEX idx_user_secrets_kind ON public.user_secrets (kind);
CREATE INDEX idx_user_secrets_user_kind ON public.user_secrets (user_id, kind);

CREATE TRIGGER user_secrets_updated_at
  BEFORE UPDATE ON public.user_secrets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2. Helper functions for safe client access
-- ============================================================
CREATE OR REPLACE FUNCTION public.list_my_secret_kinds()
RETURNS TABLE(kind text, is_set boolean, updated_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT kind, true, updated_at
  FROM public.user_secrets
  WHERE user_id = auth.uid();
$$;
REVOKE EXECUTE ON FUNCTION public.list_my_secret_kinds() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_my_secret_kinds() TO authenticated;

CREATE OR REPLACE FUNCTION public.has_secret(_kind text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_secrets
    WHERE user_id = auth.uid() AND kind = _kind
  );
$$;
REVOKE EXECUTE ON FUNCTION public.has_secret(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_secret(text) TO authenticated;

-- ============================================================
-- 3. Migrate existing tokens into the vault
-- ============================================================
INSERT INTO public.user_secrets (user_id, kind, value)
SELECT user_id, 'meta_access_token', meta_access_token
FROM public.profiles
WHERE meta_access_token IS NOT NULL AND length(meta_access_token) > 0
ON CONFLICT (user_id, kind) DO NOTHING;

INSERT INTO public.user_secrets (user_id, kind, value)
SELECT user_id, 'hotmart_token', hotmart_token
FROM public.profiles
WHERE hotmart_token IS NOT NULL AND length(hotmart_token) > 0
ON CONFLICT (user_id, kind) DO NOTHING;

INSERT INTO public.user_secrets (user_id, kind, value)
SELECT user_id, 'campaign:' || id::text || ':meta_access_token', meta_access_token
FROM public.campaigns
WHERE meta_access_token IS NOT NULL AND length(meta_access_token) > 0
ON CONFLICT (user_id, kind) DO NOTHING;

INSERT INTO public.user_secrets (user_id, kind, value)
SELECT user_id, 'campaign:' || id::text || ':hotmart_token', hotmart_token
FROM public.campaigns
WHERE hotmart_token IS NOT NULL AND length(hotmart_token) > 0
ON CONFLICT (user_id, kind) DO NOTHING;

INSERT INTO public.user_secrets (user_id, kind, value)
SELECT user_id, 'campaign:' || id::text || ':tiktok_access_token', tiktok_access_token
FROM public.campaigns
WHERE tiktok_access_token IS NOT NULL AND length(tiktok_access_token) > 0
ON CONFLICT (user_id, kind) DO NOTHING;

INSERT INTO public.user_secrets (user_id, kind, value)
SELECT user_id, 'campaign:' || id::text || ':fb_access_token', fb_access_token
FROM public.campaigns
WHERE fb_access_token IS NOT NULL AND length(fb_access_token) > 0
ON CONFLICT (user_id, kind) DO NOTHING;

-- ============================================================
-- 4. Drop sensitive columns from public-facing tables
-- ============================================================
ALTER TABLE public.profiles
  DROP COLUMN meta_access_token,
  DROP COLUMN hotmart_token;

ALTER TABLE public.campaigns
  DROP COLUMN meta_access_token,
  DROP COLUMN hotmart_token,
  DROP COLUMN fb_access_token,
  DROP COLUMN tiktok_access_token;

-- ============================================================
-- 5. Audit log
-- ============================================================
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target text,
  ip text,
  user_agent text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own audit log" ON public.audit_log
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Block client inserts" ON public.audit_log
  FOR INSERT TO authenticated, anon WITH CHECK (false);

CREATE INDEX idx_audit_log_user ON public.audit_log (user_id, created_at DESC);
CREATE INDEX idx_audit_log_action ON public.audit_log (action, created_at DESC);

-- ============================================================
-- 6. Rate limit storage (used by edge functions)
-- ============================================================
CREATE TABLE public.rate_limits (
  key text NOT NULL,
  window_start timestamptz NOT NULL,
  count int NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_all_rate_limits" ON public.rate_limits FOR ALL TO authenticated, anon USING (false) WITH CHECK (false);

CREATE INDEX idx_rate_limits_window ON public.rate_limits (window_start);

-- ============================================================
-- 7. Constraint hardening on audit_log
-- ============================================================
ALTER TABLE public.audit_log
  ADD CONSTRAINT audit_action_length CHECK (char_length(action) <= 100),
  ADD CONSTRAINT audit_target_length CHECK (target IS NULL OR char_length(target) <= 300),
  ADD CONSTRAINT audit_ua_length CHECK (user_agent IS NULL OR char_length(user_agent) <= 1000),
  ADD CONSTRAINT audit_ip_length CHECK (ip IS NULL OR char_length(ip) <= 64);


-- ────────────────────────────────────────
-- Migração: 20260921190111_resend_and_ops_index.sql
-- ────────────────────────────────────────
-- ============================================================
-- Add resend_api_key support + operations table index
-- ============================================================

-- Ensure operations table exists (may already exist from Lovable)
CREATE TABLE IF NOT EXISTS public.operations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         text NOT NULL,
  currency     text NOT NULL DEFAULT 'USD',
  kind         text NOT NULL DEFAULT 'paid', -- 'paid' | 'organic'
  fb_ad_account_id text,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.operations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own operations" ON public.operations
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_operations_user ON public.operations (user_id, created_at);

-- Ensure ad_spend_manual has spend_date column
ALTER TABLE public.ad_spend_manual
  ADD COLUMN IF NOT EXISTS spend_date date NOT NULL DEFAULT CURRENT_DATE;

CREATE INDEX IF NOT EXISTS idx_ad_spend_manual_op_date
  ON public.ad_spend_manual (operation_id, spend_date);

-- Note: resend_api_key is stored in user_secrets table (kind='resend_api_key')
-- No new table needed — uses existing vault system.

-- ────────────────────────────────────────
-- Migração: 20261011184900_dashboards_foundation.sql
-- ────────────────────────────────────────
-- ================================================================
-- NexusTrack v2 — DASHBOARDS FOUNDATION
-- Tabela central de dashboards com isolamento completo
-- ================================================================

-- 1. DASHBOARDS — substitui operations como conceito central
CREATE TABLE IF NOT EXISTS public.dashboards (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            text NOT NULL,
  language        text NOT NULL DEFAULT 'pt',
  currency        text NOT NULL DEFAULT 'MZN',
  timezone        text NOT NULL DEFAULT 'Africa/Maputo',
  kind            text NOT NULL DEFAULT 'paid',

  -- Facebook Ads (1 conta por dashboard)
  fb_ad_account_id    text,
  fb_ad_account_name  text,
  fb_account_currency text,
  fb_connected_at     timestamptz,

  -- Meta de faturamento
  revenue_goal        numeric DEFAULT 0,
  revenue_goal_period text DEFAULT 'monthly',
  revenue_goal_metric text DEFAULT 'net_revenue',

  -- Custos
  product_cost     numeric DEFAULT 0,
  payment_fee_pct  numeric DEFAULT 0,
  other_costs      numeric DEFAULT 0,

  -- Webhook inbound
  webhook_secret   text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),

  -- Meta
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dashboards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own dashboards" ON public.dashboards
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_dashboards_user ON public.dashboards (user_id, created_at);

-- 2. TRACKING LINKS — gerador de UTM por dashboard
CREATE TABLE IF NOT EXISTS public.tracking_links (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id    uuid NOT NULL REFERENCES public.dashboards(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            text NOT NULL,
  destination_url text NOT NULL,
  utm_source      text,
  utm_medium      text,
  utm_campaign    text,
  utm_content     text,
  utm_term        text,
  fb_campaign_id  text,
  fb_adset_id     text,
  fb_ad_id        text,
  product_name    text,
  clicks          integer NOT NULL DEFAULT 0,
  leads           integer NOT NULL DEFAULT 0,
  sales           integer NOT NULL DEFAULT 0,
  revenue         numeric NOT NULL DEFAULT 0,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tracking_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own tracking_links" ON public.tracking_links
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_tracking_links_dash ON public.tracking_links (dashboard_id);

-- 3. EVENTS — sistema de tracking unificado
CREATE TABLE IF NOT EXISTS public.events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id    uuid NOT NULL REFERENCES public.dashboards(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type      text NOT NULL,
  event_id        text,
  visitor_id      text,
  session_id      text,

  -- Atribuicao
  utm_source      text,
  utm_medium      text,
  utm_campaign    text,
  utm_content     text,
  utm_term        text,
  tracking_link_id uuid REFERENCES public.tracking_links(id) ON DELETE SET NULL,
  referrer        text,
  source_classified text,
  first_source    text,
  last_source     text,

  -- Dados do evento
  value           numeric,
  currency        text,
  order_id        text,
  product_name    text,
  page_url        text,

  -- Dados do utilizador
  email           text,
  phone           text,
  name            text,
  ip_address      text,
  user_agent      text,
  country         text,
  city            text,

  -- FB identifiers
  fbc             text,
  fbp             text,
  fbclid          text,

  -- Meta
  is_test         boolean NOT NULL DEFAULT false,
  processed       boolean NOT NULL DEFAULT false,
  payload         jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own events" ON public.events
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Service inserts events" ON public.events
  FOR INSERT TO service_role WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_events_dash_type ON public.events (dashboard_id, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_dedup ON public.events (dashboard_id, event_id) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_order ON public.events (dashboard_id, order_id) WHERE order_id IS NOT NULL;

-- 4. NOTIFICATION RULES — regras personalizaveis por dashboard
CREATE TABLE IF NOT EXISTS public.notification_rules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id    uuid NOT NULL REFERENCES public.dashboards(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type      text NOT NULL,
  is_enabled      boolean NOT NULL DEFAULT true,

  -- Template
  title_template  text NOT NULL DEFAULT '{event} | {dashboard}',
  body_template   text NOT NULL DEFAULT '{product} - {value} {currency}',
  include_value   boolean NOT NULL DEFAULT true,
  include_dashboard_name boolean NOT NULL DEFAULT true,

  -- Canais
  channel_push    boolean NOT NULL DEFAULT true,
  channel_email   boolean NOT NULL DEFAULT false,
  channel_telegram boolean NOT NULL DEFAULT false,
  channel_webhook boolean NOT NULL DEFAULT false,
  webhook_url     text,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own notification_rules" ON public.notification_rules
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 5. NOTIFICATION QUEUE — fila com retry
CREATE TABLE IF NOT EXISTS public.notification_queue (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id    uuid REFERENCES public.dashboards(id) ON DELETE SET NULL,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rule_id         uuid REFERENCES public.notification_rules(id) ON DELETE SET NULL,
  channel         text NOT NULL,
  status          text NOT NULL DEFAULT 'pending',
  title           text NOT NULL,
  body            text NOT NULL,
  payload         jsonb,
  attempts        integer NOT NULL DEFAULT 0,
  max_attempts    integer NOT NULL DEFAULT 3,
  last_error      text,
  next_retry_at   timestamptz,
  sent_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own notifications" ON public.notification_queue
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_notif_queue_pending ON public.notification_queue (status, next_retry_at)
  WHERE status = 'pending';

-- 6. WEBHOOK CONFIGS — webhooks de saida
CREATE TABLE IF NOT EXISTS public.webhook_configs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id    uuid NOT NULL REFERENCES public.dashboards(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            text NOT NULL,
  url             text NOT NULL,
  events          text[] NOT NULL DEFAULT '{}',
  auth_type       text DEFAULT 'none',
  auth_value      text,
  is_active       boolean NOT NULL DEFAULT true,
  last_triggered  timestamptz,
  last_status     text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.webhook_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own webhook_configs" ON public.webhook_configs
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 7. WEBHOOK LOG
CREATE TABLE IF NOT EXISTS public.webhook_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id    uuid REFERENCES public.dashboards(id) ON DELETE SET NULL,
  user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  direction       text NOT NULL DEFAULT 'inbound',
  source          text,
  event_type      text,
  status          text NOT NULL DEFAULT 'received',
  payload         jsonb,
  response_code   integer,
  error           text,
  idempotency_key text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.webhook_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own webhook_log" ON public.webhook_log
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_webhook_log_dash ON public.webhook_log (dashboard_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_log_idemp ON public.webhook_log (idempotency_key) WHERE idempotency_key IS NOT NULL;

-- 8. AD SPEND MANUAL — associar a dashboard
CREATE TABLE IF NOT EXISTS public.ad_spend_manual (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id    uuid REFERENCES public.dashboards(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation_id    uuid,
  amount          numeric NOT NULL,
  currency        text NOT NULL DEFAULT 'USD',
  description     text,
  spend_date      date NOT NULL DEFAULT CURRENT_DATE,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- 9. Adicionar dashboard_id a tabelas existentes
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS dashboard_id uuid REFERENCES public.dashboards(id) ON DELETE SET NULL;
ALTER TABLE public.leads_clicks ADD COLUMN IF NOT EXISTS dashboard_id uuid REFERENCES public.dashboards(id) ON DELETE SET NULL;
ALTER TABLE public.pages ADD COLUMN IF NOT EXISTS dashboard_id uuid REFERENCES public.dashboards(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sales_dashboard ON public.sales (dashboard_id, sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_leads_dashboard ON public.leads_clicks (dashboard_id, created_at DESC);

-- 10. FB SYNC STATUS — controlo de sincronizacao
CREATE TABLE IF NOT EXISTS public.fb_sync_status (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id    uuid NOT NULL REFERENCES public.dashboards(id) ON DELETE CASCADE UNIQUE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_sync_at    timestamptz,
  last_sync_status text DEFAULT 'never',
  last_sync_error text,
  sync_cursor     text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fb_sync_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own fb_sync" ON public.fb_sync_status
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
