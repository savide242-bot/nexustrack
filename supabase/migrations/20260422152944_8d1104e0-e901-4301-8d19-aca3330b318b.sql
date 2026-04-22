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