

# Fix Admin Credits + Icon Colors + Sidebar Dropdown + Shadow Cleanup

## Issues Found

### 1. Admin Credit Granting is Broken (Database Issue)
The `profiles` table has NO admin UPDATE policy. The current policies only allow users to update their own profile (`auth.uid() = user_id`). When an admin tries to grant credits to another user, the `profiles.update()` call fails silently because the admin doesn't match the `user_id` of the target user.

**Fix:** Add a new RLS policy: "Admins can update all profiles" for UPDATE command with `has_role(auth.uid(), 'admin'::app_role)`.

### 2. Red Flag and Grammar Icons Should Be Red/Orange
Currently all icons use `text-accent` (green) due to the monochrome cleanup. But red flags and grammar mistakes are inherently negative indicators -- they should use contextual colors:
- Red Flags: `text-red-500` (or `text-orange-500`)
- Grammar Mistakes: `text-red-500`

Files: `InterviewReport.tsx` and `PublicReportPage.tsx`

### 3. Sidebar Bottom: Replace Logout Icon with Dropdown
Replace the current user section (avatar + name + logout icon) with:
- Avatar + Name + `ChevronRight` icon
- On hover/click: opens a dropdown menu containing:
  - Email and name display
  - Plan name (e.g., "Free Plan")
  - Credit progress bar (current credits / visual indicator)
  - Dark/Light mode toggle switch
  - Logout button

### 4. Box Shadow 0 Everywhere
Remove `shadow-sm` from the Card component base class. Remove any other `shadow-*` classes across the project to achieve a flat, premium look. Keep only intentional shadows (e.g., PIP video overlay in interview room).

Files: `card.tsx` (remove `shadow-sm`), `Dashboard.tsx` (remove `hover:shadow-md`)

### 5. Interview Room Polish
Minor refinements to make it feel more premium -- the layout is already good from the last update.

---

## Technical Details

### Database Migration
```sql
CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
```

### Sidebar Dropdown (AppSidebar.tsx)
Replace the bottom user section with a `DropdownMenu` that opens upward (`side="top"`):
- Trigger: avatar + name + ChevronRight icon (replaces LogOut icon)
- Content:
  - Header: user name + email (small text)
  - Separator
  - Credit progress: `{credits} credits` with a small Progress bar
  - Plan badge: "Free Plan" (hardcoded for now since no plan table exists)
  - Dark/Light mode: a switch using `next-themes` (already installed)
  - Separator
  - Logout button with destructive styling

### Icon Color Changes (InterviewReport.tsx + PublicReportPage.tsx)
- `AlertTriangle` for Red Flags: change from `text-accent` to `text-orange-500`
- `XCircle` for Grammar: change from `text-accent` to `text-red-500`
- Red flag bullet points: change from `text-accent` to `text-orange-500`
- Keep all other category score icons as `text-accent`

### Card Shadow Removal (card.tsx)
Change Card base class from `shadow-sm` to `shadow-none`.

---

## Files to Edit

| File | Change |
|------|--------|
| Database migration | Add admin UPDATE policy on profiles |
| `src/components/ui/card.tsx` | Remove `shadow-sm`, use `shadow-none` |
| `src/components/layout/AppSidebar.tsx` | Replace logout icon with dropdown (email, credits progress, dark/light mode, plan, logout) |
| `src/pages/InterviewReport.tsx` | Red flag icon to orange, grammar icon to red |
| `src/pages/PublicReportPage.tsx` | Same icon color changes |
| `src/pages/Dashboard.tsx` | Remove `hover:shadow-md` from cards |

