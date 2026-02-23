
-- Create coupons table
CREATE TABLE public.coupons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL,
  discount_type TEXT NOT NULL DEFAULT 'percentage',
  discount_amount NUMERIC NOT NULL DEFAULT 0,
  expiration_date TIMESTAMPTZ,
  total_usage_limit INTEGER,
  per_user_limit INTEGER NOT NULL DEFAULT 1,
  times_used INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique uppercase code constraint
CREATE UNIQUE INDEX idx_coupons_code ON public.coupons (upper(code));

-- Create coupon_usages table
CREATE TABLE public.coupon_usages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coupon_id UUID NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  order_id UUID REFERENCES public.orders(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_coupon_usages_coupon_user ON public.coupon_usages (coupon_id, user_id);

-- Enable RLS
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_usages ENABLE ROW LEVEL SECURITY;

-- Coupons RLS: admins full CRUD, authenticated users can read active
CREATE POLICY "Admins can manage coupons"
ON public.coupons FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view active coupons"
ON public.coupons FOR SELECT
USING (is_active = true AND auth.uid() IS NOT NULL);

-- Coupon usages RLS: admins see all, users see own
CREATE POLICY "Admins can manage coupon_usages"
ON public.coupon_usages FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own coupon usages"
ON public.coupon_usages FOR SELECT
USING (auth.uid() = user_id);

-- Allow service role insert via edge functions (no additional policy needed, service role bypasses RLS)

-- Validation trigger: expiration_date must be in the future when inserting
CREATE OR REPLACE FUNCTION public.validate_coupon_expiry()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.expiration_date IS NOT NULL AND NEW.expiration_date <= now() AND TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'Expiration date must be in the future';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_validate_coupon_expiry
BEFORE INSERT ON public.coupons
FOR EACH ROW
EXECUTE FUNCTION public.validate_coupon_expiry();
