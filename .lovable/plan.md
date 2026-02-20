

# Admin Panel Enhancements

## Overview
Three main improvements to the admin panel:
1. Show user emails in the Users table
2. Fix "All Mock Tests" to show all users' data with report details
3. Add CSV export button to every admin table

---

## 1. Add Email to Profiles Table

**Problem**: The `profiles` table has no `email` column. Emails live in `auth.users` which can't be queried from the client.

**Solution**:
- Add an `email` text column to the `profiles` table via migration
- Update the `handle_new_user()` trigger to store `NEW.email` into profiles
- Backfill existing users' emails using a one-time migration:
  ```sql
  UPDATE public.profiles SET email = u.email
  FROM auth.users u WHERE u.id = profiles.user_id;
  ```
- Update `AdminUsers.tsx` to display the email column

---

## 2. Fix "All Mock Tests" Tab

**Problem**: The interviews query uses `.limit(500)` which may cut off data. Also no way to view report details.

**Solution**:
- Remove the 500-row limit and use batch fetching (same pattern as Export Center) to load all interviews
- Add a "View Report" button/link for each interview row that navigates to `/interview/{id}/report`
- Add a status filter dropdown (All, Pending, In Progress, Completed, Failed)
- Ensure the query includes user email from profiles join

---

## 3. Add CSV Export to Every Table

**Problem**: No way to export table data as CSV from individual admin tabs.

**Solution**:
- Add an "Export CSV" button to the `DataTableControls` component
- The button exports the **currently filtered** data (not just current page) as a CSV file
- Pass column definitions and filtered data as props
- Each admin tab (Users, Admins, Countries, Visa Types, Interviews) gets the export capability

---

## Technical Details

### Database Migration
```sql
-- Add email column to profiles
ALTER TABLE public.profiles ADD COLUMN email text;

-- Backfill existing emails from auth.users
UPDATE public.profiles SET email = u.email
FROM auth.users u WHERE u.id = profiles.user_id;

-- Update trigger to capture email on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, avatar_url, email)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name',
          NEW.raw_user_meta_data->>'avatar_url', NEW.email);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;
```

### DataTableControls Enhancement
Add optional `onExportCSV` callback prop. When provided, renders an "Export CSV" button. Each admin page passes a function that:
1. Takes the filtered array (all matching rows, not just current page)
2. Converts to CSV string with headers
3. Downloads as `.csv` file

### CSV Helper Function
A shared utility `downloadCSV(rows, columns, filename)` that:
- Takes an array of objects, column config `{key, label}[]`, and filename
- Generates CSV with proper escaping (commas, quotes, newlines)
- Triggers browser download

### Files to Create/Modify

| File | Action |
|------|--------|
| Migration SQL | Add `email` column + update trigger + backfill |
| `src/components/admin/DataTableControls.tsx` | Add Export CSV button + filter dropdown slot |
| `src/lib/csv-export.ts` | New - shared CSV download utility |
| `src/pages/admin/AdminUsers.tsx` | Show email column, pass CSV export |
| `src/pages/admin/AdminAdmins.tsx` | Pass CSV export |
| `src/pages/admin/AdminCountries.tsx` | Pass CSV export |
| `src/pages/admin/AdminVisaTypes.tsx` | Pass CSV export |
| `src/pages/admin/AdminInterviews.tsx` | Batch fetch, status filter, email, report link, CSV export |

