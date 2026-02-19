
-- Credit grants table for admin-managed time-based credits
CREATE TABLE public.credit_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  credits integer NOT NULL,
  reason text,
  granted_by uuid NOT NULL,
  expires_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credit grants"
ON public.credit_grants FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage credit grants"
ON public.credit_grants FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all credit grants"
ON public.credit_grants FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Add name column to interviews for generated mock names
ALTER TABLE public.interviews ADD COLUMN name text;
