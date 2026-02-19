
-- Add per-visa Vapi configuration columns
ALTER TABLE public.visa_types 
  ADD COLUMN vapi_assistant_id text,
  ADD COLUMN vapi_public_key text,
  ADD COLUMN vapi_private_key text;

-- Allow admins to manage these fields (already covered by existing RLS policies)
