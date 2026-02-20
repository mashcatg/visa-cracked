

# Plan: Fetch Vapi Data Live (No DB Storage) + Perfect Report Page

## Core Architecture Change

Currently, `get-interview-results` fetches Vapi data and stores transcript, messages, recording_url, duration, and cost in the `interviews` table. The user wants to stop storing these and always fetch them live from the Vapi API.

```text
Current Flow:
  Call ends -> get-interview-results -> saves audio/transcript/messages to DB -> report reads from DB

New Flow:
  Call ends -> get-interview-results -> only marks status + deducts credits (no data storage)
  Report page -> calls new "fetch-vapi-data" edge function -> gets audio/transcript/messages/duration/cost live from Vapi API
```

---

## Changes

### 1. New Edge Function: `fetch-vapi-data`

**File:** `supabase/functions/fetch-vapi-data/index.ts`

A simple authenticated edge function that:
- Takes `interviewId` in the request body
- Looks up the `vapi_call_id` from the `interviews` table
- Calls `GET https://api.vapi.ai/call/{callId}` with `VAPI_PRIVATE_KEY`
- Returns the relevant fields to the frontend:
  - `recordingUrl` (from `callData.artifact.recordingUrl`)
  - `transcript` (from `callData.artifact.transcript`)
  - `messages` (from `callData.artifact.messages`)
  - `duration` (from `callData.duration`)
  - `cost` (from `callData.cost`)
  - `endedReason` (from `callData.endedReason`)
- Includes retry logic (if recordingUrl is missing, wait 5s and retry once)

### 2. Simplify `get-interview-results`

**File:** `supabase/functions/get-interview-results/index.ts`

Remove the lines that store transcript, messages, recording_url, duration, cost in the DB. Only update:
- `status` ("completed" or "failed")
- `ended_at`

Keep the credit deduction logic and failure detection logic unchanged.

### 3. Report Page -- Fetch Vapi Data Live

**File:** `src/pages/InterviewReport.tsx`

On page load:
1. Fetch interview record from DB (for status, country, visa type, vapi_call_id existence)
2. If status is "completed" and vapi_call_id exists, call `fetch-vapi-data` edge function to get audio, transcript, messages, duration, cost
3. Show audio player, chat transcript, duration, and cost immediately from the Vapi response
4. Continue polling for the AI-generated report (scores, feedback, etc.) as before

Add a metadata bar showing duration and cost (e.g., "Duration: 4m 32s | Cost: $0.18").

### 4. Report Page -- UI Perfection

Ensure all Vapi data is prominently displayed:
- **Audio player**: Full-width player at the top, always visible
- **Duration + Cost**: Shown in the header subtitle area
- **Transcript**: Chat-bubble conversation (messages array), with fallback to plain transcript text
- **Scores + Feedback**: Shimmer skeletons while polling, then rendered when ready

---

## Technical Details

### fetch-vapi-data Edge Function

```text
POST /fetch-vapi-data
Body: { interviewId: "uuid" }
Auth: Bearer token (user must own the interview)

Response: {
  recordingUrl: string | null,
  stereoRecordingUrl: string | null,
  transcript: string | null,
  messages: Array<{ role: string, content: string, timestamp?: number }>,
  duration: number | null,
  cost: number | null,
  endedReason: string | null
}
```

### get-interview-results Changes

Remove from the update call:
- `transcript`
- `messages`
- `recording_url`
- `duration`
- `cost`

Keep:
- `status: "completed"` or `"failed"`
- `ended_at`

### InterviewReport.tsx State

Add new state:
- `vapiData` -- holds the live Vapi response (audio, transcript, messages, duration, cost)
- `vapiLoading` -- loading state for the Vapi fetch

On mount, after fetching interview from DB, immediately call `fetch-vapi-data` and store result. Render audio/transcript from this state instead of from `interview.recording_url` / `interview.messages`.

---

## File Summary

| File | Change |
|------|--------|
| `supabase/functions/fetch-vapi-data/index.ts` | New -- fetches live data from Vapi API |
| `supabase/functions/get-interview-results/index.ts` | Remove transcript/messages/recording_url/duration/cost storage |
| `src/pages/InterviewReport.tsx` | Call fetch-vapi-data, show audio/transcript/duration/cost from live Vapi data |

No database migrations needed.

