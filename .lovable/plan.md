
# Transactions, Admin Audio Access, and USD Payment Fix

## Overview
Four areas of work:
1. **Transactions page** for users (in profile dropdown) and admins (new admin tab) with invoice download
2. **Admin access to audio and conversations** on interview reports  
3. **Fix OAuth redirect** (still landing on /login)
4. **Fix USD payment** -- update prices to $8/$15/$28 and ensure SSLCommerz receives `currency: "USD"`

---

## 1. Transactions

### User Transactions
- Add a "Transactions" menu item in the user profile dropdown (both desktop sidebar and mobile dropdown)
- Clicking it opens a dialog/drawer showing the user's orders from the `orders` table
- Each row shows: Date, Plan, Amount (with currency symbol), Status (paid/pending/failed)
- A "Download Invoice" button on each paid order generates a simple text-based invoice

### Admin Transactions Tab
- New tab "Transactions" in the Admin Panel layout
- New page `src/pages/admin/AdminTransactions.tsx`
- Table showing ALL orders with columns: User, Email, Plan, Amount, Currency, Status, Date, Invoice
- Search by user name/email, filter by status
- CSV export support (following existing admin patterns)
- Admin can also download invoices for any paid order

### Invoice Generation
- Create a new edge function `generate-invoice` that builds a simple PDF invoice using `pdf-lib`
- Invoice includes: Transaction ID, Date, User Name, Email, Plan Name, Amount, Currency, Status
- Both users and admins can trigger this

---

## 2. Admin Audio and Conversation Access

**Problem**: The `fetch-vapi-data` edge function checks `interview.user_id !== userData.user.id` and returns 403 for admins viewing other users' reports.

**Fix**: Update `fetch-vapi-data` to also allow access if the requesting user has the `admin` role. Check for admin role using the `has_role` database function before the ownership check.

This will automatically make the audio player and conversation transcript visible to admins when they click "View Report" on the Admin Mock Tests table.

---

## 3. Fix OAuth Redirect

**Root cause**: The `RequireAuth` component's timer-based approach is unreliable. The `lovable.auth.signInWithOAuth` function redirects to Google, then returns to `/login` (or `/signup`). On return, it calls `supabase.auth.setSession(result.tokens)`. But if the redirect happens before `setSession` completes, the user gets bounced.

**Fix**: The current Login/Signup pages already have `useEffect` that redirects to `/dashboard` when `session` appears. The issue is `RequireAuth`'s redirect fires too fast when users navigate to `/dashboard` directly after OAuth. We need to make `RequireAuth` more resilient:

- Remove the timer-based approach entirely
- Instead, only redirect to `/login` after confirming the session is truly absent (not just loading)
- Add a `sessionChecked` flag that only becomes true after `getSession()` resolves AND `onAuthStateChange` has fired at least once
- This ensures we never redirect during the initial auth check window

---

## 4. Fix USD Payment System

**Price Update**: Change USD prices from $7/$13/$25 to $8/$15/$28 in both frontend and backend.

**Backend Changes** (`initiate-payment`):
- Update the PLANS constant to `{ bdt: 800, usd: 8, credits: 100 }`, `{ bdt: 1500, usd: 15, credits: 200 }`, `{ bdt: 2800, usd: 28, credits: 400 }`
- When `currency === "USD"`, send `currency: "USD"` to SSLCommerz (already partially done, just ensure it's correct)
- Use `value_a` for the user ID (already done), keep the flow clean

**Frontend Changes** (`PricingModal.tsx`):
- Update USD prices to match: $8, $15, $28
- Ensure the IP detection properly toggles currency

---

## Technical Details

### Database Changes
- No new tables needed -- `orders` table already exists with all required fields
- Need to add admin RLS policy for orders if not already present (already has "Admins can view all orders" -- confirmed)

### New Files

| File | Description |
|------|-------------|
| `src/pages/admin/AdminTransactions.tsx` | Admin transactions table |
| `supabase/functions/generate-invoice/index.ts` | PDF invoice generator |

### Modified Files

| File | Changes |
|------|---------|
| `src/lib/auth.tsx` | Fix RequireAuth to be more robust -- use a proper `sessionChecked` state |
| `src/components/layout/AppSidebar.tsx` | Add "Transactions" item to user dropdown (both desktop + mobile) |
| `src/pages/admin/AdminLayout.tsx` | Add "Transactions" tab |
| `src/pages/AdminPage.tsx` | Add transactions route |
| `supabase/functions/fetch-vapi-data/index.ts` | Allow admin access (skip ownership check for admins) |
| `supabase/functions/initiate-payment/index.ts` | Update USD prices to $8/$15/$28 |
| `src/components/pricing/PricingModal.tsx` | Update USD prices to $8/$15/$28 |
| `supabase/config.toml` | Add generate-invoice function config |

### User Transactions UI
- Desktop: New "Transactions" item in the profile dropdown menu (with a Receipt icon)
- Mobile: Same item in the mobile dropdown
- Opens a Dialog (desktop) / Drawer (mobile) listing the user's orders
- Each paid order has a "Download Invoice" button

### Invoice Content
Simple PDF with:
- Company logo and name at top
- "INVOICE" header
- Transaction ID, Date
- Customer name and email
- Plan name, credits included
- Amount with currency
- Payment status
- "Thank you for your purchase" footer
