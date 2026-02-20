-- Add FK from interviews to profiles for PostgREST join support
ALTER TABLE public.interviews 
ADD CONSTRAINT interviews_user_id_profiles_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;