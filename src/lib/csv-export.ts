export interface CsvColumn {
  key: string;
  label: string;
  accessor?: (row: any) => string;
}

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function downloadCSV(rows: any[], columns: CsvColumn[], filename: string) {
  const header = columns.map((c) => escapeCSV(c.label)).join(",");
  const lines = rows.map((row) =>
    columns
      .map((col) => {
        const val = col.accessor ? col.accessor(row) : String(row[col.key] ?? "");
        return escapeCSV(val);
      })
      .join(",")
  );
  const csv = [header, ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
