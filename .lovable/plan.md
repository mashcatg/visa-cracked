

# Premium Report Page Redesign + PDF Download + Dashboard Polish

## Overview

Complete overhaul of the report/results page to match the premium inspiration images (Nebulas-style layout with chat bubbles, clean sections, proper spacing). Fix transcript alignment (user right, AI left with chat bubbles). Create a well-designed branded PDF download. Polish all pages for production quality.

---

## 1. Report Page (`InterviewReport.tsx`) -- Complete Redesign

### Layout: Two-Column on Desktop (inspired by Nebulas screenshot)

Desktop: Left column (main content ~65%) + Right column (report sidebar ~35%)
Mobile: Single column, stacked

**Left Column (Main Content):**
- Header with mock name, country/visa, date, duration, cost
- Action buttons row: Share, Download PDF, Play Recording (inline audio player)
- Transcript section with chat bubbles:
  - AI/Officer messages: LEFT aligned, light gray background (`bg-muted`), rounded corners with tail on left
  - User messages: RIGHT aligned, brand accent green background (`bg-accent/15`), rounded corners with tail on right
  - Each bubble shows "Officer" or "You" label above the message text
  - ScrollArea with proper height
- AI Summary section below transcript

**Right Column (Sidebar Report):**
- Overall Score (large circular gauge)
- Category scores (7 items in a clean list, not grid)
- Red Flags list
- Grammar Mistakes list
- Improvement Plan list
- All in clean card sections with subtle separators, no tab system -- everything visible at once (scrollable)

### Remove Tabs System
- Replace the tabbed interface with a flowing sidebar that shows all sections
- Each section has a bold heading and clean list items
- Much cleaner and more scannable than tabs

### Shimmer Skeletons
- Keep per-section shimmer loading as-is but match new layout positions

### Analysis Failed State
- Keep 2-minute timeout with "Regenerate Report" button

---

## 2. Transcript Chat Bubbles

Properly styled chat bubbles:
- User messages: right-aligned, accent green tinted background, "You" label in small green text
- Officer messages: left-aligned, muted gray background, "Officer" label in small gray text
- Rounded corners with asymmetric radius (e.g., `rounded-2xl rounded-br-sm` for user)
- Max width 75-80% of container
- Consistent spacing between messages

---

## 3. PDF Download (`generate-report-pdf`)

Replace the current plain text `.txt` download with a properly formatted HTML-to-text report using brand colors:

Since we can't generate real PDFs in edge functions easily, create a well-structured text report with:
- Clean ASCII formatting with the brand name header
- All scores formatted in a table-like structure
- Transcript included
- Grammar mistakes, red flags, improvement plan all formatted
- Filename: `visa-cracked-report-{date}.txt`

Note: The current approach generates a `.txt` file. We'll keep `.txt` but make it much better formatted. If the user wants actual PDF, that would require a PDF library in edge functions.

---

## 4. Public Report Page (`PublicReportPage.tsx`)

Apply the same two-column layout and chat bubble transcript styling. Remove redundant multi-color icons. Match the main report page design.

---

## 5. Dashboard (`Dashboard.tsx`) -- Production Polish

- Relative dates on recent mock test cards ("2 hours ago" using `date-fns` `formatDistanceToNow`)
- Cleaner card hover states
- Ensure CTA and stats match premium feel from earlier updates

---

## Technical Details

### InterviewReport.tsx Structure

```text
<div className="max-w-7xl mx-auto p-6">
  <Header: name, country, date, duration, cost />
  <ActionButtons: Share | Download | Play Recording />
  
  <div className="grid lg:grid-cols-[1fr_380px] gap-6">
    <!-- Left Column -->
    <div>
      <Card: Transcript with chat bubbles />
      <Card: AI Summary />
    </div>
    
    <!-- Right Column (Sidebar) -->
    <div className="space-y-4">
      <Card: Overall Score gauge />
      <Card: Category Scores (list) />
      <Card: Red Flags />
      <Card: Grammar Mistakes />
      <Card: Improvement Plan />
      <Card: Detailed Feedback (collapsible per question) />
    </div>
  </div>
</div>
```

### Chat Bubble Styling

```text
User message:
  - Container: flex justify-end
  - Bubble: bg-accent/10 border border-accent/20 rounded-2xl rounded-br-sm px-4 py-3 max-w-[78%]
  - Label: "You" in text-accent text-[10px] font-semibold

Officer message:
  - Container: flex justify-start
  - Bubble: bg-muted rounded-2xl rounded-bl-sm px-4 py-3 max-w-[78%]
  - Label: "Officer" in text-muted-foreground text-[10px] font-semibold
```

### Right Sidebar Sections

Each section is a Card with:
- Bold heading (e.g., "Category Scores", "Red Flags")
- Clean list items with subtle dividers
- No colored icons, just accent green where needed
- Scores show as inline number + small progress bar

### Dashboard Relative Dates

Use `formatDistanceToNow` from `date-fns` (already installed):
```text
"2 hours ago" instead of "9/22/2025"
```

---

## Files to Edit

| File | Change |
|------|--------|
| `src/pages/InterviewReport.tsx` | Complete redesign: two-column layout, chat bubbles, sidebar report, remove tabs |
| `src/pages/PublicReportPage.tsx` | Match new report layout with chat bubbles and clean sections |
| `src/pages/Dashboard.tsx` | Relative dates, polish |
| `supabase/functions/generate-report-pdf/index.ts` | Better formatted text report with brand styling |

