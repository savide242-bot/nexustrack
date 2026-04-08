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