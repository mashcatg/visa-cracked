import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function AdminAdmins() {
  const [admins, setAdmins] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function fetchAdmins() {
    const { data } = await supabase
      .from("user_roles")
      .select("*, profiles(full_name, user_id)")
      .eq("role", "admin");
    if (data) setAdmins(data);
  }

  useEffect(() => { fetchAdmins(); }, []);

  async function addAdmin() {
    if (!email) return;
    setLoading(true);

    // Find user by looking up profiles — we need the user_id
    // Since we can't query auth.users, we search profiles
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id")
      .limit(1);

    // For now, we need the user_id. We'll use an edge function for this.
    toast.info("To add admins, the user must first sign up. Then you can assign them the admin role.");
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
    <div>
      <div className="flex justify-end mb-4">
        <Button onClick={() => setDialogOpen(true)} className="bg-accent text-accent-foreground hover:bg-accent/90">
          <Plus className="h-4 w-4 mr-2" /> Add Admin
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>User ID</TableHead>
              <TableHead className="w-20">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {admins.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{(a.profiles as any)?.full_name || "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground font-mono">{a.user_id}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => removeAdmin(a.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {admins.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-8">No admins found</TableCell>
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
