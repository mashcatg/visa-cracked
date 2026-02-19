
-- Add credits column to profiles with default 10 for free accounts
ALTER TABLE public.profiles ADD COLUMN credits integer NOT NULL DEFAULT 10;

-- Fix RLS policies: change RESTRICTIVE to PERMISSIVE for proper OR logic
-- Countries
DROP POLICY IF EXISTS "Admins can manage countries" ON public.countries;
DROP POLICY IF EXISTS "Anyone can read countries" ON public.countries;
CREATE POLICY "Anyone can read countries" ON public.countries FOR SELECT USING (true);
CREATE POLICY "Admins can manage countries" ON public.countries FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Visa types
DROP POLICY IF EXISTS "Admins can manage visa types" ON public.visa_types;
DROP POLICY IF EXISTS "Anyone can read visa types" ON public.visa_types;
CREATE POLICY "Anyone can read visa types" ON public.visa_types FOR SELECT USING (true);
CREATE POLICY "Admins can manage visa types" ON public.visa_types FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Interview reports
DROP POLICY IF EXISTS "Admins can view all reports" ON public.interview_reports;
DROP POLICY IF EXISTS "Users can view own reports" ON public.interview_reports;
CREATE POLICY "Users can view own reports" ON public.interview_reports FOR SELECT USING (EXISTS (SELECT 1 FROM interviews WHERE interviews.id = interview_reports.interview_id AND interviews.user_id = auth.uid()));
CREATE POLICY "Admins can view all reports" ON public.interview_reports FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Interviews
DROP POLICY IF EXISTS "Admins can view all interviews" ON public.interviews;
DROP POLICY IF EXISTS "Users can create own interviews" ON public.interviews;
DROP POLICY IF EXISTS "Users can update own interviews" ON public.interviews;
DROP POLICY IF EXISTS "Users can view own interviews" ON public.interviews;
CREATE POLICY "Users can view own interviews" ON public.interviews FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own interviews" ON public.interviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own interviews" ON public.interviews FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all interviews" ON public.interviews FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- User roles
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
