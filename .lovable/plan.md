
# Plan: Fix Mock Test Room + Dashboard CTA

## Problems Identified

1. **"Failed to start interview" error** -- Two root causes:
   - **CORS headers incomplete**: The `start-interview` edge function is missing required Supabase client headers (`x-supabase-client-platform`, etc.), causing preflight failures
   - **Wrong Vapi SDK usage**: The code calls `vapi.start(data.callConfig)` passing the full Vapi API call response. The Vapi Web SDK's `.start()` expects either an assistant ID string or an assistant config object -- not a raw call response. The correct approach is to use `vapi.start(assistantId)` directly on the client, or pass the `webCallUrl` from the call response for joining an existing call

2. **Poor camera quality**: The `getUserMedia` call uses `{ video: true }` with no resolution constraints, so browsers default to low quality

3. **No CTA on dashboard** to quickly start a mock test

## Changes

### 1. Fix `start-interview` Edge Function
**File:** `supabase/functions/start-interview/index.ts`
- Update CORS headers to include all required Supabase client headers
- Instead of creating a server-side call via the Vapi REST API (which returns a call object the web SDK can't use), return the `assistantId` and `publicKey` so the client-side SDK can initiate the call properly
- Remove the server-side `POST /call` to Vapi -- the Web SDK handles call creation itself when you call `vapi.start(assistantId)`

### 2. Redesign Interview Room (Google Meet Style)
**File:** `src/pages/InterviewRoom.tsx`
- Request HD camera: `{ video: { width: 1280, height: 720, facingMode: 'user' }, audio: { echoCancellation: true, noiseSuppression: true } }`
- Fix Vapi call: use `vapi.start(assistantId)` instead of `vapi.start(callConfig)`
- Add elapsed timer showing call duration (like Meet/Zoom)
- Add user avatar fallback when camera is off (initials circle instead of just an icon)
- Add audio visualizer/waveform indicator for speaking state
- Show connection quality status
- Better loading state with camera preview visible during connection
- Responsive layout for mobile

### 3. Dashboard CTA
**File:** `src/pages/Dashboard.tsx`
- Add a prominent "Start Mock Test" hero CTA card at the top of the dashboard with accent gradient
- The CTA triggers the existing `CreateInterviewModal` via a callback passed from `DashboardLayout`

### 4. Dashboard Layout Update
**File:** `src/components/layout/DashboardLayout.tsx`
- Pass `onCreateInterview` callback down to Dashboard children so the CTA can open the create modal

## Technical Details

### Edge Function Fix (start-interview)
The current flow creates a call server-side via `POST https://api.vapi.ai/call`, then tries to pass the response to `vapi.start()`. This is incorrect for web calls. The Vapi Web SDK manages WebRTC connections internally -- you just call `vapi.start(assistantId)`.

The simplified flow:
1. Client calls `start-interview` edge function
2. Edge function validates auth, checks credits, looks up Vapi config for the visa type
3. Returns `{ publicKey, assistantId }` (no server-side call creation needed)
4. Client creates `new Vapi(publicKey)` and calls `vapi.start(assistantId)`
5. On `call-start` event, update interview status to `in_progress`

### Camera Constraints
```javascript
navigator.mediaDevices.getUserMedia({
  video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
  audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
})
```

### New Mock Room Features
- Elapsed time counter (MM:SS format)
- Camera preview visible even during loading/connecting phase
- Floating self-view in corner (picture-in-picture style)
- Speaking indicator with animated rings
- Better subtitle display with auto-scroll
- Keyboard shortcut hints (M to mute, V for video)
