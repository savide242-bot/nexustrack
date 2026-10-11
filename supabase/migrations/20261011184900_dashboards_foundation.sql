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