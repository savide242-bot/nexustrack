CREATE TABLE public.lead_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  lead_id uuid NOT NULL,
  is_hot boolean NOT NULL DEFAULT true,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, lead_id)
);

ALTER TABLE public.lead_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own lead flags"
  ON public.lead_flags
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_lead_flags_user_lead ON public.lead_flags(user_id, lead_id);