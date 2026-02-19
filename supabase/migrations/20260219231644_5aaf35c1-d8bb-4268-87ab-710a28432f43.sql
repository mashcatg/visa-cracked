
-- Fix the permissive insert policy on interview_reports
-- Only allow inserts from service role (edge functions) by checking if user has a role
DROP POLICY "Service can insert reports" ON public.interview_reports;

-- Reports are inserted by edge functions using service role key, so no user-facing insert policy needed
-- Edge functions use SUPABASE_SERVICE_ROLE_KEY which bypasses RLS
