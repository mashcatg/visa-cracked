import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import DataTableControls from "@/components/admin/DataTableControls";
import { downloadCSV, type CsvColumn } from "@/lib/csv-export";

const PAGE_SIZE = 10;

const csvColumns: CsvColumn[] = [
  { key: "name", label: "Name", accessor: (r) => (r.profiles as any)?.full_name || "" },
  { key: "email", label: "Email", accessor: (r) => (r.profiles as any)?.email || "" },
  { key: "user_id", label: "User ID" },
];

export default function AdminAdmins() {
  const [admins, setAdmins] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  async function fetchAdmins() {
    const { data } = await supabase
      .from("user_roles")
      .select("*, profiles!user_roles_user_id_profiles_fkey(full_name, email, user_id)")
      .eq("role", "admin");
    if (data) setAdmins(data);
  }

  useEffect(() => { fetchAdmins(); }, []);

  const filtered = useMemo(() => {
    if (!search) return admins;
    const q = search.toLowerCase();
    return admins.filter(a =>
      ((a.profiles as any)?.full_name || "").toLowerCase().includes(q) ||
      ((a.profiles as any)?.email || "").toLowerCase().includes(q) ||
      (a.user_id || "").toLowerCase().includes(q)
    );
  }, [admins, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [search]);

  async function addAdmin() {
    if (!email) return;
    setLoading(true);
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

  async function removeAdmin(roleId: string) {
    const { error } = await supabase.from("user_roles").delete().eq("id", roleId);
    if (error) {
      toast.error("Failed to remove admin");
    } else {
      toast.success("Admin removed");
      fetchAdmins();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <DataTableControls
          search={search} onSearchChange={setSearch} page={page} totalPages={totalPages} onPageChange={setPage}
          placeholder="Search admins..."
          onExportCSV={() => downloadCSV(filtered, csvColumns, "admins")}
        />
        <Button onClick={() => setDialogOpen(true)} className="bg-accent text-accent-foreground hover:bg-accent/90 shrink-0">
          <Plus className="h-4 w-4 mr-2" /> Add Admin
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>User ID</TableHead>
              <TableHead className="w-20">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{(a.profiles as any)?.full_name || "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{(a.profiles as any)?.email || "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground font-mono">{a.user_id}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => removeAdmin(a.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {paginated.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">No admins found</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Admin</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>User Email</Label>
              <Input placeholder="user@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <Button onClick={addAdmin} disabled={loading} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
              {loading ? "Adding..." : "Add Admin"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
