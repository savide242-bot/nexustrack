CREATE TABLE public.operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  currency text NOT NULL DEFAULT 'USD' CHECK (char_length(currency) BETWEEN 3 AND 3),
  fb_ad_account_id text CHECK (fb_ad_account_id IS NULL OR char_length(fb_ad_account_id) <= 64),
  kind text NOT NULL DEFAULT 'paid' CHECK (kind IN ('paid','organic')),
  color text NOT NULL DEFAULT '#00FF7F' CHECK (char_length(color) <= 16),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.operations TO authenticated;
GRANT ALL ON public.operations TO service_role;

ALTER TABLE public.operations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own operations" ON public.operations
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER operations_updated_at BEFORE UPDATE ON public.operations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_operations_user ON public.operations(user_id);

ALTER TABLE public.campaigns ADD COLUMN operation_id uuid REFERENCES public.operations(id) ON DELETE SET NULL;
ALTER TABLE public.pages ADD COLUMN operation_id uuid REFERENCES public.operations(id) ON DELETE SET NULL;
ALTER TABLE public.sales ADD COLUMN operation_id uuid REFERENCES public.operations(id) ON DELETE SET NULL;

CREATE INDEX idx_campaigns_operation ON public.campaigns(operation_id);
CREATE INDEX idx_pages_operation ON public.pages(operation_id);
CREATE INDEX idx_sales_operation ON public.sales(operation_id);

-- Manual ad spend entries (for operations without a connected ad account)
CREATE TABLE public.ad_spend_manual (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation_id uuid NOT NULL REFERENCES public.operations(id) ON DELETE CASCADE,
  spend_date date NOT NULL DEFAULT current_date,
  amount numeric NOT NULL DEFAULT 0 CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'USD' CHECK (char_length(currency) = 3),
  note text CHECK (note IS NULL OR char_length(note) <= 500),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ad_spend_manual TO authenticated;
GRANT ALL ON public.ad_spend_manual TO service_role;

ALTER TABLE public.ad_spend_manual ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own manual spend" ON public.ad_spend_manual
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_ad_spend_manual_op ON public.ad_spend_manual(operation_id, spend_date);