

# Profile Completion, Dynamic Form Builder, Output Structure & VAPI Profile Context

## Overview

This is a large, multi-faceted request with 6 interconnected areas:

1. **Profile completion percentage** in sidebar + dashboard CTA
2. **Dynamic form builder** per visa type (admin creates custom fields)
3. **Restructured onboarding** (Country + Visa Type selection, then dynamic form)
4. **Output structure** per difficulty mode per visa type (admin-configurable JSON output template)
5. **Pass all profile data to VAPI** via `assistantOverrides.variableValues`
6. **Minimum profile completion gate** before starting a mock test

---

## 1. Profile Completion Percentage

### Calculation Logic
Profile fields grouped into categories with weights:
- **Social** (30%): whatsapp_number (required, 15%), facebook_url (5%), instagram_url (5%), linkedin_url (5%)
- **Visa Details** (70%): based on dynamic form fields filled (see below)

A utility function `calculateProfileCompletion(profile, formFields)` returns a rounded percentage.

### Sidebar (AppSidebar.tsx)
- Fetch profile completion on load alongside existing profile fetch
- Show percentage badge next to "Edit Full Profile" dropdown item: `Edit Full Profile` `75%`
- If < 100%, show in amber/orange; if 100%, show green checkmark

### Dashboard CTA (Dashboard.tsx)
- If completion < 100%, show a prominent alert card above the stats:
  - "Complete your profile to get better interview results"
  - Show circular/bar progress with percentage
  - "Complete Profile" button linking to `/profile/edit`

---

## 2. Dynamic Form Builder (Admin)

### Database: New table `visa_type_form_fields`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| visa_type_id | uuid | FK to visa_types |
| label | text | e.g. "University Name" |
| field_key | text | e.g. "university_name" (unique per visa type) |
| field_type | text | "text", "textarea", "date", "select", "number" |
| placeholder | text | Nullable |
| is_required | boolean | default false |
| sort_order | integer | for ordering |
| options | jsonb | For select type - array of options |
| created_at | timestamptz | |

Unique constraint on `(visa_type_id, field_key)`. RLS: admins CRUD, authenticated SELECT.

### Database: New table `user_visa_form_data`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | NOT NULL |
| visa_type_id | uuid | FK to visa_types |
| field_key | text | matches visa_type_form_fields.field_key |
| field_value | text | the user's answer |
| created_at | timestamptz | |

Unique constraint on `(user_id, visa_type_id, field_key)`. RLS: users own data, admins view all.

### Admin UI: Form Builder in `AdminVisaTypes.tsx`
- New button per visa type row: "Form Fields" (alongside existing Modes/Edit/Delete)
- Opens a dialog showing a list of configured fields
- Each field row: Label, Type dropdown, Placeholder, Required toggle, sort handle
- Add/remove fields, drag to reorder
- Save upserts into `visa_type_form_fields`

---

## 3. Restructured Onboarding Flow

### Updated `Onboarding.tsx`

**Step 1 -- Social Info**
- WhatsApp (required), Facebook, Instagram, LinkedIn (same as now)

**Step 2 -- Select Country + Visa Type**
- Country dropdown, then Visa Type dropdown (filtered by country)
- Saves selected country/visa type to profile

**Step 3 -- Dynamic Visa Form**
- Fetch `visa_type_form_fields` for the selected visa type
- Render form dynamically based on field configs
- OR upload document (OCR extracts and maps to matching field_keys)
- User reviews/edits, saves to `user_visa_form_data`

**Step 4 -- Review & Confirm**
- Shows all data, sets `onboarding_completed = true`

### Edit Profile Page
- Also updated to show the dynamic form fields based on user's selected visa type
- Users can change visa type and re-fill the form

---

## 4. Output Structure per Difficulty Mode

### Database: Add column to `difficulty_modes`
- `output_structure` (jsonb, nullable) -- the JSON template that defines expected analysis output

### Admin UI: In Difficulty Modes dialog
- Add "Output Structure (JSON)" textarea below the judgment system prompt
- Admin pastes the full JSON template (like the examples provided)
- Validated as valid JSON before saving

### Backend: `analyze-interview` edge function
- When `output_structure` is set, include it in the AI prompt: "Return your analysis in exactly this JSON structure: {output_structure}"
- The existing 4-worker system stays, but if an output_structure is provided, use a SINGLE worker that returns the complete structured output instead
- Store the full structured result in `interview_reports.detailed_feedback` (jsonb)

---

## 5. Pass All Profile Data to VAPI

### `start-interview` edge function
- Already fetches profile and returns `variableValues` with university, program, etc.
- **Extend**: Also fetch `user_visa_form_data` for the user's visa type and include ALL dynamic form field values in `variableValues`
- Each field_key becomes a variable: `variableValues[field_key] = field_value`

### `InterviewRoom.tsx`
- Already passes `data.variableValues` to `vapi.start()` -- no change needed since the edge function will include all fields

---

## 6. Minimum Profile Completion Gate

### `CreateInterviewModal.tsx`
- Before allowing "Start Mock Test", check profile completion
- If < 60% (configurable), show message: "Please complete at least 60% of your profile before starting a mock test"
- Button links to `/profile/edit`
- If >= 60%, proceed normally

---

## Files Summary

| File | Action |
|------|--------|
| Database migration | Create `visa_type_form_fields`, `user_visa_form_data` tables; add `output_structure` to `difficulty_modes` |
| `src/lib/profile-completion.ts` | New -- utility to calculate completion % |
| `src/components/layout/AppSidebar.tsx` | Show completion % next to Edit Profile |
| `src/pages/Dashboard.tsx` | Add profile completion CTA card |
| `src/pages/admin/AdminVisaTypes.tsx` | Add Form Builder dialog + output structure textarea in modes dialog |
| `src/pages/Onboarding.tsx` | Restructure: Social -> Country/Visa -> Dynamic Form -> Review |
| `src/pages/EditProfilePage.tsx` | Show dynamic form fields based on user's visa type |
| `src/components/interview/CreateInterviewModal.tsx` | Add 60% completion gate |
| `supabase/functions/start-interview/index.ts` | Include all dynamic form data in variableValues |
| `supabase/functions/analyze-interview/index.ts` | Use output_structure when available |

---

## Build Error Fix

The `npm:@supabase/realtime-js@2.99.2` error in edge functions needs to be fixed by pinning the supabase-js import. Change all edge functions from:
```
import { createClient } from "jsr:@supabase/supabase-js@2";
```
to:
```
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
```

