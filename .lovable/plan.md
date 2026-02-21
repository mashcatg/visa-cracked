

# SSLCommerz Payment Integration Plan

## Overview

Integrate SSLCommerz as a one-time payment gateway for purchasing credit packs (Starter, Pro, Premium). When a user clicks "Get [Plan]" in the pricing modal, they are redirected to the SSLCommerz payment page. After payment, credits are added to their profile.

## Architecture

The flow works like this:

1. User clicks "Get Pro" in the pricing modal
2. Frontend calls a backend function (`initiate-payment`)
3. The function creates an order record, calls SSLCommerz API, returns the `GatewayPageURL`
4. Frontend redirects the user to SSLCommerz
5. After payment, SSLCommerz redirects user back to success/fail/cancel pages
6. SSLCommerz also sends an IPN (server-to-server webhook) to a second backend function (`payment-ipn`) which validates the payment and grants credits

## Required Secrets

You will need to provide your SSLCommerz `store_id` and `store_passwd`. We will start with sandbox mode for testing.

## Database Changes

Create an `orders` table to track payment transactions:

- `id` (uuid, primary key)
- `user_id` (uuid, not null)
- `tran_id` (text, unique) -- unique transaction ID sent to SSLCommerz
- `plan_name` (text) -- "Starter", "Pro", "Premium"
- `amount` (numeric) -- 800, 1500, 2800
- `credits` (integer) -- 100, 200, 400
- `currency` (text, default 'BDT')
- `status` (text, default 'pending') -- pending, paid, failed, cancelled
- `session_key` (text) -- SSLCommerz session key for validation
- `val_id` (text) -- SSLCommerz validation ID after payment
- `created_at` (timestamptz)

RLS policies: users can view their own orders; admins can view all.

## Backend Functions

### 1. `initiate-payment` (new edge function)

- Receives: `plan_name` from authenticated user
- Looks up plan details (price, credits)
- Creates an order record in `orders` table with status "pending"
- Calls SSLCommerz sandbox/live API (`POST /gwprocess/v4/api.php`) with:
  - `store_id`, `store_passwd`, `total_amount`, `currency: BDT`, `tran_id`
  - `success_url`, `fail_url`, `cancel_url` pointing to the frontend
  - `ipn_url` pointing to the `payment-ipn` function
  - Customer info from the user's profile
  - `product_name`, `product_category: "topup"`, `product_profile: "non-physical-goods"`
  - `shipping_method: "NO"`
- Returns `GatewayPageURL` to frontend

### 2. `payment-ipn` (new edge function)

- Receives POST from SSLCommerz server (no auth required)
- Validates payment by calling SSLCommerz validation API
- If valid: updates order status to "paid", grants credits to user's profile
- If invalid/failed: updates order status accordingly

## Frontend Changes

### PricingModal.tsx
- Import `useAuth` and `supabase`
- On button click, call `initiate-payment` function with the plan name
- Show loading state while waiting
- Redirect to `GatewayPageURL` via `window.location.href`

### New page: PaymentResult.tsx
- Handles `/payment/success`, `/payment/fail`, `/payment/cancel` routes
- Shows appropriate message based on route
- Success page: shows confirmation, link back to dashboard
- Fail/Cancel: shows message with retry option

### App.tsx
- Add routes for `/payment/success`, `/payment/fail`, `/payment/cancel`

## Technical Details

### initiate-payment edge function

```typescript
// POST body: { plan_name: "Pro" }
// 1. Verify auth token
// 2. Map plan_name to { amount, credits }
// 3. Generate unique tran_id
// 4. Insert order into orders table
// 5. POST to SSLCommerz API
// 6. Save session_key to order
// 7. Return { GatewayPageURL }
```

### payment-ipn edge function

```typescript
// POST from SSLCommerz with form data including tran_id, val_id, status, etc.
// 1. Parse form body
// 2. Validate with SSLCommerz validation API:
//    GET /validator/api/validationserverAPI.php?val_id=X&store_id=Y&store_passwd=Z
// 3. If VALID/VALIDATED:
//    - Update order status = 'paid', save val_id
//    - Add credits to user's profile
// 4. Return 200 OK
```

### SSLCommerz URLs
- Sandbox init: `https://sandbox.sslcommerz.com/gwprocess/v4/api.php`
- Sandbox validate: `https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php`
- Live init: `https://securepay.sslcommerz.com/gwprocess/v4/api.php`
- Live validate: `https://securepay.sslcommerz.com/validator/api/validationserverAPI.php`

### Files to Create/Modify

| File | Change |
|------|--------|
| Database migration | Create `orders` table with RLS |
| `supabase/functions/initiate-payment/index.ts` | New: create order + call SSLCommerz init API |
| `supabase/functions/payment-ipn/index.ts` | New: validate payment + grant credits |
| `supabase/config.toml` | Add verify_jwt=false for both new functions |
| `src/components/pricing/PricingModal.tsx` | Add payment initiation on button click |
| `src/pages/PaymentResult.tsx` | New: success/fail/cancel result page |
| `src/App.tsx` | Add payment result routes |

### Secrets Needed
- `SSLCOMMERZ_STORE_ID` -- your store ID
- `SSLCOMMERZ_STORE_PASSWD` -- your store password
- `SSLCOMMERZ_IS_SANDBOX` -- "true" for testing, "false" for live

