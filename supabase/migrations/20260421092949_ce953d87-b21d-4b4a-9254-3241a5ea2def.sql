
CREATE TABLE public.notification_prefs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  push_sales BOOLEAN NOT NULL DEFAULT true,
  push_refunds BOOLEAN NOT NULL DEFAULT true,
  push_milestones BOOLEAN NOT NULL DEFAULT true,
  daily_summary BOOLEAN NOT NULL DEFAULT true,
  timezone TEXT NOT NULL DEFAULT 'Africa/Maputo',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own notification prefs"
ON public.notification_prefs
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER notification_prefs_updated_at
BEFORE UPDATE ON public.notification_prefs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
