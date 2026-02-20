

# Plan: Major Update -- Failed Call Handling, Report Overhaul, Mock Room UI, Sidebar Actions, Poppins Font, Public Sharing

This is a large update covering 8 areas. Here is everything broken down.

---

## 1. Handle Failed Calls -- No Report, No Credit Deduction

**Problem:** Credits are deducted when creating a mock (before the call even starts). If the call fails, credits are lost and a broken report is shown.

**Solution:**
- Move credit deduction from `CreateInterviewModal` to the `get-interview-results` edge function -- only deduct after a successful call (status = "ended")
- In `get-interview-results`, check Vapi's `callData.status`. If it is NOT "ended" (e.g. failed, no-answer), mark the interview as "failed" and skip credit deduction
- In `InterviewRoom.tsx` `handleCallEnd`, if the call failed, show a toast and redirect to dashboard instead of the report page
- In `InterviewReport.tsx`, if interview status is "failed", show a "Call Failed" message instead of analysis

**Files changed:**
- `src/components/interview/CreateInterviewModal.tsx` -- remove credit deduction
- `supabase/functions/get-interview-results/index.ts` -- add status check, deduct credits only on success
- `src/pages/InterviewRoom.tsx` -- handle failed status in post-call flow
- `src/pages/InterviewReport.tsx` -- show failed state

---

## 2. Fix Report Generation -- Use Vapi Messages + Lovable AI Gateway

**Problem:** The analyze-interview function uses a direct Gemini API key instead of the Lovable AI gateway. The transcript may be empty if Vapi hasn't finished processing. The prompt needs to be richer.

**Solution:**
- In `get-interview-results`, add a retry mechanism -- wait 5-10 seconds and retry the Vapi GET call if transcript is missing (recordings take a few seconds)
- Store the full `messages` array (role + content per message) from Vapi
- In `analyze-interview`, switch from direct Gemini API to the **Lovable AI Gateway** (`https://ai.gateway.lovable.dev/v1/chat/completions`) using `LOVABLE_API_KEY`
- Use the structured messages array (not just plain transcript) for richer context
- Expand the AI prompt to include more evaluation categories: pronunciation assessment, vocabulary range, response relevance, hesitation patterns, body language notes (from transcript cues), follow-up questions the officer might ask
- Add new fields to the `interview_reports` table: `pronunciation_score`, `vocabulary_score`, `response_relevance_score`, `detailed_feedback` (JSON with per-question breakdown)

**Database migration:**
```sql
ALTER TABLE public.interview_reports 
  ADD COLUMN pronunciation_score integer,
  ADD COLUMN vocabulary_score integer,
  ADD COLUMN response_relevance_score integer,
  ADD COLUMN detailed_feedback jsonb;
```

**Files changed:**
- `supabase/functions/get-interview-results/index.ts` -- add retry logic for Vapi data
- `supabase/functions/analyze-interview/index.ts` -- switch to Lovable AI, enhanced prompt, more fields
- Database migration for new columns

---

## 3. Redesigned Report Page (Inspired by Reference Images)

**Problem:** Current report is basic cards stacked vertically. The reference images show a two-column layout with transcript on the left and report summary on the right.

**New Layout:**
- **Header area**: Mock name, country/visa info, action buttons (Share, Delete, Play Recording, Download PDF)
- **Two-column layout** (stacks on mobile):
  - **Left column**: Scrollable chat-style transcript (messages rendered as bubbles -- user messages right-aligned in accent color, assistant messages left-aligned in muted), with a copy button
  - **Right column**: Report card with sections for Overall Score (large circular badge), Category Scores, Key Observations, Grammar Mistakes, Red Flags, Improvement Plan, Follow-up Questions
- **Below**: AI Summary section, Metadata (duration, status, date)
- Responsive: on mobile, transcript and report stack vertically

**Files changed:**
- `src/pages/InterviewReport.tsx` -- complete redesign

---

## 4. Mock Room UI Overhaul

**Problem:** The self-view video (PIP) appears below the subtitles instead of overlaying the interviewer area. The layout doesn't feel like a real meeting app.

**Solution:**
- Restructure the layout: the main area is a grid with interviewer on top and controls at bottom
- Self-view PIP is absolutely positioned in the **top-right corner** of the interviewer area (not below subtitles)
- Subtitles appear as a floating overlay at the **bottom** of the interviewer area (semi-transparent, like real video call captions)
- Improve the interviewer avatar with a subtle gradient orb animation (inspired by the reference mobile screenshot)
- Better mobile layout: PIP smaller, subtitles condensed

**Files changed:**
- `src/pages/InterviewRoom.tsx` -- layout restructure

---

## 5. Sidebar -- 3-Dot Menu on Recent Mocks (Share, Rename, Delete)

**Solution:**
- On each recent mock item in the sidebar, show a vertical 3-dot icon on hover
- Clicking opens a dropdown with: Share, Rename, Delete
- **Share**: generates a public URL `/mock/:id/public` and copies to clipboard
- **Rename**: inline edit or small dialog to update `interviews.name`
- **Delete**: confirmation dialog, then deletes the interview + report

**Database changes:**
- Add `is_public` boolean column to `interviews` table (default false)
- Add a public route `/mock/:id/public` that fetches interview + report without auth

```sql
ALTER TABLE public.interviews ADD COLUMN is_public boolean NOT NULL DEFAULT false;
```

**New RLS policy:** Allow anonymous SELECT on interviews where `is_public = true`

**Files changed:**
- `src/components/layout/AppSidebar.tsx` -- add hover 3-dot menu with dropdown
- `src/App.tsx` -- add public report route
- `src/pages/PublicReportPage.tsx` -- new page for public viewing (no auth required)
- Database migration + RLS policy

---

## 6. Poppins Font Everywhere

**Solution:**
- Replace DM Sans + Space Grotesk imports with Poppins (weights 300-700)
- Update `src/index.css` to use `font-family: 'Poppins', sans-serif` for both body and headings

**Files changed:**
- `src/index.css`

---

## 7. Deduct Credits Only After Successful Call (Recap)

The credit flow changes to:
1. User creates mock -- interview record created, NO credits deducted yet
2. Call happens via Vapi
3. Call ends -- `get-interview-results` fetches Vapi data
4. If call status is "ended" (success) -- deduct 10 credits
5. If call failed -- mark interview as "failed", no credit deduction
6. Then `analyze-interview` runs only if status is "completed"

---

## 8. Summary of All Files Changed

| File | Change |
|------|--------|
| `src/index.css` | Poppins font |
| `src/components/interview/CreateInterviewModal.tsx` | Remove credit deduction |
| `src/components/layout/AppSidebar.tsx` | 3-dot hover menu on recent mocks |
| `src/pages/InterviewRoom.tsx` | Layout fix (PIP position, subtitles overlay), handle failed calls |
| `src/pages/InterviewReport.tsx` | Complete redesign with 2-column layout, chat transcript, richer report |
| `src/pages/PublicReportPage.tsx` | New -- public report view |
| `src/App.tsx` | Add public report route |
| `supabase/functions/get-interview-results/index.ts` | Retry logic, credit deduction, status check |
| `supabase/functions/analyze-interview/index.ts` | Switch to Lovable AI, enhanced prompt, more fields |
| Database migration | New columns on interview_reports, is_public on interviews, RLS for public access |

