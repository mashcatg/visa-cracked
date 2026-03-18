-- Expand dynamic field grid options to support 1/2/3/4 columns per row
ALTER TABLE public.visa_type_form_fields
  DROP CONSTRAINT IF EXISTS visa_type_form_fields_layout_width_check;

UPDATE public.visa_type_form_fields
SET layout_width = CASE
  WHEN layout_width = 'half' THEN '2'
  WHEN layout_width = 'full' THEN '1'
  WHEN layout_width IN ('1', '2', '3', '4') THEN layout_width
  ELSE '1'
END;

ALTER TABLE public.visa_type_form_fields
  ALTER COLUMN layout_width SET DEFAULT '1';

ALTER TABLE public.visa_type_form_fields
  ADD CONSTRAINT visa_type_form_fields_layout_width_check
  CHECK (layout_width IN ('1', '2', '3', '4'));
