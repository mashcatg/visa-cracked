-- Add section title and desktop layout width controls for visa type dynamic fields
ALTER TABLE public.visa_type_form_fields
  ADD COLUMN IF NOT EXISTS section_title text,
  ADD COLUMN IF NOT EXISTS layout_width text NOT NULL DEFAULT 'full';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'visa_type_form_fields_layout_width_check'
  ) THEN
    ALTER TABLE public.visa_type_form_fields
      ADD CONSTRAINT visa_type_form_fields_layout_width_check
      CHECK (layout_width IN ('full', 'half'));
  END IF;
END $$;
