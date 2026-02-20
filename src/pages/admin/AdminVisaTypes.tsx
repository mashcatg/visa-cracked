import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Trash2, Plus, Pencil, Key } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { Tables } from "@/integrations/supabase/types";
import DataTableControls from "@/components/admin/DataTableControls";
import { downloadCSV, type CsvColumn } from "@/lib/csv-export";

const PAGE_SIZE = 10;

const csvColumns: CsvColumn[] = [
  { key: "country", label: "Country", accessor: (r) => (r.countries as any)?.name || "" },
  { key: "name", label: "Name" },
  { key: "description", label: "Description" },
  { key: "vapi", label: "Vapi Configured", accessor: (r) => r.vapi_assistant_id ? "Yes" : "No" },
];

export default function AdminVisaTypes() {
  const [visaTypes, setVisaTypes] = useState<any[]>([]);
  const [countries, setCountries] = useState<Tables<"countries">[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [countryId, setCountryId] = useState("");
  const [vapiAssistantId, setVapiAssistantId] = useState("");
  const [vapiPublicKey, setVapiPublicKey] = useState("");
  const [vapiPrivateKey, setVapiPrivateKey] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  async function fetchData() {
    const [vt, c] = await Promise.all([
      supabase.from("visa_types").select("*, countries(name, flag_emoji)").order("name"),
      supabase.from("countries").select("*").order("name"),
    ]);
    if (vt.data) setVisaTypes(vt.data);
    if (c.data) setCountries(c.data);
  }

  useEffect(() => { fetchData(); }, []);

  const filtered = useMemo(() => {
    if (!search) return visaTypes;
    const q = search.toLowerCase();
    return visaTypes.filter(vt =>
      vt.name.toLowerCase().includes(q) ||
      ((vt.countries as any)?.name || "").toLowerCase().includes(q) ||
      (vt.description || "").toLowerCase().includes(q)
    );
  }, [visaTypes, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [search]);

  function openEdit(vt: any) {
    setEditing(vt);
    setName(vt.name);
    setDescription(vt.description ?? "");
    setCountryId(vt.country_id);
    setVapiAssistantId(vt.vapi_assistant_id ?? "");
    setVapiPublicKey(vt.vapi_public_key ?? "");
    setVapiPrivateKey(vt.vapi_private_key ?? "");
    setDialogOpen(true);
  }

  function openNew() {
    setEditing(null);
    setName("");
    setDescription("");
    setCountryId("");
    setVapiAssistantId("");
    setVapiPublicKey("");
    setVapiPrivateKey("");
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!name || !countryId) { toast.error("Name and country are required"); return; }
    const payload = {
      name, description: description || null, country_id: countryId,
      vapi_assistant_id: vapiAssistantId || null, vapi_public_key: vapiPublicKey || null, vapi_private_key: vapiPrivateKey || null,
    };
    if (editing) {
      const { error } = await supabase.from("visa_types").update(payload).eq("id", editing.id);
      if (error) toast.error(error.message); else toast.success("Updated");
    } else {
      const { error } = await supabase.from("visa_types").insert(payload);
      if (error) toast.error(error.message); else toast.success("Added");
    }
    setDialogOpen(false);
    fetchData();
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from("visa_types").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); fetchData(); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <DataTableControls
          search={search} onSearchChange={setSearch} page={page} totalPages={totalPages} onPageChange={setPage}
          placeholder="Search visa types..."
          onExportCSV={() => downloadCSV(filtered, csvColumns, "visa-types")}
        />
        <Button onClick={openNew} className="bg-accent text-accent-foreground hover:bg-accent/90 shrink-0">
          <Plus className="h-4 w-4 mr-2" /> Add Visa Type
        </Button>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Country</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Vapi Config</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.map((vt) => (
              <TableRow key={vt.id}>
                <TableCell>{(vt.countries as any)?.flag_emoji} {(vt.countries as any)?.name}</TableCell>
                <TableCell className="font-medium">{vt.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{vt.description || "—"}</TableCell>
                <TableCell>
                  {vt.vapi_assistant_id ? (
                    <Badge variant="secondary" className="gap-1"><Key className="h-3 w-3" /> Configured</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">Not set</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(vt)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(vt.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {paginated.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No visa types</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit Visa Type" : "Add Visa Type"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
            <div className="space-y-2">
              <Label>Country</Label>
              <Select value={countryId} onValueChange={setCountryId}>
                <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                <SelectContent>
                  {countries.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.flag_emoji} {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="F1 Student Visa" /></div>
            <div className="space-y-2"><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" /></div>
            <div className="border-t pt-4 mt-4">
              <p className="text-sm font-semibold mb-3 flex items-center gap-2"><Key className="h-4 w-4 text-accent" />Vapi Configuration</p>
              <div className="space-y-3">
                <div className="space-y-2"><Label>Assistant ID</Label><Input value={vapiAssistantId} onChange={(e) => setVapiAssistantId(e.target.value)} placeholder="asst_..." /></div>
                <div className="space-y-2"><Label>Public Key</Label><Input value={vapiPublicKey} onChange={(e) => setVapiPublicKey(e.target.value)} placeholder="pk_..." /></div>
                <div className="space-y-2"><Label>Private Key</Label><Input type="password" value={vapiPrivateKey} onChange={(e) => setVapiPrivateKey(e.target.value)} placeholder="sk_..." /></div>
              </div>
            </div>
            <Button onClick={handleSave} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
