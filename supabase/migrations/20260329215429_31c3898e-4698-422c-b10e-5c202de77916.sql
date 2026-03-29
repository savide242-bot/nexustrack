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