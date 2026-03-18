-- Set default free credits for new users to 15
ALTER TABLE public.profiles
  ALTER COLUMN credits SET DEFAULT 15;
