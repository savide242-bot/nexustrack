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