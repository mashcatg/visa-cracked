# Onboarding, Document OCR, and Admin Judgment Prompts

## Overview

Four areas of work:

1. **Fix build error** -- resolve the `npm:openai` type resolution failure in edge functions
2. **User onboarding flow** -- collect social media links, WhatsApp number (required), and optional document upload (I-20 etc.) to auto-fill profile
3. **Document OCR pipeline** -- Mistral OCR to extract text, then Gemini 2.5 Flash to structure data into profile fields
4. **Admin-configurable judgment system prompts** per difficulty mode

---

## 1. Fix Build Error

The `jsr:@supabase/functions-js/edge-runtime.d.ts` import tries to resolve `npm:openai@^4.52.5`. Fix by replacing the type import across all edge functions:

- Remove `import "jsr:@supabase/functions-js/edge-runtime.d.ts";` from all edge function files
- It is only a type hint and not required for Deno.serve to work

Affected files: all 9 edge functions in `supabase/functions/*/index.ts`

---

## 2. Database Changes

### Extend `profiles` table

Add new columns via migration:

- `whatsapp_number` (text, nullable)
- `facebook_url` (text, nullable)
- `linkedin_url` (text, nullable)
- `instagram_url` (text, nullable)
- `onboarding_completed` (boolean, default false)
- `university_name` (text, nullable)
- `program_name` (text, nullable)
- `sevis_id` (text, nullable)
- `visa_country` (text, nullable)
- `visa_type` (text, nullable)
- `start_date` (text, nullable)

### Extend `difficulty_modes` table

Add new column:

- `judgment_system_prompt` (text, nullable) -- the system prompt used by the AI analysis for this specific difficulty mode

---

## 3. Onboarding Flow

### New page: `src/pages/Onboarding.tsx`

A multi-step onboarding wizard shown after first login if `onboarding_completed` is false:

**Step 1 -- Personal Info**

- WhatsApp number (required, with country code picker)
- Facebook URL (optional)
- LinkedIn URL (optional)
- Instagram URL (optional)

**Step 2 -- Visa Details (manual or upload)**

- Two options: "Upload Document (I-20, Offer Letter, etc.)" or "Enter Manually"
- **Upload path**: File upload -> sends to new `extract-document` edge function -> auto-fills fields
- **Manual path**: Form fields for university name, program, SEVIS ID, visa country, visa type, start date
- User can review and edit auto-filled data before saving

**Step 3 -- Confirmation**

- Review all info, click "Complete Setup"
- Sets `onboarding_completed = true`

### Route guard

In `DashboardPage.tsx` (or `RequireAuth`), check if `onboarding_completed` is false and redirect to `/onboarding`. Add route in `App.tsx`.

---

## 4. Document OCR Edge Function

### New edge function: `supabase/functions/extract-document/index.ts`

**Flow**:

1. Receives base64-encoded document (PDF/image) from the client
2. Calls Mistral OCR API (`mistral-ocr-latest`) to extract raw text
3. Sends extracted text to Gemini 2.5 Flash via Lovable AI Gateway with a structured extraction prompt
4. Returns structured JSON with fields: university_name, program_name, sevis_id, start_date, visa_type, student_name

**Requires**: `MISTRAL_API_KEY` secret (needs to be added)

---

## 5. Admin Judgment System Prompt

### Update `AdminVisaTypes.tsx` -- Difficulty Modes Dialog

Add a new "Judgment System Prompt" textarea field to each difficulty mode card (Easy, Medium, Hard). This prompt will be used by the `analyze-interview` edge function when evaluating mock tests of that difficulty.

### Update `analyze-interview` edge function

- After fetching the interview, also fetch the `difficulty_modes` record matching the interview's visa_type_id + difficulty
- If `judgment_system_prompt` is set, use it as the base system prompt for all 4 analysis workers instead of the generic one
- Fall back to the existing generic prompt if no custom prompt is configured

---

## Files Summary


| File                                            | Action                                                           |
| ----------------------------------------------- | ---------------------------------------------------------------- |
| All 9 edge functions                            | Remove `jsr:@supabase/functions-js/edge-runtime.d.ts` import     |
| Database migration                              | Add profile columns + judgment_system_prompt to difficulty_modes |
| `src/pages/Onboarding.tsx`                      | New -- multi-step onboarding wizard                              |
| `src/App.tsx`                                   | Add /onboarding route                                            |
| `src/pages/DashboardPage.tsx`                   | Redirect to onboarding if not completed                          |
| `supabase/functions/extract-document/index.ts`  | New -- Mistral OCR + Gemini extraction                           |
| `supabase/config.toml`                          | Add extract-document + validate-coupon entries                   |
| `src/pages/admin/AdminVisaTypes.tsx`            | Add judgment prompt textarea to modes dialog                     |
| `supabase/functions/analyze-interview/index.ts` | Use per-mode judgment prompt if configured                       |


---

## Technical Details

### Mistral OCR Call (in extract-document)

```text
POST https://api.mistral.ai/v1/ocr
Body: { document: { type: "document_url", document_url: "data:application/pdf;base64,..." }, model: "mistral-ocr-latest" }
```

### Gemini Extraction Prompt

After OCR, send text to Lovable AI Gateway with a structured extraction prompt asking for JSON output with specific fields (university, program, SEVIS, dates, etc.).

### Onboarding Guard Logic

In `DashboardPage.tsx`:

```text
1. Fetch profile where user_id = current user
2. If onboarding_completed is false, navigate to /onboarding
3. Otherwise render dashboard normally
```

### Judgment Prompt Usage

In `analyze-interview`, the current hardcoded system prompt:

```text
"You are an expert visa interview evaluator specializing in {country} {visaType}..."
```

Will be replaced by the admin-configured `judgment_system_prompt` from the difficulty mode when available, with the country/visa/difficulty interpolated into placeholders.  
  
  
**Plan Purchase Error**  
Edge Function returned a non-2xx status code

{

  "timestamp": 1773721304227,

  "error_type": "RUNTIME_ERROR",

  "filename": "supabase/functions/initiate-payment/index.ts",

  "lineno": 0,

  "colno": 0,

  "stack": "not_applicable",

  "has_blank_screen": true

}  
  
This error in many plans. also the 90$ plan should be 54$ and 5400 bdt for giving special 40% discount on the plan  
