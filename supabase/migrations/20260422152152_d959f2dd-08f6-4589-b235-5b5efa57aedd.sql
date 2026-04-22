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