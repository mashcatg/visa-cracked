
-- New table: visa_type_form_fields
CREATE TABLE public.visa_type_form_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visa_type_id uuid NOT NULL REFERENCES public.visa_types(id) ON DELETE CASCADE,
  label text NOT NULL,
  field_key text NOT NULL,
  field_type text NOT NULL DEFAULT 'text',
  placeholder text,
  is_required boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  options jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (visa_type_id, field_key)
);

ALTER TABLE public.visa_type_form_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage form fields" ON public.visa_type_form_fields
  FOR ALL TO public USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view form fields" ON public.visa_type_form_fields
  FOR SELECT TO public USING (auth.role() = 'authenticated');

-- New table: user_visa_form_data
CREATE TABLE public.user_visa_form_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  visa_type_id uuid NOT NULL REFERENCES public.visa_types(id) ON DELETE CASCADE,
  field_key text NOT NULL,
  field_value text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, visa_type_id, field_key)
);

ALTER TABLE public.user_visa_form_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own form data" ON public.user_visa_form_data
  FOR ALL TO public USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all form data" ON public.user_visa_form_data
  FOR SELECT TO public USING (has_role(auth.uid(), 'admin'));

-- Add output_structure to difficulty_modes
ALTER TABLE public.difficulty_modes ADD COLUMN IF NOT EXISTS output_structure jsonb;
