

# Fix OAuth Auth + IP-Based Currency + Admin Discount System

## Overview

Four interconnected changes:
1. **Fix Google OAuth redirect** -- users land on `/login` instead of `/dashboard` after successful Google sign-in
2. **IP-based currency detection** -- show BDT for Bangladesh users, USD for everyone else
3. **Admin coupon/discount system** -- full CRUD in admin panel
4. **Coupon redemption in pricing modal** -- "Have a coupon?" link with discounted payment

---

## 1. Fix Google OAuth Redirect

**Root cause**: After Google OAuth, the user is redirected to `/dashboard`. But `RequireAuth` checks the session, finds it not yet established (the auth state listener hasn't fired yet), and redirects to `/login` within 100ms.

**Fix**:
- Change `redirect_uri` in Login.tsx and Signup.tsx to `window.location.origin` (not `/dashboard`) so the OAuth callback lands on a non-protected page
- Add `useEffect` in Login.tsx and Signup.tsx that checks if `session` already exists and navigates to `/dashboard`
- In `RequireAuth`, increase the grace period and add a check for OAuth callback indicators in the URL (hash fragments) to avoid premature redirect

**Files changed**: `src/pages/Login.tsx`, `src/pages/Signup.tsx`, `src/lib/auth.tsx`

---

## 2. IP-Based Currency (BDT vs USD)

**Approach**: Use a free IP geolocation API (e.g., `https://ipapi.co/json/`) to detect the user's country. If Bangladesh, show BDT prices; otherwise show USD.

- BDT prices: 800, 1500, 2800
- USD prices: ~$7, ~$13, ~$25 (approximate conversions, configurable)

**Frontend**: PricingModal will fetch user's country on mount and display appropriate currency/prices.

**Backend**: The `initiate-payment` edge function will accept a `currency` parameter. For USD, SSLCommerz supports multi-currency -- the function will pass the correct currency and amount.

**Files changed**: `src/components/pricing/PricingModal.tsx`, `supabase/functions/initiate-payment/index.ts`

---

## 3. Admin Coupon/Discount System

### Database

**New table: `coupons`**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, default gen_random_uuid() |
| code | text | Unique, uppercase coupon code |
| discount_type | text | "percentage" or "fixed" |
| discount_amount | numeric | Percentage value or fixed amount |
| expiration_date | timestamptz | Nullable, when coupon expires |
| total_usage_limit | integer | Nullable, max total uses |
| per_user_limit | integer | Default 1, max uses per user |
| times_used | integer | Default 0, current total uses |
| is_active | boolean | Default true |
| created_at | timestamptz | Default now() |

**New table: `coupon_usages`** (tracks per-user usage)

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| coupon_id | uuid | FK to coupons |
| user_id | uuid | Who used it |
| order_id | uuid | Nullable, FK to orders |
| created_at | timestamptz | Default now() |

**RLS Policies**:
- `coupons`: Admins can CRUD; authenticated users can SELECT active coupons
- `coupon_usages`: Admins can view all; users can view own; system inserts via edge function

### Admin UI

Add a new "Discounts" tab to the Admin Panel (`AdminLayout.tsx`) with a new page `AdminDiscounts.tsx`:
- Table showing all coupons with columns: Code, Type, Amount, Expiry, Usage (used/limit), Per-User Limit, Status, Actions
- "Create Coupon" button opening a form dialog
- Edit and delete actions on each row
- Search and pagination (following existing admin table patterns)

**Files changed/created**: `src/pages/admin/AdminLayout.tsx`, `src/pages/admin/AdminDiscounts.tsx` (new), `src/pages/AdminPage.tsx`

---

## 4. Coupon Redemption in Pricing Modal

**UI Changes to PricingModal**:
- Add a "Have a coupon?" link below the pricing cards
- Clicking it reveals an input field to enter a coupon code with an "Apply" button
- On apply, validate the coupon via a new edge function `validate-coupon`
- If valid, show the discounted price on each plan card (strikethrough original price + new price)
- Pass the coupon code to `initiate-payment` so the correct amount is charged

**Edge function: `validate-coupon`** (new):
- Receives: coupon code, user_id
- Checks: code exists, is_active, not expired, total usage not exceeded, per-user usage not exceeded
- Returns: discount_type, discount_amount, or error

**Update `initiate-payment`**:
- Accept optional `coupon_code` parameter
- Re-validate the coupon server-side
- Calculate discounted amount
- Record coupon usage in `coupon_usages` after creating the order
- Pass discounted amount to SSLCommerz

**Update `payment-ipn`**:
- No changes needed (it already validates amount matches order)

**Files changed/created**:
- `src/components/pricing/PricingModal.tsx`
- `supabase/functions/validate-coupon/index.ts` (new)
- `supabase/functions/initiate-payment/index.ts`

---

## Technical Details

### File Summary

| File | Action |
|------|--------|
| `src/pages/Login.tsx` | Add session redirect + fix OAuth redirect_uri |
| `src/pages/Signup.tsx` | Add session redirect + fix OAuth redirect_uri |
| `src/lib/auth.tsx` | Make RequireAuth more robust for OAuth flows |
| `src/components/pricing/PricingModal.tsx` | Add IP-based currency, coupon input, discounted prices |
| `supabase/functions/initiate-payment/index.ts` | Add currency + coupon support |
| `supabase/functions/validate-coupon/index.ts` | New -- validate coupon codes |
| Database migration | Create `coupons` and `coupon_usages` tables with RLS |
| `src/pages/admin/AdminDiscounts.tsx` | New -- admin CRUD for coupons |
| `src/pages/admin/AdminLayout.tsx` | Add Discounts tab |
| `src/pages/AdminPage.tsx` | Add Discounts route |
| `supabase/config.toml` | Add validate-coupon function config |

### USD Price Mapping

| Plan | BDT | USD |
|------|-----|-----|
| Starter | 800 | 7 |
| Pro | 1,500 | 13 |
| Premium | 2,800 | 25 |

### Coupon Discount Calculation

- **Percentage**: `discounted = original * (1 - discount_amount / 100)`, rounded to nearest integer
- **Fixed (BDT)**: `discounted = original - discount_amount`, minimum 0. For USD orders, the fixed amount is converted proportionally

