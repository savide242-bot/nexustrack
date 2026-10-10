ALTER TABLE public.leads_clicks ADD COLUMN IF NOT EXISTS operation_id uuid;
ALTER TABLE public.cta_clicks ADD COLUMN IF NOT EXISTS operation_id uuid;
CREATE INDEX IF NOT EXISTS leads_clicks_operation_idx ON public.leads_clicks(operation_id, created_at);
CREATE INDEX IF NOT EXISTS cta_clicks_operation_idx ON public.cta_clicks(operation_id, created_at);

CREATE OR REPLACE FUNCTION public.resolve_click_operation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.operation_id := NULL;
  IF NEW.page_id IS NOT NULL THEN
    SELECT operation_id INTO NEW.operation_id FROM public.pages WHERE id = NEW.page_id;
  END IF;
  IF NEW.operation_id IS NULL AND NEW.campaign_id IS NOT NULL THEN
    SELECT operation_id INTO NEW.operation_id FROM public.campaigns WHERE id = NEW.campaign_id;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER leads_clicks_resolve_operation BEFORE INSERT ON public.leads_clicks
  FOR EACH ROW EXECUTE FUNCTION public.resolve_click_operation();
CREATE TRIGGER cta_clicks_resolve_operation BEFORE INSERT ON public.cta_clicks
  FOR EACH ROW EXECUTE FUNCTION public.resolve_click_operation();

-- When a page/campaign changes dashboard, move its clicks along
CREATE OR REPLACE FUNCTION public.propagate_operation_to_clicks()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.operation_id IS DISTINCT FROM OLD.operation_id THEN
    IF TG_TABLE_NAME = 'pages' THEN
      UPDATE public.leads_clicks SET operation_id = NEW.operation_id WHERE page_id = NEW.id;
      UPDATE public.cta_clicks SET operation_id = NEW.operation_id WHERE page_id = NEW.id;
      UPDATE public.sales s SET operation_id = NEW.operation_id FROM public.leads_clicks l
        WHERE s.lead_id = l.id AND l.page_id = NEW.id;
    ELSE
      UPDATE public.leads_clicks SET operation_id = NEW.operation_id WHERE campaign_id = NEW.id AND page_id IS NULL;
      UPDATE public.cta_clicks SET operation_id = NEW.operation_id WHERE campaign_id = NEW.id AND page_id IS NULL;
      UPDATE public.sales SET operation_id = NEW.operation_id WHERE campaign_id = NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER pages_propagate_operation AFTER UPDATE OF operation_id ON public.pages
  FOR EACH ROW EXECUTE FUNCTION public.propagate_operation_to_clicks();
CREATE TRIGGER campaigns_propagate_operation AFTER UPDATE OF operation_id ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.propagate_operation_to_clicks();

UPDATE public.leads_clicks l SET operation_id = p.operation_id FROM public.pages p WHERE l.page_id = p.id AND p.operation_id IS NOT NULL;
UPDATE public.cta_clicks c SET operation_id = p.operation_id FROM public.pages p WHERE c.page_id = p.id AND p.operation_id IS NOT NULL;