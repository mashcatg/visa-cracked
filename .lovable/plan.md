
# Referral System + Mobile Top-Right Profile

## Overview
This plan covers two changes:
1. Move the profile avatar and its dropdown to the **top-right corner** on mobile devices, alongside a new **"Refer" button**
2. Build a full **referral system** with credit rewards, usage limits, and abuse prevention

---

## 1. Mobile Top Bar Changes

Currently, mobile only shows a hamburger menu (top-left). We will add a fixed top bar that includes:
- **Left**: Hamburger menu (existing)
- **Right**: Refer button (gift icon) + Profile avatar with dropdown

The profile dropdown on mobile will mirror the desktop one (credits, plan, edit profile, dark mode, logout).

---

## 2. Referral System - Rules

- Each user gets a unique referral link: `https://visa-cracked.lovable.app/signup?ref=<referral_code>`
- When a referred user creates an account, the referrer earns **10 credits**
- A user can earn referral credits **up to 3 times** (max 30 credits total)
- **Anti-abuse**: The system tracks IP address and a device fingerprint. If the same IP or device has already been used for a referral signup, no credits are awarded

---

## 3. Referral Modal

A dialog triggered by the "Refer" button showing:
- The user's unique referral link with a **copy** button
- Rules section explaining the rewards and limits
- Display of how many referrals the user has used (e.g., "2/3 referrals used")

---

## Technical Details

### Database Changes (3 new items)

**New table: `referral_codes`**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | Owner of the code |
| code | text | Unique short code |
| created_at | timestamptz | Default now() |

**New table: `referrals`**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| referrer_id | uuid | Who gets credit |
| referred_user_id | uuid | Who signed up |
| ip_address | text | For abuse detection |
| device_fingerprint | text | For abuse detection |
| credits_awarded | boolean | Whether credits were given |
| created_at | timestamptz | Default now() |

**RLS Policies:**
- `referral_codes`: Users can read their own code; insert their own
- `referrals`: Users can read their own referrals (as referrer)

**Database function: `process_referral`** -- Called from the signup flow via an edge function to:
1. Validate the referral code
2. Check referrer hasn't exceeded 3 successful referrals
3. Check IP/device fingerprint hasn't been used before
4. If valid, add 10 credits to referrer's profile and mark `credits_awarded = true`

### Edge Function: `process-referral`

Called after a new user signs up with a `ref` query parameter. It:
1. Receives the referral code, new user ID, IP address, and device fingerprint
2. Calls the `process_referral` database function
3. Returns success/failure status

### Frontend Changes

**`src/components/layout/AppSidebar.tsx`**
- In the mobile section (lines 393-405), replace the single hamburger button with a fixed top bar containing:
  - Left: hamburger menu button (existing)
  - Right: Refer button (opens referral modal) + Profile avatar (opens dropdown)
- Add referral modal state and component

**`src/components/referral/ReferralModal.tsx`** (new file)
- Shows the user's referral link with copy-to-clipboard
- Displays rules
- Shows referral usage count (X/3)
- Fetches/creates the user's referral code on open

**`src/pages/Signup.tsx`**
- Capture `ref` query parameter from URL
- Store it in localStorage before signup
- After successful signup, call the `process-referral` edge function with the code and a device fingerprint

**Device fingerprint**: A simple hash of `navigator.userAgent + screen dimensions + timezone` -- lightweight, no external library needed.

### File Summary

| File | Action |
|------|--------|
| Database migration | Create `referral_codes` and `referrals` tables, `process_referral` function, RLS policies |
| `supabase/functions/process-referral/index.ts` | New edge function for referral processing |
| `src/components/referral/ReferralModal.tsx` | New referral modal component |
| `src/components/layout/AppSidebar.tsx` | Update mobile top bar with avatar + refer button |
| `src/pages/Signup.tsx` | Capture and process referral code |
| `src/lib/fingerprint.ts` | New utility for simple device fingerprinting |
