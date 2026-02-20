
# Plan: Fix Results Not Loading + Report Page UX Overhaul

## Root Cause: Why Results Never Appear

The interview record `1d08c86c` has `vapi_call_id: null`. The `get-interview-results` edge function checks for `vapi_call_id` and returns a 404 error if it's null. The call ID is never saved because `InterviewRoom.tsx` calls `vapi.start(assistantId)` but never stores the returned call ID back to the database.

**The fix**: `vapi.start()` returns a `Call` object with an `id` field. After the call starts, save that ID to the `interviews` table so `get-interview-results` can fetch data from Vapi.

---

## Changes

### 1. Save Vapi Call ID After Call Starts (Critical Fix)
**File:** `src/pages/InterviewRoom.tsx`

In the `startCall` function, capture the return value of `vapi.start(assistantId)` which is a `Call` object with an `id`. Then update the interview record with this call ID:

```text
const call = await vapi.start(assistantId);
if (call?.id) {
  await supabase.from("interviews").update({ vapi_call_id: call.id }).eq("id", id);
}
```

This is the critical missing piece that breaks the entire post-call flow.

### 2. Shimmer/Shining Text Loading Effect
**File:** `src/index.css`

Add a CSS `@keyframes shimmer` animation that creates a gradient sweep effect on text. This will be used for:
- Report page placeholder cards while waiting for analysis
- Subtitle text in the interview room during the call

### 3. Interview Room -- Merge Subtitles Into One Area + Bigger Camera
**File:** `src/pages/InterviewRoom.tsx`

- Combine both officer and user subtitles into a single subtitle area at the bottom. Show them as a flowing conversation with role labels ("Officer:" / "You:") instead of two separate boxes
- Apply the shimmer text effect to the live subtitles
- Make the self-view PIP camera larger: change from `w-44 h-32` to `w-56 h-40` on desktop, and from `w-24 h-32` to `w-32 h-44` on mobile

### 4. Report Page -- Skeleton Placeholder Cards with Shimmer
**File:** `src/pages/InterviewReport.tsx`

When the report is still loading (polling state), instead of just a spinner, show skeleton placeholder cards that mirror the final layout:
- A shimmer skeleton for the overall score circle
- Shimmer skeletons for each of the 7 category score cards
- A shimmer skeleton for the summary card
- A shimmer skeleton for the transcript/audio section
- Each skeleton has a small "shining text" label underneath describing what's loading

### 5. Report Page -- Show Audio, Transcript, Chat Prominently
**File:** `src/pages/InterviewReport.tsx`

Move the audio player and transcript out of being hidden in a tab. Instead:
- Show the audio player at the top of the report (right after header), always visible if `recording_url` exists
- Show the transcript as a scrollable chat-bubble conversation directly below the scores (not inside a tab)
- Keep detailed feedback, grammar, red flags, improvement plan in tabs below the transcript

---

## Technical Summary

| File | Change |
|------|--------|
| `src/pages/InterviewRoom.tsx` | Save `call.id` from `vapi.start()` return value to DB, merge subtitles into one area, bigger PIP camera, shimmer text on subtitles |
| `src/pages/InterviewReport.tsx` | Skeleton placeholder cards with shimmer during loading, show audio + transcript prominently above tabs |
| `src/index.css` | Add `@keyframes shimmer` CSS animation class |

No database or edge function changes needed -- the fix is entirely about saving the call ID on the client side.
