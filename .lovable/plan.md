

# Comprehensive UI Polish + Interview Room Enhancements + Fixes

## Changes Overview

This plan addresses all requested items: border removal, interview room controls (mic toggle, subtitle toggle, bigger camera, timer fix, rounded bot avatar), loading skeletons, active sidebar mock highlighting, connecting message fix, mobile profile dropdown fix, shadow removal, and PDF download improvements.

---

## 1. Global: Border = 0 + Shadow = 0

**File: `src/index.css`**
- Add `border-width: 0;` to the global `*` selector so all elements have zero borders by default
- Elements that intentionally need borders will use explicit classes

**Files: All UI components with shadows**
- Already removed `shadow-sm` from Card. Will also remove `shadow-lg` from mobile hamburger button in `AppSidebar.tsx`, and `shadow-xl`/`shadow-2xl` from InterviewRoom PIP (replace with `shadow-none`)
- Keep only functional shadows in dropdown/popover overlays (they need elevation to be usable)

---

## 2. Interview Room Enhancements (`InterviewRoom.tsx`)

### Timer: 3:27 instead of 3:30
- Change `MAX_DURATION` from `210` to `207` (3 minutes 27 seconds)

### Add Mic Toggle Button
- Add `micOn` state (default `true`)
- Toggle function mutes/unmutes audio tracks in `streamRef`
- Small circular button in the controls bar next to "End Mock Test"

### Add Subtitle Toggle Button
- Add `subtitlesOn` state (default `true`)
- When off, hide the transcript bar at the bottom
- Small circular button with `Subtitles` icon in controls bar

### Bigger Camera Preview (PIP)
- Desktop: increase from `w-[120px] h-[160px]` to `w-[160px] h-[200px]`
- Mobile: increase from `w-[80px] h-[110px]` to `w-[100px] h-[140px]`

### Bot Avatar Fully Rounded
- The bot avatar container is already `rounded-full`. The PIP version when swapped uses `rounded-2xl` -- change that to `rounded-full` as well

### Connecting Message Fix
- Stop rotating messages. Once messages cycle past the first few, lock on "Almost there..." until connected
- Change logic: after showing all 4 messages once, stay on "Almost there..." permanently

### Remove shadows from InterviewRoom elements
- Remove `shadow-xl` from PIP, `shadow-2xl` from bot avatar, `shadow-lg` from bot PIP

---

## 3. Active Mock Highlighting in Sidebar (`AppSidebar.tsx`)

- Compare `pathname` with `/interview/${interview.id}/report`
- If match, apply the same styling as hover state: `bg-sidebar-accent/50 text-sidebar-foreground` instead of the default `text-sidebar-foreground/60`

---

## 4. Mobile Profile Dropdown Fix (`AppSidebar.tsx`)

- The dropdown opens `side="top"` which may be obscured by the browser's bottom navigation bar on mobile
- Change to `side="right"` on mobile or add `pb-safe` / `padding-bottom: env(safe-area-inset-bottom)` to the sidebar
- Add `sideOffset` and `alignOffset` to ensure the dropdown is visible

---

## 5. Skeleton Loading Placeholders

**File: `InterviewReport.tsx`**
- The main loading state currently shows a spinner. Replace with skeleton placeholders matching the two-column layout:
  - Left column: skeleton card for transcript (multiple shimmer lines), skeleton for summary
  - Right column: skeleton for score gauge (circle), skeleton rows for categories
- Use the existing `shimmer-block` CSS class for animated skeletons

**File: `Dashboard.tsx`**
- When data is loading, show skeleton cards for stats (3 shimmer rectangles), skeleton for recent mocks grid

---

## 6. PDF Download (Already Working)

The download button and edge function are already implemented. The current implementation generates a `.txt` file. This is functional. No changes needed unless user wants actual PDF format (which would require a PDF library).

---

## 7. Report Page: Additional Skeleton Loading

Already partially implemented with `shimmer-block` divs for summary, scores, and feedback. Will enhance:
- Add shimmer skeleton for transcript area while `vapiLoading` is true
- Add shimmer for recording player area while loading

---

## Technical Details

### index.css Global Border Reset
```css
* {
  @apply border-border;
  border-width: 0;
}
```
This sets default border-width to 0. Tailwind's `border` class explicitly sets `border-width: 1px`, so any element that explicitly uses `border` or `border-t` etc. will still show its border.

### InterviewRoom.tsx State Additions
- `const [micOn, setMicOn] = useState(true);`
- `const [subtitlesOn, setSubtitlesOn] = useState(true);`
- `toggleMic()`: iterate `streamRef.current.getAudioTracks()` and toggle `.enabled`
- Connecting messages: use a `useEffect` that after cycling through all 4 messages once, locks on index 3 ("Almost ready...") -- or change last message to "Almost there..."

### Controls Bar Layout
```text
[Mic Toggle] [Subtitle Toggle] ---- [End Mock Test (red)] ----
```
Three buttons centered in the bottom bar. Mic and Subtitle are small circular ghost buttons, End Mock Test is the prominent red button.

### Sidebar Active Mock
```text
const isActive = pathname === `/interview/${interview.id}/report`;
// Apply: bg-sidebar-accent/50 text-sidebar-foreground if active
```

### Mobile Dropdown Fix
Add `className="pb-[env(safe-area-inset-bottom)]"` to the sidebar container, and change the dropdown `side` to `"right"` when on mobile to avoid bottom nav overlap.

---

## Files to Edit

| File | Change |
|------|--------|
| `src/index.css` | Add `border-width: 0` to global `*` selector |
| `src/pages/InterviewRoom.tsx` | Timer 207s, mic toggle, subtitle toggle, bigger PIP, rounded bot, connecting msg fix, remove shadows |
| `src/components/layout/AppSidebar.tsx` | Active mock highlighting, mobile dropdown fix, remove hamburger shadow |
| `src/pages/InterviewReport.tsx` | Skeleton loading for initial state, remove shadows |
| `src/pages/Dashboard.tsx` | Skeleton loading for stats and mocks while loading |

