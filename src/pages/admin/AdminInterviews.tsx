import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExternalLink, Loader2 } from "lucide-react";
import DataTableControls from "@/components/admin/DataTableControls";
import { downloadCSV, type CsvColumn } from "@/lib/csv-export";

const PAGE_SIZE = 10;
const BATCH_SIZE = 1000;
const STATUSES = ["all", "pending", "in_progress", "analyzing", "completed", "failed"];

const csvColumns: CsvColumn[] = [
  { key: "user", label: "User", accessor: (r) => (r.profiles as any)?.full_name || "" },
  { key: "email", label: "Email", accessor: (r) => (r.profiles as any)?.email || "" },
  { key: "country", label: "Country", accessor: (r) => (r.countries as any)?.name || "" },
  { key: "visa", label: "Visa Type", accessor: (r) => (r.visa_types as any)?.name || "" },
  { key: "score", label: "Score", accessor: (r) => r.interview_reports?.overall_score ?? "" },
  { key: "status", label: "Status" },
  { key: "created_at", label: "Date", accessor: (r) => new Date(r.created_at).toLocaleDateString() },
];

export default function AdminInterviews() {
  const [interviews, setInterviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    let all: any[] = [];
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from("interviews")
        .select("*, countries(name), visa_types(name), interview_reports(overall_score), profiles!interviews_user_id_profiles_fkey(full_name, email)")
        .order("created_at", { ascending: false })
        .range(from, from + BATCH_SIZE - 1);
      if (error) break;
      all = [...all, ...(data || [])];
      if (!data || data.length < BATCH_SIZE) break;
      from += BATCH_SIZE;
    }
    setInterviews(all);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filtered = useMemo(() => {
    let result = interviews;
    if (statusFilter !== "all") {
      result = result.filter(i => i.status === statusFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(i =>
        ((i.profiles as any)?.full_name || "").toLowerCase().includes(q) ||
        ((i.profiles as any)?.email || "").toLowerCase().includes(q) ||
        ((i.countries as any)?.name || "").toLowerCase().includes(q) ||
        ((i.visa_types as any)?.name || "").toLowerCase().includes(q) ||
        (i.status || "").toLowerCase().includes(q) ||
        (i.name || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [interviews, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [search, statusFilter]);

  const statusFilterSlot = (
    <Select value={statusFilter} onValueChange={setStatusFilter}>
      <SelectTrigger className="w-[140px]">
        <SelectValue placeholder="Status" />
      </SelectTrigger>
      <SelectContent>
        {STATUSES.map(s => (
          <SelectItem key={s} value={s} className="capitalize">{s === "all" ? "All Statuses" : s.replace("_", " ")}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <DataTableControls
        search={search} onSearchChange={setSearch} page={page} totalPages={totalPages} onPageChange={setPage}
        placeholder="Search by user, email, country, visa type..."
        onExportCSV={() => downloadCSV(filtered, csvColumns, "mock-tests")}
        filterSlot={statusFilterSlot}
      />

      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Visa Type</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.map((i) => (
              <TableRow key={i.id}>
                <TableCell className="font-medium">{(i.profiles as any)?.full_name || "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{(i.profiles as any)?.email || "—"}</TableCell>
                <TableCell>{(i.countries as any)?.name}</TableCell>
                <TableCell>{(i.visa_types as any)?.name}</TableCell>
                <TableCell>
                  {i.interview_reports?.overall_score != null ? (
                    <span className={
                      i.interview_reports.overall_score >= 80 ? "text-green-600 font-bold" :
                      i.interview_reports.overall_score >= 60 ? "text-yellow-600 font-bold" : "text-red-600 font-bold"
                    }>
                      {i.interview_reports.overall_score}/100
                    </span>
                  ) : "—"}
                </TableCell>
                <TableCell><span className="capitalize">{i.status?.replace("_", " ")}</span></TableCell>
                <TableCell>{new Date(i.created_at).toLocaleDateString()}</TableCell>
                <TableCell>
                  <Link to={`/interview/${i.id}/report`}>
                    <Button variant="ghost" size="icon" title="View Report"><ExternalLink className="h-4 w-4" /></Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
            {paginated.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No mock tests</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
