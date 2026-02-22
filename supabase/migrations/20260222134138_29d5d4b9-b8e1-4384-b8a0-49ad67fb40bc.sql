
-- Referral codes table
CREATE TABLE public.referral_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own referral code" ON public.referral_codes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own referral code" ON public.referral_codes FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Referrals table
CREATE TABLE public.referrals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id uuid NOT NULL,
  referred_user_id uuid NOT NULL,
  ip_address text,
  device_fingerprint text,
  credits_awarded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own referrals as referrer" ON public.referrals FOR SELECT USING (auth.uid() = referrer_id);

-- Process referral function (called by edge function with service role)
CREATE OR REPLACE FUNCTION public.process_referral(
  _referral_code text,
  _referred_user_id uuid,
  _ip_address text,
  _device_fingerprint text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _referrer_id uuid;
  _successful_count int;
  _ip_exists boolean;
  _fp_exists boolean;
BEGIN
  -- 1. Find referrer from code
  SELECT user_id INTO _referrer_id FROM referral_codes WHERE code = _referral_code;
  IF _referrer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_code');
  END IF;

  -- Don't allow self-referral
  IF _referrer_id = _referred_user_id THEN
    RETURN jsonb_build_object('success', false, 'reason', 'self_referral');
  END IF;

  -- 2. Check referrer hasn't exceeded 3 successful referrals
  SELECT count(*) INTO _successful_count FROM referrals WHERE referrer_id = _referrer_id AND credits_awarded = true;
  IF _successful_count >= 3 THEN
    INSERT INTO referrals (referrer_id, referred_user_id, ip_address, device_fingerprint, credits_awarded)
    VALUES (_referrer_id, _referred_user_id, _ip_address, _device_fingerprint, false);
    RETURN jsonb_build_object('success', false, 'reason', 'max_referrals_reached');
  END IF;

  -- 3. Check IP abuse
  SELECT EXISTS(SELECT 1 FROM referrals WHERE ip_address = _ip_address AND credits_awarded = true) INTO _ip_exists;
  IF _ip_exists THEN
    INSERT INTO referrals (referrer_id, referred_user_id, ip_address, device_fingerprint, credits_awarded)
    VALUES (_referrer_id, _referred_user_id, _ip_address, _device_fingerprint, false);
    RETURN jsonb_build_object('success', false, 'reason', 'ip_already_used');
  END IF;

  -- 4. Check device fingerprint abuse
  SELECT EXISTS(SELECT 1 FROM referrals WHERE device_fingerprint = _device_fingerprint AND credits_awarded = true) INTO _fp_exists;
  IF _fp_exists THEN
    INSERT INTO referrals (referrer_id, referred_user_id, ip_address, device_fingerprint, credits_awarded)
    VALUES (_referrer_id, _referred_user_id, _ip_address, _device_fingerprint, false);
    RETURN jsonb_build_object('success', false, 'reason', 'device_already_used');
  END IF;

  -- 5. All good - award credits
  INSERT INTO referrals (referrer_id, referred_user_id, ip_address, device_fingerprint, credits_awarded)
  VALUES (_referrer_id, _referred_user_id, _ip_address, _device_fingerprint, true);

  UPDATE profiles SET credits = credits + 10 WHERE user_id = _referrer_id;

  RETURN jsonb_build_object('success', true, 'credits_awarded', 10);
END;
$$;
