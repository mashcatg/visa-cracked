import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Trash2, Plus, Pencil, Settings2, Save, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { Tables } from "@/integrations/supabase/types";
import DataTableControls from "@/components/admin/DataTableControls";
import { downloadCSV, type CsvColumn } from "@/lib/csv-export";

const PAGE_SIZE = 10;
const DIFFICULTIES = ["easy", "medium", "hard"] as const;

const csvColumns: CsvColumn[] = [
  { key: "country", label: "Country", accessor: (r) => (r.countries as any)?.name || "" },
  { key: "name", label: "Name" },
  { key: "description", label: "Description" },
];

type DifficultyMode = {
  id?: string;
  difficulty: string;
  vapi_assistant_id: string;
  vapi_public_key: string;
  vapi_private_key: string;
};

export default function AdminVisaTypes() {
  const [visaTypes, setVisaTypes] = useState<any[]>([]);
  const [countries, setCountries] = useState<Tables<"countries">[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [modesDialogOpen, setModesDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [modesVisaType, setModesVisaType] = useState<any>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [countryId, setCountryId] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [modes, setModes] = useState<DifficultyMode[]>([]);
  const [savingMode, setSavingMode] = useState<string | null>(null);

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
    setDialogOpen(true);
  }

  function openNew() {
    setEditing(null);
    setName("");
    setDescription("");
    setCountryId("");
    setDialogOpen(true);
  }

  async function openModes(vt: any) {
    setModesVisaType(vt);
    // Fetch existing modes for this visa type
    const { data } = await supabase
      .from("difficulty_modes")
      .select("*")
      .eq("visa_type_id", vt.id);

    const existingModes = data || [];
    const allModes: DifficultyMode[] = DIFFICULTIES.map(d => {
      const existing = existingModes.find((m: any) => m.difficulty === d);
      return {
        id: existing?.id,
        difficulty: d,
        vapi_assistant_id: existing?.vapi_assistant_id || "",
        vapi_public_key: existing?.vapi_public_key || "",
        vapi_private_key: existing?.vapi_private_key || "",
      };
    });
    setModes(allModes);
    setModesDialogOpen(true);
  }

  async function handleSaveMode(mode: DifficultyMode) {
    if (!modesVisaType) return;
    setSavingMode(mode.difficulty);

    const payload = {
      visa_type_id: modesVisaType.id,
      difficulty: mode.difficulty,
      vapi_assistant_id: mode.vapi_assistant_id || null,
      vapi_public_key: mode.vapi_public_key || null,
      vapi_private_key: mode.vapi_private_key || null,
    };

    const { error } = await supabase
      .from("difficulty_modes")
      .upsert(payload, { onConflict: "visa_type_id,difficulty" });

    if (error) toast.error(error.message);
    else toast.success(`${mode.difficulty.charAt(0).toUpperCase() + mode.difficulty.slice(1)} mode saved`);
    setSavingMode(null);
  }

  function updateMode(difficulty: string, field: string, value: string) {
    setModes(prev => prev.map(m =>
      m.difficulty === difficulty ? { ...m, [field]: value } : m
    ));
  }

  async function handleSave() {
    if (!name || !countryId) { toast.error("Name and country are required"); return; }
    const payload = {
      name, description: description || null, country_id: countryId,
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
              <TableHead className="w-32">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.map((vt) => (
              <TableRow key={vt.id}>
                <TableCell>{(vt.countries as any)?.flag_emoji} {(vt.countries as any)?.name}</TableCell>
                <TableCell className="font-medium">{vt.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{vt.description || "—"}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openModes(vt)} title="Manage Difficulty Modes">
                      <Settings2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(vt)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(vt.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {paginated.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No visa types</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add/Edit Visa Type Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit Visa Type" : "Add Visa Type"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
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
            <Button onClick={handleSave} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Difficulty Modes Dialog */}
      <Dialog open={modesDialogOpen} onOpenChange={setModesDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Difficulty Modes — {modesVisaType?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4 max-h-[70vh] overflow-y-auto">
            {modes.map((mode) => (
              <div key={mode.difficulty} className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant={mode.vapi_assistant_id ? "default" : "secondary"} className="capitalize text-sm">
                    {mode.difficulty}
                  </Badge>
                  {mode.vapi_assistant_id && (
                    <span className="text-xs text-muted-foreground">Configured ✓</span>
                  )}
                </div>
                <div className="grid gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Assistant ID</Label>
                    <Input
                      value={mode.vapi_assistant_id}
                      onChange={(e) => updateMode(mode.difficulty, "vapi_assistant_id", e.target.value)}
                      placeholder="asst_..."
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Public Key</Label>
                    <Input
                      value={mode.vapi_public_key}
                      onChange={(e) => updateMode(mode.difficulty, "vapi_public_key", e.target.value)}
                      placeholder="pk_..."
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Private Key</Label>
                    <Input
                      type="password"
                      value={mode.vapi_private_key}
                      onChange={(e) => updateMode(mode.difficulty, "vapi_private_key", e.target.value)}
                      placeholder="sk_..."
                    />
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleSaveMode(mode)}
                  disabled={savingMode === mode.difficulty}
                  className="bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  {savingMode === mode.difficulty ? (
                    <><Loader2 className="mr-2 h-3 w-3 animate-spin" /> Saving...</>
                  ) : (
                    <><Save className="mr-2 h-3 w-3" /> Save {mode.difficulty}</>
                  )}
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
