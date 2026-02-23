import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Tag } from "lucide-react";
import DataTableControls from "@/components/admin/DataTableControls";
import { Badge } from "@/components/ui/badge";

const PAGE_SIZE = 10;

interface Coupon {
  id: string;
  code: string;
  discount_type: string;
  discount_amount: number;
  expiration_date: string | null;
  total_usage_limit: number | null;
  per_user_limit: number;
  times_used: number;
  is_active: boolean;
  created_at: string;
}

const emptyCoupon = {
  code: "",
  discount_type: "percentage",
  discount_amount: "",
  expiration_date: "",
  total_usage_limit: "",
  per_user_limit: "1",
};

export default function AdminDiscounts() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyCoupon);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase
      .from("coupons")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setCoupons(data as Coupon[]);
  }

  const filtered = useMemo(() => {
    if (!search) return coupons;
    const q = search.toLowerCase();
    return coupons.filter(c => c.code.toLowerCase().includes(q));
  }, [coupons, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [search]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyCoupon);
    setModalOpen(true);
  }

  function openEdit(c: Coupon) {
    setEditingId(c.id);
    setForm({
      code: c.code,
      discount_type: c.discount_type,
      discount_amount: String(c.discount_amount),
      expiration_date: c.expiration_date ? c.expiration_date.slice(0, 16) : "",
      total_usage_limit: c.total_usage_limit != null ? String(c.total_usage_limit) : "",
      per_user_limit: String(c.per_user_limit),
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.code || !form.discount_amount) {
      toast.error("Code and discount amount are required");
      return;
    }
    setSaving(true);
    const payload: any = {
      code: form.code.toUpperCase(),
      discount_type: form.discount_type,
      discount_amount: parseFloat(form.discount_amount),
      expiration_date: form.expiration_date ? new Date(form.expiration_date).toISOString() : null,
      total_usage_limit: form.total_usage_limit ? parseInt(form.total_usage_limit) : null,
      per_user_limit: parseInt(form.per_user_limit) || 1,
    };

    let error;
    if (editingId) {
      ({ error } = await supabase.from("coupons").update(payload).eq("id", editingId));
    } else {
      ({ error } = await supabase.from("coupons").insert(payload));
    }

    if (error) {
      toast.error(error.message || "Failed to save coupon");
    } else {
      toast.success(editingId ? "Coupon updated" : "Coupon created");
      setModalOpen(false);
      load();
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this coupon?")) return;
    const { error } = await supabase.from("coupons").delete().eq("id", id);
    if (error) toast.error("Failed to delete");
    else { toast.success("Coupon deleted"); load(); }
  }

  async function toggleActive(c: Coupon) {
    const { error } = await supabase.from("coupons").update({ is_active: !c.is_active }).eq("id", c.id);
    if (error) toast.error("Failed to update");
    else load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <DataTableControls
          search={search} onSearchChange={setSearch} page={page} totalPages={totalPages} onPageChange={setPage}
          placeholder="Search by coupon code..."
        />
        <Button onClick={openCreate} className="bg-accent text-accent-foreground hover:bg-accent/90 gap-1.5">
          <Plus className="h-4 w-4" /> Create Coupon
        </Button>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Expiry</TableHead>
              <TableHead className="text-center">Usage</TableHead>
              <TableHead className="text-center">Per User</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <span className="inline-flex items-center gap-1.5 font-mono font-semibold">
                    <Tag className="h-3.5 w-3.5 text-accent" />
                    {c.code}
                  </span>
                </TableCell>
                <TableCell className="capitalize">{c.discount_type}</TableCell>
                <TableCell>{c.discount_type === "percentage" ? `${c.discount_amount}%` : `${c.discount_amount} TK`}</TableCell>
                <TableCell>{c.expiration_date ? new Date(c.expiration_date).toLocaleDateString() : "—"}</TableCell>
                <TableCell className="text-center">
                  {c.times_used}{c.total_usage_limit != null ? `/${c.total_usage_limit}` : ""}
                </TableCell>
                <TableCell className="text-center">{c.per_user_limit}</TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Switch checked={c.is_active} onCheckedChange={() => toggleActive(c)} />
                    <Badge variant={c.is_active ? "default" : "secondary"}>
                      {c.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell className="text-right space-x-1">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDelete(c.id)}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {paginated.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">No coupons found</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Coupon" : "Create Coupon"}</DialogTitle>
            <DialogDescription>Configure coupon details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Coupon Code</Label>
              <Input placeholder="e.g. SAVE20" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} className="uppercase" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Discount Type</Label>
                <Select value={form.discount_type} onValueChange={v => setForm(f => ({ ...f, discount_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="fixed">Fixed Amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Discount Amount</Label>
                <Input type="number" min="0" placeholder={form.discount_type === "percentage" ? "e.g. 20" : "e.g. 200"} value={form.discount_amount} onChange={e => setForm(f => ({ ...f, discount_amount: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Expiration Date (optional)</Label>
              <Input type="datetime-local" value={form.expiration_date} onChange={e => setForm(f => ({ ...f, expiration_date: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Total Usage Limit (optional)</Label>
                <Input type="number" min="1" placeholder="Unlimited" value={form.total_usage_limit} onChange={e => setForm(f => ({ ...f, total_usage_limit: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Per-User Limit</Label>
                <Input type="number" min="1" value={form.per_user_limit} onChange={e => setForm(f => ({ ...f, per_user_limit: e.target.value }))} />
              </div>
            </div>
            <Button onClick={handleSave} className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-semibold" disabled={saving}>
              {saving ? "Saving..." : editingId ? "Update Coupon" : "Create Coupon"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
