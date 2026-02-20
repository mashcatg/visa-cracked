

# Plan: PDF Fix, AI Mock Naming, Interview Room UI, Processing States, Report UI, Search Drawer, Auto-Stop

This plan covers 9 distinct issues reported by the user.

---

## 1. Fix PDF Download -- "Failed to load PDF document"

**Problem:** The `generate-report-pdf` edge function generates plain text but the client tries to open it as a PDF (`application/pdf`). The browser fails because it's not a valid PDF.

**Solution:** Change the download to produce a `.txt` file instead of faking a PDF. Update the client-side blob type to `text/plain` and the filename to `.txt`.

**File:** `src/pages/InterviewReport.tsx`
- Change `type: "application/pdf"` to `type: "text/plain"`
- Change filename from `.pdf` to `.txt`
- Update button label from "PDF" to "Download Report"

Also update `generate-report-pdf/index.ts` CORS headers to match the standard pattern.

---

## 2. AI-Generated Mock Test Name (via Gemini during Analysis)

**Problem:** Mock tests currently get a manual name or default. User wants Gemini to generate a creative name during report analysis.

**Solution:** In `analyze-interview/index.ts`, add `"mock_name"` to the JSON schema requested from the AI. After getting the response, update the interview's `name` field with the AI-generated name.

Add to the AI prompt:
```
"mock_name": "<creative 3-5 word name for this mock test based on the interview context, e.g. 'The Confident Scholar' or 'Financial Clarity Challenge'>"
```

After analysis, update the interview:
```typescript
await serviceClient.from("interviews").update({ name: analysis.mock_name }).eq("id", interviewId);
```

**File:** `supabase/functions/analyze-interview/index.ts`

---

## 3. Sidebar -- Fix Horizontal Scroll + Truncate Mock Names

**Problem:** Long mock names cause horizontal overflow/scroll in the sidebar.

**Solution:** Already using `truncate` class on the name span, but the parent container needs `overflow-hidden` and `min-w-0`. Add `overflow-x-hidden` to the nav container and ensure each mock item has `min-w-0` on the flex container.

**File:** `src/components/layout/AppSidebar.tsx`
- Add `overflow-x-hidden` to the nav element
- Add `min-w-0` to the mock item's parent div
- Ensure `max-w-[calc(100%-2rem)]` on the name span for proper truncation with the 3-dot menu

---

## 4. Interview Room -- Dark Green Background + Better UI

**Problem:** The interview room uses `bg-[#1a1a2e]` (dark navy). User wants dark green from the brand color codes (primary is `hsl(168 100% 11%)` which is `#003B36` -- a deep dark green/teal).

**Solution:** Replace all `#1a1a2e`, `#0f0f23`, `#16162a` color references with the brand dark green palette:
- Main bg: `bg-[#003B36]` (primary dark green)
- Gradient: `from-[#002A26] via-[#003B36] to-[#002A26]`
- Header/controls bar: `bg-[#002A26]/80`
- PIP cam-off bg: `bg-[#003B36]`

**File:** `src/pages/InterviewRoom.tsx`

---

## 5. Processing Screen -- Animated Rotating Messages + Longer Wait

**Problem:** After call ends, it just shows "Analyzing your mock test..." forever. User wants rotating motivational/info texts and acknowledgment that it takes 1-2 minutes.

**Solution:** Add an array of rotating messages that cycle every 4 seconds:
```
"Fetching your interview transcript..."
"Analyzing your responses with AI..."
"Evaluating grammar and pronunciation..."
"Checking for red flags..."
"Generating detailed feedback..."
"Scoring your confidence level..."
"Almost there, preparing your report..."
```

Show a progress-like indicator and "This usually takes 1-2 minutes" text.

**File:** `src/pages/InterviewRoom.tsx` -- the `isProcessing` block

---

## 6. Auto-Stop When Bot Says "Call Ended"

**Problem:** When the Vapi assistant says goodbye/ends the call, the webcall should auto-stop.

**Solution:** In the `vapi.on("message")` handler, check if the assistant's transcript contains phrases like "call ended", "goodbye", "interview is over", "that concludes". If detected, call `vapiRef.current?.stop()` after a 2-second delay.

Also listen for the Vapi `call-end` event which already triggers `handleCallEnd` -- but add detection of the bot's farewell message to proactively end the call from the client side.

**File:** `src/pages/InterviewRoom.tsx`

---

## 7. Search Modal as Drawer on Mobile + White Background for Mock Names

**Problem:** The CommandDialog (search palette) doesn't adapt to mobile and the mock names need white background styling.

**Solution:** In `DashboardLayout.tsx`, conditionally render the search as a `Drawer` (from vaul) on mobile instead of `CommandDialog`. Inside the drawer, show a search input and filtered list of mocks with white/light background cards.

**File:** `src/components/layout/DashboardLayout.tsx`

---

## 8. Report Page -- Fix "10min+ analyzing" Issue + UI Improvements

**Problem:** The report page shows "Analyzing..." indefinitely if the report hasn't been created yet. There's no polling or retry.

**Solution:** Add polling logic -- if `report` is null when the page loads but the interview status is "completed", poll the database every 5 seconds (up to 30 attempts = 2.5 minutes max) to check if the report has been generated.

Also improve the "analyzing" state to show the same rotating messages as the processing screen.

**File:** `src/pages/InterviewReport.tsx`

---

## 9. Summary of All File Changes

| File | Change |
|------|--------|
| `src/pages/InterviewRoom.tsx` | Dark green bg, rotating processing messages, auto-stop on bot farewell, better UI |
| `src/pages/InterviewReport.tsx` | Fix PDF download as text, add polling for report, improve analyzing state |
| `src/components/layout/DashboardLayout.tsx` | Search as Drawer on mobile with white bg |
| `src/components/layout/AppSidebar.tsx` | Fix sidebar overflow, truncation |
| `supabase/functions/analyze-interview/index.ts` | Add mock_name to AI prompt, update interview name |
| `supabase/functions/generate-report-pdf/index.ts` | Fix CORS headers |

No database migrations needed.

