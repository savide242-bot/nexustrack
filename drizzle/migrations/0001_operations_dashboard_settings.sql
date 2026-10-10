ALTER TABLE public.operations
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'pt',
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Africa/Maputo',
  ADD COLUMN IF NOT EXISTS revenue_goal numeric,
  ADD COLUMN IF NOT EXISTS goal_period text NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS traffic_sources text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS attribution_window_days integer NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS webhook_key text NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex');
CREATE UNIQUE INDEX IF NOT EXISTS operations_webhook_key_unique ON public.operations(webhook_key);