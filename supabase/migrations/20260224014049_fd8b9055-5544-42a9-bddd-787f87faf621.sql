ALTER TABLE public.orders
ADD CONSTRAINT orders_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id);