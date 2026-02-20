

# Premium UI Overhaul + Interview Room Redesign

## Summary of Changes

This plan covers 5 major areas: Interview Room layout flip, transcript bar redesign, search modal styling, dashboard premium upgrade, and report page cleanup.

---

## 1. Interview Room (`InterviewRoom.tsx`) -- Complete Redesign

### Layout Flip (Reference: uploaded video call image)
- **Main view**: Officer/bot avatar fills the full screen (large centered avatar with speaking animation -- pulsing rings, gradient background)
- **User camera**: Small PIP (picture-in-picture) in top-right corner, ~120x160px on desktop, ~80x110px on mobile, rounded-xl with border
- User can tap/click their PIP to swap views (toggle between bot-main/user-main)

### Remove Controls
- Remove mic toggle button and cam toggle button entirely
- Remove keyboard shortcuts (M, V) and the hints text
- Keep ONLY the "End Mock Test" red button centered at the bottom

### Auto-End Timer (3:30 = 210 seconds)
- Show countdown timer in header: `3:30` counting down to `0:00`
- When timer hits 0, auto-call `vapiRef.current?.stop()` to end the mock test
- Show a warning toast at 30 seconds remaining ("30 seconds remaining")

### Single-Line Transcript Bar
- Replace the multi-line subtitle overlay with a single-line transcript bar at the bottom
- One continuous line that shows the latest transcript regardless of speaker
- Format: `Officer: text here` or `You: text here` -- single line, no stacking
- Styled as a slim bar with dark translucent background, text truncated with ellipsis if too long

### Connecting Screen
- Keep the rotating messages as they are (already implemented)

---

## 2. Search Modal (`DashboardLayout.tsx`) -- Premium Styling

Reference: uploaded search modal image (clean white card with "Search projects" heading, recent items list)

- Restyle the `CommandDialog` to match the reference:
  - Larger, rounder modal with soft shadow
  - "Search mock tests" placeholder with search icon
  - "RECENT MOCKS" section header in small caps
  - Each item shows mock name with country flag icon and a timestamp on the right
  - Clean white/cream background, subtle borders
  - Close X button top-right

---

## 3. Dashboard (`Dashboard.tsx`) -- Premium Production UI

### Hero CTA Section
- Larger, more impactful CTA card with a subtle gradient mesh background
- Bigger heading, more descriptive subtitle
- Prominent "Start Mock Test" button with accent color and arrow icon

### Stat Cards
- Use a monochrome accent color scheme (no multi-colored icons)
- All icons use the brand accent green color only
- Cleaner typography with more whitespace
- Subtle hover elevation effect

### Recent Mock Tests Grid
- Cleaner card design with consistent monochrome styling
- Score displayed more prominently
- Status badges with subtle backgrounds
- Date in relative format ("2 hours ago" instead of raw date)

### Chart
- Keep as is, already clean

---

## 4. Report Page (`InterviewReport.tsx`) -- Premium Cleanup

### Remove Multi-Color Icons
- All category score icons currently use different colors (blue, purple, emerald, amber, pink, cyan, indigo) -- change ALL to use the brand accent green color
- This applies to both the category cards and the tab icons

### Monochrome Design System
- Replace the rainbow of icon colors with a single accent color
- Score colors (green/amber/red for good/ok/bad) stay as functional indicators
- Card borders, backgrounds, and spacing made more consistent

### Transcript Chat Style
- User messages on the RIGHT side, bot messages on the LEFT side (already done, keeping it)

### Audio Player
- Keep the current full-width audio player design

### Summary Section
- Add a subtle heading "AI Summary" above the summary text

### Tabs Section
- Clean up tab styling to be more minimal
- Remove excessive color variations in the feedback cards

---

## 5. Public Report Page (`PublicReportPage.tsx`) -- Same Monochrome Treatment

- Apply the same monochrome icon color changes as the main report page
- All category icons use accent color instead of rainbow colors

---

## Technical Details

### InterviewRoom.tsx Changes

State changes:
- Remove `micOn`, `camOn` states
- Remove `toggleMic()`, `toggleCam()` functions  
- Remove keyboard shortcut useEffect
- Add `MAX_DURATION = 210` (3:30 in seconds)
- Change `elapsed` to count DOWN from 210 instead of up
- Add `swapped` state for toggling main view between bot and user

Timer logic:
```text
const remaining = MAX_DURATION - elapsed
// elapsed counts up from 0
// Display formatTime(MAX_DURATION - elapsed)
// When elapsed >= MAX_DURATION, auto-stop
```

Layout structure:
```text
[Header: "Visa Cracked -- Mock Test" | Countdown Timer | Connection indicator]
[Main area: 
  - Full screen: Bot avatar (large circle with User icon, pulsing when speaking)
  - Top-right corner: User video PIP (small, rounded, clickable to swap)
]
[Bottom transcript bar: single line, latest transcript]
[Bottom control bar: only "End Mock Test" button]
```

### Dashboard.tsx Changes
- Stat card icons: all use `text-accent` instead of varied colors
- CTA: enhanced gradient, bigger text
- Mock test cards: cleaner hover states

### InterviewReport.tsx Changes  
- Categories array: remove individual `color` properties, all use `text-accent`
- Tab content: remove colored icons where excessive

### DashboardLayout.tsx Changes
- CommandDialog: add custom className for rounder corners, softer shadow
- Add "RECENT MOCKS" heading in the command group

---

## Files to Edit

| File | Change |
|------|--------|
| `src/pages/InterviewRoom.tsx` | Flip layout (bot main, user PIP), remove mic/cam controls, add 3:30 countdown, single-line transcript bar |
| `src/pages/Dashboard.tsx` | Premium CTA, monochrome stat icons, cleaner mock test cards |
| `src/pages/InterviewReport.tsx` | Monochrome icons (all accent), cleaner tabs, add summary heading |
| `src/pages/PublicReportPage.tsx` | Monochrome icons to match report page |
| `src/components/layout/DashboardLayout.tsx` | Search modal premium styling to match reference image |

