

# Add Difficulty Modes to Mock Test System

## Overview

Restructure the mock test creation flow to include difficulty selection (Easy / Medium / Hard). Each difficulty mode has its own VAPI credentials, managed through a new admin interface. This replaces the current system where VAPI credentials live directly on visa types.

Also fixes the build error caused by a missing `validate-coupon` entry in `supabase/config.toml`.

---

## Current Flow vs New Flow

```text
CURRENT:  Country -> Visa Type (has VAPI creds) -> Start
NEW:      Country -> Visa Type -> Difficulty (Easy/Medium/Hard, has VAPI creds) -> Start
```

---

## 1. Database Changes

### New table: `difficulty_modes`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, default gen_random_uuid() |
| visa_type_id | uuid | FK to visa_types.id, NOT NULL |
| difficulty | text | "easy", "medium", or "hard" |
| vapi_assistant_id | text | Nullable |
| vapi_public_key | text | Nullable |
| vapi_private_key | text | Nullable |
| created_at | timestamptz | Default now() |

- Unique constraint on (visa_type_id, difficulty) to prevent duplicates
- RLS: Admins can CRUD; authenticated users can SELECT

### Modify `interviews` table

- Add column `difficulty` (text, nullable, default null) to store the selected difficulty for each mock test

### Remove VAPI columns from `visa_types` (optional, deferred)

Keep existing columns on visa_types for backward compatibility but stop using them once difficulty_modes is in place. No migration needed to drop them now.

---

## 2. Admin Panel: Manage Difficulty Modes

### Update `AdminVisaTypes.tsx`

- Remove the VAPI Configuration section from the visa type edit dialog (since VAPI creds move to difficulty modes)
- Add a "Modes" button on each visa type row that opens a sub-dialog to manage Easy/Medium/Hard modes
- The modes dialog shows 3 cards (Easy, Medium, Hard), each with:
  - Assistant ID input
  - Public Key input
  - Private Key input
  - Save button per mode
- When saving, upsert into `difficulty_modes` for that visa_type_id + difficulty

---

## 3. Create Mock Test Modal

### Update `CreateInterviewModal.tsx`

Add a third step after visa type selection:

```text
Country -> Visa Type -> Difficulty (Easy / Medium / Hard)
```

- After selecting a visa type, fetch available difficulty modes from `difficulty_modes` where `visa_type_id = selected`
- Show only difficulties that have been configured (have VAPI credentials)
- Use radio-style cards or a Select dropdown for the 3 difficulty options
- Store the selected difficulty when creating the interview
- Pass `difficulty` to the `interviews` insert

---

## 4. Update `start-interview` Edge Function

Currently queries `visa_types(vapi_assistant_id, vapi_public_key, vapi_private_key)`. Change to:

- Read the `difficulty` from the interview record
- Query `difficulty_modes` where `visa_type_id` matches AND `difficulty` matches
- Use those VAPI credentials instead
- Fallback: if no difficulty mode found, fall back to visa_type credentials (backward compatibility)

---

## 5. Fix Build Error

Add the missing `validate-coupon` function entry to `supabase/config.toml`:

```toml
[functions.validate-coupon]
verify_jwt = false
```

---

## Files Summary

| File | Action |
|------|--------|
| Database migration | Create `difficulty_modes` table + add `difficulty` column to `interviews` |
| `supabase/config.toml` | Add `validate-coupon` entry |
| `src/pages/admin/AdminVisaTypes.tsx` | Remove VAPI section, add "Modes" button with difficulty management dialog |
| `src/components/interview/CreateInterviewModal.tsx` | Add difficulty selection step |
| `supabase/functions/start-interview/index.ts` | Fetch VAPI creds from `difficulty_modes` instead of `visa_types` |
| `src/integrations/supabase/types.ts` | Auto-updated after migration |

---

## Technical Notes

- The `difficulty_modes` table uses a unique constraint on `(visa_type_id, difficulty)` to ensure only one config per difficulty per visa type
- In the Create Mock Test modal, only difficulties with configured VAPI credentials are shown as selectable (others are grayed out or hidden)
- The interview name will include difficulty: e.g., "US F1 Student Visa Mock (Hard)"
- Existing interviews without a difficulty value remain functional -- the start-interview function falls back to visa_type credentials
