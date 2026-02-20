

# Multi-Feature Admin & UI Enhancement Plan

## Issues and Solutions

### 1. Admin Mock Tests Tab is Blank
**Root Cause**: The query uses `profiles!interviews_user_id_fkey` to join profiles, but the foreign key `interviews_user_id_fkey` points to `auth.users`, not `profiles`. PostgREST cannot resolve this join, causing the query to fail silently.

**Fix**: 
- Add a database migration to create a foreign key from `interviews.user_id` to `profiles.user_id` so PostgREST can resolve the join.
- Alternatively, since `profiles.user_id` references `auth.users.id`, we can use a view or RPC. The cleanest fix is adding a FK relationship.
- Migration: `ALTER TABLE public.interviews ADD CONSTRAINT interviews_user_id_profiles_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;`
- Then update the query hint to: `profiles!interviews_user_id_profiles_fkey(full_name, email)`

### 2. Default Theme Should Be "system"
**Fix**: Change `App.tsx` ThemeProvider from `defaultTheme="light" enableSystem={false}` to `defaultTheme="system" enableSystem={true}`.

### 3. Add Edit Profile & Change Password to User Dropdown
**Changes to `AppSidebar.tsx`**:
- Add "Edit Profile" menu item that opens a dialog with name and avatar URL fields, saving to `profiles` table.
- Add "Change Password" menu item that opens a dialog with new password field, calling `supabase.auth.updateUser({ password })`.
- Both items placed between "Free Plan" badge and Dark Mode toggle in the dropdown.

### 4. Interview Room Transcript - Single Line with Blurred Container
**Changes to `InterviewRoom.tsx`**:
- The transcript bar already uses `truncate` for single-line, but the role label and text are on the same line via inline spans. This already works as single-line.
- Make the container smaller/more compact with `text-xs` for the text, reduce padding.
- Ensure text shrinks/truncates properly like the reference image (Nabulas app) -- compact transparent blurred pill.
- Already has `bg-black/60 backdrop-blur-md rounded-full` which matches. Just need to ensure single line truncation works and make text slightly smaller.

### 5. Report Page - Chat Bubble UI Enhancement
The chat bubbles already exist (lines 364-386 of InterviewReport.tsx). The current implementation already has:
- User messages right-aligned with `bg-accent/10`
- Officer messages left-aligned with `bg-muted`
This matches the request. No changes needed here unless the user sees something different. Will verify the styling is correct.

### 6. Report Page - Custom Audio Player
**Changes to `InterviewReport.tsx`**:
- Replace the native `<audio>` element with a custom audio player component.
- Features: play/pause button, progress bar/seek, current time / total time display, volume control.
- Styled with brand colors: accent green for progress, primary for controls.
- Compact card design matching the existing card style.

### 7. Remove "Admin signup info" Toast/Banner
The image shows a toast "To add admins, the user must first sign up..." -- this is likely in AdminAdmins.tsx. Need to check and either remove or suppress it for existing signed-up users.

---

## Technical Details

### Database Migration
```sql
-- Add FK from interviews to profiles for PostgREST join support
ALTER TABLE public.interviews 
ADD CONSTRAINT interviews_user_id_profiles_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;
```

### Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| Migration SQL | Create | Add FK interviews -> profiles |
| `src/App.tsx` | Edit | Change defaultTheme to "system", enableSystem to true |
| `src/components/layout/AppSidebar.tsx` | Edit | Add Edit Profile dialog + Change Password dialog to user dropdown |
| `src/pages/InterviewRoom.tsx` | Edit | Refine transcript bar for compact single-line display |
| `src/pages/InterviewReport.tsx` | Edit | Replace native audio with custom branded audio player |
| `src/pages/admin/AdminInterviews.tsx` | Edit | Fix profiles join hint to use new FK name |

### Custom Audio Player Design
- Rounded card with brand colors
- Play/Pause button (accent green circle)
- Seekable progress bar (accent green fill on muted track)
- Time display: `elapsed / total` in `text-muted-foreground`
- Uses HTML5 Audio API via `useRef<HTMLAudioElement>`

### Edit Profile Dialog
- Dialog with two fields: Full Name (text input), Avatar URL (text input)
- Pre-populated from current profile data
- Saves via `supabase.from("profiles").update({ full_name, avatar_url }).eq("user_id", user.id)`

### Change Password Dialog  
- Dialog with: New Password, Confirm Password fields
- Validates match, minimum 6 chars
- Calls `supabase.auth.updateUser({ password: newPassword })`
- Shows success toast on completion

### Transcript Bar Refinement
- Reduce to `text-xs` for text content
- Ensure the container is compact: `px-4 py-2` instead of `px-5 py-2.5`
- Keep `truncate` on the container for text overflow
- Matches the Nabulas reference: small, centered, blurred pill with shrinking text

