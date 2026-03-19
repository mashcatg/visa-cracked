

# Fix Build Errors, Deploy Extract-Document, Fix Form Builder UX

## Analysis of Current State

The extract-document edge function already correctly fetches dynamic fields from `visa_type_form_fields` based on `visa_type_id` and uses them for both heuristic and AI extraction. It's ready to deploy -- just needs the build errors fixed first.

## 1. Fix Build Errors (5 edge functions + edge-runtime.d.ts)

**`error.message` on unknown type** -- 5 catch blocks use `error.message` without casting. Fix by casting to `Error`:
- `analyze-interview/index.ts` line 484: `(error as Error).message`
- `fetch-vapi-data/index.ts` line 131: same
- `generate-report-pdf/index.ts` line 284: same
- `get-interview-results/index.ts` line 145: same
- `process-referral/index.ts` line 46: `(err as Error).message`

**`Deno` redeclaration** in `edge-runtime.d.ts` -- the custom `declare const Deno` conflicts with Deno's built-in types. Fix by removing lines 5-10 (the Deno declaration), keeping only the module declaration for esm.sh.

## 2. Remove Default "New Section Title" Input from Form Builder

Currently, a "New Section Title" input with label is always shown at the top of the form builder dialog (both mobile and desktop). The user wants sections added only via the "Add Title" button.

**Fix**: Remove the always-visible "New Section Title" input + label block (lines 513-516 for mobile, lines 692-695 for desktop). Change the `addSection` function to prompt or add a section with empty title that the user types inline (in the section row's input). Remove the `newSectionTitle` state variable.

Updated `addSection`:
```typescript
function addSection() {
  setFormFields((prev) => [...prev, {
    item_type: "section",
    label: "", field_key: "", field_type: "text",
    placeholder: "", is_required: false,
    sort_order: prev.length, options: [],
    section_title: "",  // empty, user types inline
    layout_width: "1",
  }]);
}
```

## 3. Fix Section Title Input Losing Focus

The section title Input is inside a `draggable` div. When the user clicks/types in the input, the browser's drag behavior can steal focus. Also, React re-rendering with index-based keys can cause focus loss.

**Fix**:
- Add `onMouseDown={(e) => e.stopPropagation()}` and `draggable={false}` to the section title Input elements (both mobile and desktop instances)
- Give sections stable unique keys using a generated ID when creating them (e.g., `crypto.randomUUID()`)

## 4. Deploy extract-document

Once build errors are resolved, the function deploys automatically. It already:
- Accepts `visa_type_id` in the request body
- Fetches dynamic fields from `visa_type_form_fields`
- Uses Mistral OCR + Gemini 2.5 Flash to extract only those field keys
- Returns matched key-value pairs with `__debug` metadata

No code changes needed to the function itself.

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/edge-runtime.d.ts` | Remove `Deno` declaration (keep module declaration) |
| `supabase/functions/analyze-interview/index.ts` | Cast error to `Error` in catch |
| `supabase/functions/fetch-vapi-data/index.ts` | Cast error to `Error` in catch |
| `supabase/functions/generate-report-pdf/index.ts` | Cast error to `Error` in catch |
| `supabase/functions/get-interview-results/index.ts` | Cast error to `Error` in catch |
| `supabase/functions/process-referral/index.ts` | Cast err to `Error` in catch |
| `src/pages/admin/AdminVisaTypes.tsx` | Remove always-visible section title input, fix inline section title input focus loss |

