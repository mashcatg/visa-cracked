

# Add Export Center Tab to Admin Panel

## Overview
Add a new "Export Center" tab in the admin panel that lists all database tables. Clicking any table name will download the entire table data (all rows, all columns) as a JSON file.

## Changes

### 1. New Component: `src/pages/admin/AdminExportCenter.tsx`
- Display a grid of cards, one per database table: `profiles`, `user_roles`, `countries`, `visa_types`, `interviews`, `interview_reports`, `credit_grants`
- Each card shows the table name, an icon, and a "Download" button
- On click, fetch ALL rows from that table using the Supabase client (admin RLS allows full read access)
- Download the result as a `.json` file with all rows and columns
- Show a loading spinner on the card while fetching
- Handle the 1000-row default limit by using pagination (fetch in batches of 1000 using `.range()` until no more rows)

### 2. Update: `src/pages/admin/AdminLayout.tsx`
- Add "Export Center" nav item with `Download` icon from lucide-react
- Link to `/admin/export-center`

### 3. Update: `src/pages/AdminPage.tsx`
- Add route: `<Route path="export-center" element={<AdminExportCenter />} />`
- Import the new component

## Technical Details

### Fetching All Rows (Bypassing 1000 Row Limit)
```typescript
async function fetchAllRows(tableName: string) {
  let allRows: any[] = [];
  let from = 0;
  const batchSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from(tableName)
      .select("*")
      .range(from, from + batchSize - 1);
    if (error) throw error;
    allRows = [...allRows, ...(data || [])];
    if (!data || data.length < batchSize) break;
    from += batchSize;
  }
  return allRows;
}
```

### Download as JSON File
```typescript
function downloadJSON(data: any[], filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
```

### Table List Config
Each table entry will include: name, display label, icon, and description.

### RLS Consideration
The current admin RLS policies already grant SELECT access on all tables for admin users, so no database changes are needed.

## Files to Create/Edit

| File | Action |
|------|--------|
| `src/pages/admin/AdminExportCenter.tsx` | Create - new export center component |
| `src/pages/admin/AdminLayout.tsx` | Edit - add Export Center nav tab |
| `src/pages/AdminPage.tsx` | Edit - add export-center route |

