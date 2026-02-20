

# Multi-Fix Plan: Transcript Chat Bubbles in PDF, Interview Room Transcript Width, Sidebar Icon, and PDF Logo

## 1. PDF Transcript as Chat Bubbles

The downloaded PDF currently renders the transcript as plain text lines. It needs to display messages as a chat-style layout:
- Officer messages left-aligned with an "Officer:" prefix
- User messages right-aligned (indented) with a "You:" prefix
- Parse the transcript text by splitting on role prefixes (e.g., "AI:", "User:") or use the `messages` JSON from the interview if available

**File**: `supabase/functions/generate-report-pdf/index.ts`
- Fetch messages from the interview record (JSON array with role + content)
- If messages exist, render each as a labeled bubble-style block:
  - Officer messages: draw "Officer:" in bold at left margin, content below
  - User messages: draw "You:" in bold indented ~100px from left, content below
- If no messages, fall back to plain transcript text

## 2. Interview Room Transcript Bar - Narrower Width + Shrinking Text

The transcript bar at the bottom of the interview room is too wide on desktop. Changes:
- Reduce desktop max-width from `max-w-xl` to `max-w-sm`
- Add the `shimmer-text-light` class to the transcript text for the shrinking/shining effect

**File**: `src/pages/InterviewRoom.tsx` (lines 288-295)

## 3. Hide Sidebar Collapse Icon on Mobile

The mobile sidebar already has a close (X) button from the Sheet component. The `PanelLeftClose` / `PanelLeft` toggle button is redundant on mobile.

**File**: `src/components/layout/AppSidebar.tsx` (line 139)
- Since `SidebarInner` is always called with `collapsed={false}` on mobile, we just need to hide the collapse button when `onClose` is provided (mobile mode). Add a condition: only show the collapse toggle button when `!onClose` (desktop).

## 4. PDF Logo - Use the App Logo

The PDF already embeds a logo from a URL. The current URL may or may not match the login page logo. We'll update it to use the same logo asset used on the login page.

**File**: `supabase/functions/generate-report-pdf/index.ts` (line 118)
- Check which logo is used on the login page and use that same URL

---

## Technical Details

### PDF Transcript Chat Bubbles
```typescript
// In generate-report-pdf, replace plain transcript rendering with:
const messages = interview.messages; // JSON array [{role, content}]
if (Array.isArray(messages) && messages.length > 0) {
  for (const msg of messages) {
    if (!msg.content) continue;
    const isUser = msg.role === "user";
    const label = isUser ? "You:" : "Officer:";
    const indent = isUser ? margin + 80 : margin;
    const textWidth = isUser ? maxWidth - 80 : maxWidth - 80;
    ensureSpace(30);
    page.drawText(label, { x: indent, y, size: 9, font: fontBold, color: isUser ? accent : gray });
    y -= 13;
    y = drawWrappedText(page, msg.content, indent, y, textWidth, fontRegular, 9, gray, 12);
    y -= 8;
  }
} else if (interview.transcript) {
  // fallback to plain text
}
```

### Interview Room Transcript Width
```tsx
// Change max-w-xl to max-w-sm on desktop
<div className={`absolute bottom-3 left-1/2 -translate-x-1/2 ${isMobile ? "w-[88%]" : "max-w-sm w-full"} z-10`}>
```

### Hide Sidebar Collapse Button on Mobile
```tsx
// Only show collapse toggle when not in mobile sheet mode
{!onClose && (
  <button onClick={onToggleCollapse} className="ml-auto ...">
    {collapsed ? <PanelLeft /> : <PanelLeftClose />}
  </button>
)}
```

### Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/generate-report-pdf/index.ts` | Render transcript as chat bubbles (Officer left, You indented right); verify logo URL |
| `src/pages/InterviewRoom.tsx` | Reduce transcript bar width from `max-w-xl` to `max-w-sm`; add shimmer effect |
| `src/components/layout/AppSidebar.tsx` | Hide collapse icon when in mobile sheet mode |

