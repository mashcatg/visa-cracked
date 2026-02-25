
-- Create difficulty_modes table
CREATE TABLE public.difficulty_modes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visa_type_id UUID NOT NULL REFERENCES public.visa_types(id) ON DELETE CASCADE,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  vapi_assistant_id TEXT,
  vapi_public_key TEXT,
  vapi_private_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (visa_type_id, difficulty)
);

-- Add difficulty column to interviews
ALTER TABLE public.interviews ADD COLUMN difficulty TEXT;

-- Enable RLS
ALTER TABLE public.difficulty_modes ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read difficulty modes
CREATE POLICY "Authenticated users can view difficulty modes"
  ON public.difficulty_modes FOR SELECT
  USING (auth.role() = 'authenticated');

-- Admins can manage difficulty modes
CREATE POLICY "Admins can manage difficulty modes"
  ON public.difficulty_modes FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
