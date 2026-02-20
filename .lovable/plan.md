

# Plan: Parallel AI Analysis + Interview Room & Report Page Perfection

## Problem Summary

1. AI analysis takes 10+ minutes or never completes -- single Gemini call is too slow/unreliable
2. Report page shows "Fetching your interview transcript..." text and "This usually takes 1-2 minutes" -- should be removed
3. Report page needs proper shimmer skeleton placeholder cards per section
4. Interview room "Connecting to Interviewer..." should use rotating messages
5. User subtitles look weak/shrinking in the interview room
6. User camera needs more space (Google Meet style)
7. Transcript should show user on right, officer on left (chat style)
8. No timeout/failure handling -- if AI never responds, user is stuck forever
9. Need a "Regenerate Report" button when analysis fails
10. Need to tell Gemini if the call was auto-cut due to time limit (bad impression)

## Architecture Change: Parallel AI Workers

Instead of one big Gemini call that generates everything, split into 3-4 parallel calls that each produce a subset of the report. This dramatically reduces wait time and lets results appear progressively.

```text
Current: 1 big Gemini call -> all scores + feedback + summary (slow, fragile)

New: 4 parallel Gemini calls, each filling different DB columns:
  Worker 1: Summary + mock_name + overall_score (fast, ~10s)
  Worker 2: Category scores (7 scores) (~10s)
  Worker 3: Grammar mistakes + red flags + improvement plan (~15s)
  Worker 4: Detailed per-question feedback (~20s)
```

The report page polls every 5 seconds. As each worker finishes, its section fills in and the shimmer disappears for that section only.

---

## File Changes

### 1. Edge Function: `analyze-interview/index.ts` -- Parallel Workers

Replace the single AI call with 4 parallel `Promise.all` calls to Gemini, each with a focused prompt. Each worker writes its results to `interview_reports` independently using upsert.

Flow:
- First, upsert a blank `interview_reports` row so the report page knows analysis has started
- Fire 4 parallel AI calls
- Each call, on completion, updates the specific columns it owns
- If any call fails, the other results still land
- Include `endedReason` context: if the call was auto-cut (e.g., `endedReason === "max-duration-reached"`), tell Gemini this is a bad impression

Worker assignments:
- **Worker 1 (Quick Summary)**: `mock_name`, `overall_score`, `summary`
- **Worker 2 (Scores)**: `english_score`, `confidence_score`, `financial_clarity_score`, `immigration_intent_score`, `pronunciation_score`, `vocabulary_score`, `response_relevance_score`
- **Worker 3 (Issues)**: `grammar_mistakes`, `red_flags`, `improvement_plan`
- **Worker 4 (Feedback)**: `detailed_feedback`

### 2. Report Page: `InterviewReport.tsx` -- Progressive Loading

Major changes:
- Remove the "Fetching your interview transcript..." rotating messages and "This usually takes 1-2 minutes" text
- Each section (summary, scores, grammar, feedback, etc.) gets its own shimmer skeleton placeholder card
- As polling detects data arriving for a section, that section's shimmer is replaced with real data
- Audio player, transcript/chat, duration, cost show immediately from Vapi data (no shimmer needed for these)
- After 2 minutes of polling with no report data at all, show a failure message with a "Regenerate Report" button
- "Regenerate Report" button calls `analyze-interview` again
- Transcript chat: user messages aligned right, officer messages aligned left (already implemented, keeping it)

### 3. Interview Room: `InterviewRoom.tsx` -- UI Improvements

- **Connecting screen**: Replace static "Connecting to interviewer..." with rotating messages:
  - "Preparing your interview environment..."
  - "Setting up secure connection..."
  - "Loading interview questions..."
  - "Almost ready..."
- **User camera bigger**: Make the user video the main view (like Google Meet where the active speaker is large). The officer avatar becomes a smaller element overlaid or placed in a sidebar. Layout: user video fills the main area, officer avatar is a floating card in the corner
- **Subtitles**: Make user subtitles stronger (same text size and opacity as officer, just different color). Remove the shrinking/weak styling. Both use white text, user gets accent label, officer gets white/50 label
- **Processing screen**: Already navigates to report page immediately -- keep this behavior. Remove the processing screen entirely since the user goes straight to the report page

### 4. CSS: `src/index.css` -- No major changes needed

Existing shimmer classes are sufficient.

---

## Technical Details

### analyze-interview Parallel Workers

Each worker calls the same Lovable AI Gateway endpoint but with a smaller, focused prompt:

```text
Worker 1 prompt: "Return JSON with mock_name, overall_score (0-100), summary (3-4 sentences)"
Worker 2 prompt: "Return JSON with english_score, confidence_score, ... (7 scores, each 0-100)"
Worker 3 prompt: "Return JSON with grammar_mistakes array, red_flags array, improvement_plan array"
Worker 4 prompt: "Return JSON with detailed_feedback array (per-question analysis)"
```

Each worker does its own `serviceClient.from("interview_reports").update(...)` on completion.

The initial upsert creates the row with null values so the report page can detect "analysis started" vs "no analysis yet."

### Report Page Progressive Detection

The polling checks which fields are non-null:
- `summary !== null` -> show summary section
- `english_score !== null` -> show all category scores
- `grammar_mistakes` is not empty array -> show grammar section
- `detailed_feedback` is not empty array -> show feedback section

Each section independently transitions from shimmer to content.

### Interview Room Layout

```text
Current layout:
  [Officer avatar - full screen]
  [User PIP - small corner]

New layout (Google Meet style):
  [User video - fills ~75% of screen]
  [Officer avatar - floating card, top-left corner with speaking indicator]
  [Subtitles - bottom center overlay]
```

### Call End Context for Gemini

The `analyze-interview` function already fetches the interview. Add: fetch `endedReason` from Vapi data (call `fetch-vapi-data` internally or pass it). If `endedReason` contains "max-duration" or similar, append to the prompt:

"Note: This interview was automatically terminated because the maximum time limit was reached. The applicant did not finish the interview naturally. This should be considered a negative factor in the evaluation."

---

## File Summary

| File | Change |
|------|--------|
| `supabase/functions/analyze-interview/index.ts` | Split into 4 parallel AI workers, each updating its own DB columns. Add call-end context. |
| `src/pages/InterviewReport.tsx` | Progressive per-section loading, remove "Fetching transcript" text, add 2-min timeout with regenerate button, shimmer per section |
| `src/pages/InterviewRoom.tsx` | User video as main view, officer as floating card, rotating connecting messages, stronger subtitles, remove processing screen |

No database migrations needed -- existing `interview_reports` columns support partial updates.

