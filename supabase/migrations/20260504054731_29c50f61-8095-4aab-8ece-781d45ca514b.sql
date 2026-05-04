
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
