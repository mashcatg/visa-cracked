-- Remove legacy static visa profile fields.
-- Static profile data is now limited to personal/social + country + visa type.
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS university_name,
  DROP COLUMN IF EXISTS program_name,
  DROP COLUMN IF EXISTS sevis_id,
  DROP COLUMN IF EXISTS start_date;
