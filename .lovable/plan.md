

# Fix Multiple Issues: Admin Toast, Audio Skeleton, Cost Removal, and More

## Changes Summary

### 1. Fix "Add Admin" - Actually Add Admin by Email
**File**: `src/pages/admin/AdminAdmins.tsx`

The current `addAdmin` function just shows a toast and does nothing. Replace it with real logic:
- Query `profiles` table by email to find the user
- If found, insert a row into `user_roles` with role `admin`
- If not found, show an error toast saying "User not found. They must sign up first."
- Refresh the admin list after success

### 2. Replace "Loading recording..." with Skeleton + Shimmer
**File**: `src/pages/InterviewReport.tsx`

Replace lines 310-319 (the `vapiLoading` loading state) with a shimmer skeleton that matches the custom audio player shape -- a card with shimmer blocks for the controls area.

### 3. Remove All Cost/DollarSign References
**Files**:
- `src/pages/InterviewReport.tsx`: Remove `DollarSign` import, remove `cost` variable, remove the cost display block (lines 292-296), remove `cost` from `VapiData` interface
- `supabase/functions/fetch-vapi-data/index.ts`: Remove `cost` from the returned data
- `src/pages/PublicReportPage.tsx`: No cost references found -- no changes needed

### 4. Theme is Already Set to System Default
`App.tsx` already has `defaultTheme="system" enableSystem={true}` -- no change needed.

### 5. Transcript Bar and Chat Bubbles Already Implemented
The interview room transcript bar and report chat bubbles are already implemented from the previous round -- no changes needed.

### 6. Custom Audio Player Already Implemented
Already in place at `src/components/audio/CustomAudioPlayer.tsx` -- no changes needed.

---

## Technical Details

### Fix Add Admin Logic
```typescript
async function addAdmin() {
  if (!email) return;
  setLoading(true);
  // Look up user by email in profiles
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("email", email.trim().toLowerCase())
    .single();
  if (!profile) {
    toast.error("User not found. They must sign up first.");
    setLoading(false);
    return;
  }
  // Check if already admin
  const { data: existing } = await supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", profile.user_id)
    .eq("role", "admin")
    .maybeSingle();
  if (existing) {
    toast.info("User is already an admin.");
    setLoading(false);
    setDialogOpen(false);
    return;
  }
  // Insert admin role
  const { error } = await supabase
    .from("user_roles")
    .insert({ user_id: profile.user_id, role: "admin" });
  if (error) {
    toast.error("Failed to add admin");
  } else {
    toast.success("Admin added!");
    setEmail("");
    fetchAdmins();
  }
  setLoading(false);
  setDialogOpen(false);
}
```

### Audio Loading Skeleton
Replace the Loader2 spinner with shimmer blocks matching the audio player layout:
```tsx
{vapiLoading && !recordingUrl && (
  <Card>
    <CardContent className="p-4">
      <div className="flex items-center gap-3">
        <div className="h-4 w-4 rounded shimmer-block" />
        <div className="h-10 w-10 rounded-full shimmer-block shrink-0" />
        <div className="h-4 w-4 rounded shimmer-block" />
        <div className="h-3 w-10 rounded shimmer-block" />
        <div className="h-2 flex-1 rounded shimmer-block" />
        <div className="h-3 w-10 rounded shimmer-block" />
        <div className="h-4 w-4 rounded shimmer-block" />
        <div className="h-2 w-16 rounded shimmer-block" />
      </div>
    </CardContent>
  </Card>
)}
```

### Files to Modify

| File | Change |
|------|--------|
| `src/pages/admin/AdminAdmins.tsx` | Fix addAdmin to actually look up user and assign role |
| `src/pages/InterviewReport.tsx` | Replace audio loading with skeleton; remove cost/DollarSign |
| `supabase/functions/fetch-vapi-data/index.ts` | Remove cost from returned data |

