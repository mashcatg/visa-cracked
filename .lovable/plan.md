


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
| judgment_system_prompt | text | Nullable, custom AI analysis prompt |
| created_at | timestamptz | Default now() |

- Unique constraint on (visa_type_id, difficulty) to prevent duplicates
- RLS: Admins can CRUD; authenticated users can SELECT

### Modify `interviews` table

- Add column `difficulty` (text, nullable, default null) to store the selected difficulty for each mock test

### Extend `profiles` table

- `whatsapp_number`, `facebook_url`, `linkedin_url`, `instagram_url`
- `onboarding_completed` (boolean, default false)

---

## 2. Admin Panel: Manage Difficulty Modes

### `AdminVisaTypes.tsx`

- "Modes" button on each visa type row opens a dialog with Easy/Medium/Hard cards
- Each card has: Assistant ID, Public Key, Private Key, Judgment System Prompt
- Upserts into `difficulty_modes`

---

## 3. Create Mock Test Modal

### `CreateInterviewModal.tsx`

Country -> Visa Type -> Difficulty (Easy / Medium / Hard) -> Start

---

## 4. Onboarding Flow

### `src/pages/Onboarding.tsx`

3-step wizard:
1. Contact & Social (WhatsApp required, Facebook/LinkedIn/Instagram optional)
2. Visa Details (upload document for OCR extraction or manual entry)
3. Review & Confirm

### `src/pages/DashboardPage.tsx`

Redirects to `/onboarding` if `onboarding_completed` is false.

---

## 5. Document OCR Pipeline

### `supabase/functions/extract-document/index.ts`

1. Receives base64 document
2. Mistral OCR (`mistral-ocr-latest`) extracts text
3. Gemini 2.5 Flash structures data into profile fields
4. Returns only dynamic data (added by admins as form filed from the admin panel)

---

## 6. Judgment System Prompt

### `analyze-interview` Edge Function

- Fetches `judgment_system_prompt` from `difficulty_modes` table
- Uses it as base system prompt for AI analysis (with {country}, {visaType}, {difficulty} placeholders)
- Falls back to generic prompt if not configured

---

## 7. Pricing Fix

- Ultimate plan: $54 / ৳5,400 (40% discount from original $90 / ৳9,000)
- Badge shows "🔥 40% OFF"
