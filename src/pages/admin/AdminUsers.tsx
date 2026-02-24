import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { Zap, Plus } from "lucide-react";
import DataTableControls from "@/components/admin/DataTableControls";
import { downloadCSV, type CsvColumn } from "@/lib/csv-export";

const PAGE_SIZE = 10;

const csvColumns: CsvColumn[] = [
  { key: "full_name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "user_id", label: "User ID" },
  { key: "credits", label: "Credits" },
  { key: "created_at", label: "Joined", accessor: (r) => new Date(r.created_at).toLocaleDateString() },
];

export default function AdminUsers() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [grantOpen, setGrantOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [grantCredits, setGrantCredits] = useState("");
  const [grantReason, setGrantReason] = useState("");
  const [grantExpiry, setGrantExpiry] = useState("");
  const [granting, setGranting] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => { loadProfiles(); }, []);

  function loadProfiles() {
    supabase.from("profiles").select("*").order("created_at", { ascending: false }).then(({ data }) => {
      if (data) setProfiles(data);
    });
  }

  const filtered = useMemo(() => {
    if (!search) return profiles;
    const q = search.toLowerCase();
    return profiles.filter(p =>
      (p.full_name || "").toLowerCase().includes(q) ||
      (p.email || "").toLowerCase().includes(q) ||
      (p.user_id || "").toLowerCase().includes(q)
    );
  }, [profiles, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [search]);

  function openGrant(profile: any) {
    setSelectedUser(profile);
    setGrantCredits("");
    setGrantReason("");
    setGrantExpiry("");
    setGrantOpen(true);
  }

  async function handleGrant() {
    if (!selectedUser || !user || !grantCredits) return;
    setGranting(true);
    const credits = parseInt(grantCredits);
    if (isNaN(credits) || credits <= 0) {
      toast.error("Invalid credit amount");
      setGranting(false);
      return;
    }
    const { error: grantError } = await supabase.from("credit_grants").insert({
      user_id: selectedUser.user_id,
      credits,
      reason: grantReason || null,
      granted_by: user.id,
      expires_at: grantExpiry ? new Date(grantExpiry).toISOString() : null,
    });
    if (grantError) {
      toast.error("Failed to record credit grant");
      setGranting(false);
      return;
    }
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ credits: (selectedUser.credits || 0) + credits })
      .eq("user_id", selectedUser.user_id);
    if (updateError) {
      toast.error("Failed to update credits");
    } else {
      toast.success(`Granted ${credits} credits to ${selectedUser.full_name || selectedUser.user_id}`);
      setGrantOpen(false);
      loadProfiles();
    }
    setGranting(false);
  }

  const grantForm = (
    <div className="space-y-4 py-4">
      <p className="text-sm text-muted-foreground">
        Granting credits to <strong>{selectedUser?.full_name || selectedUser?.user_id}</strong>
      </p>
      <div className="space-y-2">
        <Label>Credits to Grant</Label>
        <Input type="number" min="1" placeholder="e.g. 100" value={grantCredits} onChange={(e) => setGrantCredits(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Reason (optional)</Label>
        <Input placeholder="e.g. Promotional offer" value={grantReason} onChange={(e) => setGrantReason(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Expires At (optional)</Label>
        <Input type="datetime-local" value={grantExpiry} onChange={(e) => setGrantExpiry(e.target.value)} />
      </div>
      <Button onClick={handleGrant} className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-semibold" disabled={granting || !grantCredits}>
        {granting ? "Granting..." : "Grant Credits"}
      </Button>
    </div>
  );

  return (
    <div className="space-y-4">
      <DataTableControls
        search={search} onSearchChange={setSearch} page={page} totalPages={totalPages} onPageChange={setPage}
        placeholder="Search by name, email or user ID..."
        onExportCSV={() => downloadCSV(filtered, csvColumns, "users")}
      />

      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>User ID</TableHead>
              <TableHead className="text-center">Credits</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.full_name || "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{p.email || "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground font-mono max-w-[120px] truncate">{p.user_id}</TableCell>
                <TableCell className="text-center">
                  <span className="inline-flex items-center gap-1 text-sm font-semibold">
                    <Zap className="h-3.5 w-3.5 text-accent" />
                    {p.credits ?? 0}
                  </span>
                </TableCell>
                <TableCell>{new Date(p.created_at).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" onClick={() => openGrant(p)} className="gap-1">
                    <Plus className="h-3 w-3" /> Credits
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {paginated.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">No users found</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {isMobile ? (
        <Drawer open={grantOpen} onOpenChange={setGrantOpen}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Grant Credits</DrawerTitle>
              <DrawerDescription>Add credits to a user's account</DrawerDescription>
            </DrawerHeader>
            <div className="px-4 pb-6">{grantForm}</div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={grantOpen} onOpenChange={setGrantOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Grant Credits</DialogTitle>
              <DialogDescription>Add credits to a user's account</DialogDescription>
            </DialogHeader>
            {grantForm}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
