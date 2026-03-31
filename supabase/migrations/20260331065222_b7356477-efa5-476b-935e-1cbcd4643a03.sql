
CREATE UNIQUE INDEX IF NOT EXISTS sales_transaction_id_unique 
ON public.sales (transaction_id) 
WHERE transaction_id IS NOT NULL;
