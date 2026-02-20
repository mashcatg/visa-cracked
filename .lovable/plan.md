

# Fix Admin Display + Add Skeleton Loading Everywhere

## 1. Admin Table Not Showing Rows

**Root Cause**: The `fetchAdmins` query does `.select("*, profiles(full_name, user_id)")` but `user_roles.user_id` has a foreign key to `auth.users.id`, NOT to `profiles.user_id`. PostgREST cannot resolve this implicit join, so it returns no data or errors silently.

**Fix**:
- Add a database migration to create a foreign key: `ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_profiles_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;`
- Update `AdminAdmins.tsx` fetch query to use the explicit hint: `profiles!user_roles_user_id_profiles_fkey(full_name, email, user_id)`
- Also show email column in the admins table

---

## 2. Dashboard Loading Skeleton

**Problem**: `Dashboard.tsx` has no loading state -- it renders empty cards while data loads.

**Fix**: Add a `loading` boolean state, set it to true initially, false after data fetch completes. When `loading` is true, render shimmer skeleton blocks matching the dashboard layout (stat cards, CTA card, recent tests grid).

---

## 3. Interview Room Connecting Skeleton

**Problem**: The interview room connecting overlay uses a spinner but no skeleton/shimmer text.

**Fix**: Apply the existing `shimmer-text-light` CSS class to the connecting messages text in `InterviewRoom.tsx` so the text has a shimmer effect while loading.

---

## 4. Report Page Card Loading States (already done)

The report page already has shimmer skeletons for:
- Initial page load (lines 174-213)
- Audio player loading (lines 304-319)
- Summary loading (lines 391-398)
- Score loading (lines 470-477, 495-507)
- Detailed feedback loading (lines 429-441)

No additional changes needed here.

---

## Technical Details

### Database Migration
```sql
ALTER TABLE public.user_roles 
ADD CONSTRAINT user_roles_user_id_profiles_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;
```

### Files to Modify

| File | Change |
|------|--------|
| Migration SQL | Add FK user_roles -> profiles |
| `src/pages/admin/AdminAdmins.tsx` | Fix join hint, add email column |
| `src/pages/Dashboard.tsx` | Add loading state with shimmer skeleton |
| `src/pages/InterviewRoom.tsx` | Add shimmer-text-light to connecting messages |

### Dashboard Skeleton Layout
When loading, show:
- Header shimmer (title + subtitle)
- CTA card shimmer
- 3 stat card shimmer blocks (matching the grid)
- Recent mock tests section: 3 card shimmer blocks in a grid

### Admin Admins Table Fix
- Update query: `.select("*, profiles!user_roles_user_id_profiles_fkey(full_name, email, user_id)")`
- Add Email column to table header and rows
- Add email to CSV export columns

