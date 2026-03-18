import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Trash2, Plus, Pencil, Settings2, Save, Loader2, ListChecks, GripVertical, ArrowUp, ArrowDown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { Tables } from "@/integrations/supabase/types";
import DataTableControls from "@/components/admin/DataTableControls";
import { downloadCSV, type CsvColumn } from "@/lib/csv-export";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;
const DIFFICULTIES = ["easy", "medium", "hard"] as const;
const FIELD_TYPES = ["text", "textarea", "date", "select", "number"] as const;

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
  judgment_system_prompt: string;
  output_structure: string;
};

type FormField = {
  id?: string;
  label: string;
  field_key: string;
  field_type: string;
  placeholder: string;
  is_required: boolean;
  sort_order: number;
  options: string[];
};

export default function AdminVisaTypes() {
  const [visaTypes, setVisaTypes] = useState<any[]>([]);
  const [countries, setCountries] = useState<Tables<"countries">[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [modesDialogOpen, setModesDialogOpen] = useState(false);
  const [fieldsDialogOpen, setFieldsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [modesVisaType, setModesVisaType] = useState<any>(null);
  const [fieldsVisaType, setFieldsVisaType] = useState<any>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [countryId, setCountryId] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [modes, setModes] = useState<DifficultyMode[]>([]);
  const [savingMode, setSavingMode] = useState<string | null>(null);
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [savingFields, setSavingFields] = useState(false);
  const [draggingFieldIndex, setDraggingFieldIndex] = useState<number | null>(null);
  const [dragOverFieldIndex, setDragOverFieldIndex] = useState<number | null>(null);

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
    setEditing(vt); setName(vt.name); setDescription(vt.description ?? ""); setCountryId(vt.country_id); setDialogOpen(true);
  }

  function openNew() {
    setEditing(null); setName(""); setDescription(""); setCountryId(""); setDialogOpen(true);
  }

  async function openModes(vt: any) {
    setModesVisaType(vt);
    const { data } = await supabase.from("difficulty_modes").select("*").eq("visa_type_id", vt.id);
    const existingModes = data || [];
    const allModes: DifficultyMode[] = DIFFICULTIES.map(d => {
      const existing = existingModes.find((m: any) => m.difficulty === d);
      return {
        id: existing?.id,
        difficulty: d,
        vapi_assistant_id: existing?.vapi_assistant_id || "",
        vapi_public_key: existing?.vapi_public_key || "",
        vapi_private_key: existing?.vapi_private_key || "",
        judgment_system_prompt: existing?.judgment_system_prompt || "",
        output_structure: existing?.output_structure ? JSON.stringify(existing.output_structure, null, 2) : "",
      };
    });
    setModes(allModes);
    setModesDialogOpen(true);
  }

  async function openFields(vt: any) {
    setFieldsVisaType(vt);
    const { data } = await supabase.from("visa_type_form_fields").select("*").eq("visa_type_id", vt.id).order("sort_order");
    setFormFields((data || []).map((f: any) => ({
      id: f.id,
      label: f.label,
      field_key: f.field_key,
      field_type: f.field_type,
      placeholder: f.placeholder || "",
      is_required: f.is_required,
      sort_order: f.sort_order,
      options: Array.isArray(f.options) ? f.options : [],
    })));
    setFieldsDialogOpen(true);
  }

  async function handleSaveMode(mode: DifficultyMode) {
    if (!modesVisaType) return;
    setSavingMode(mode.difficulty);

    let parsedOutputStructure = null;
    if (mode.output_structure.trim()) {
      try {
        parsedOutputStructure = JSON.parse(mode.output_structure);
      } catch {
        toast.error("Output Structure must be valid JSON");
        setSavingMode(null);
        return;
      }
    }

    const payload = {
      visa_type_id: modesVisaType.id,
      difficulty: mode.difficulty,
      vapi_assistant_id: mode.vapi_assistant_id || null,
      vapi_public_key: mode.vapi_public_key || null,
      vapi_private_key: mode.vapi_private_key || null,
      judgment_system_prompt: mode.judgment_system_prompt || null,
      output_structure: parsedOutputStructure,
    };

    const { error } = await supabase.from("difficulty_modes").upsert(payload, { onConflict: "visa_type_id,difficulty" });
    if (error) toast.error(error.message);
    else toast.success(`${mode.difficulty.charAt(0).toUpperCase() + mode.difficulty.slice(1)} mode saved`);
    setSavingMode(null);
  }

  function updateMode(difficulty: string, field: string, value: string) {
    setModes(prev => prev.map(m => m.difficulty === difficulty ? { ...m, [field]: value } : m));
  }

  function addFormField() {
    setFormFields(prev => [...prev, {
      label: "", field_key: "", field_type: "text", placeholder: "", is_required: false, sort_order: prev.length, options: [],
    }]);
  }

  function updateFormField(index: number, field: string, value: any) {
    setFormFields(prev => prev.map((f, i) => i === index ? { ...f, [field]: value } : f));
  }

  function removeFormField(index: number) {
    setFormFields(prev => prev.filter((_, i) => i !== index));
  }

  function moveFormField(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
    setFormFields((prev) => {
      if (fromIndex >= prev.length || toIndex >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

  function moveFieldUp(index: number) {
    if (index <= 0) return;
    moveFormField(index, index - 1);
  }

  function moveFieldDown(index: number) {
    if (index >= formFields.length - 1) return;
    moveFormField(index, index + 1);
  }

  async function handleSaveFields() {
    if (!fieldsVisaType) return;
    // Validate
    for (const f of formFields) {
      if (!f.label.trim() || !f.field_key.trim()) {
        toast.error("Label and Field Key are required for all fields");
        return;
      }
    }
    setSavingFields(true);

    // Delete existing fields and re-insert
    await supabase.from("visa_type_form_fields").delete().eq("visa_type_id", fieldsVisaType.id);

    if (formFields.length > 0) {
      const inserts = formFields.map((f, i) => ({
        visa_type_id: fieldsVisaType.id,
        label: f.label,
        field_key: f.field_key,
        field_type: f.field_type,
        placeholder: f.placeholder || null,
        is_required: f.is_required,
        sort_order: i,
        options: f.field_type === "select" ? f.options : null,
      }));
      const { error } = await supabase.from("visa_type_form_fields").insert(inserts);
      if (error) { toast.error(error.message); setSavingFields(false); return; }
    }

    toast.success("Form fields saved");
    setSavingFields(false);
  }

  async function handleSave() {
    if (!name || !countryId) { toast.error("Name and country are required"); return; }
    const payload = { name, description: description || null, country_id: countryId };
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
              <TableHead className="w-44">Actions</TableHead>
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
                    <Button variant="ghost" size="icon" onClick={() => openFields(vt)} title="Form Fields">
                      <ListChecks className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openModes(vt)} title="Difficulty Modes">
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
                <SelectContent>{countries.map((c) => <SelectItem key={c.id} value={c.id}>{c.flag_emoji} {c.name}</SelectItem>)}</SelectContent>
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
          <DialogHeader><DialogTitle>Difficulty Modes — {modesVisaType?.name}</DialogTitle></DialogHeader>
          <div className="space-y-6 py-4 max-h-[70vh] overflow-y-auto">
            {modes.map((mode) => (
              <div key={mode.difficulty} className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant={mode.vapi_assistant_id ? "default" : "secondary"} className="capitalize text-sm">{mode.difficulty}</Badge>
                  {mode.vapi_assistant_id && <span className="text-xs text-muted-foreground">Configured ✓</span>}
                </div>
                <div className="grid gap-3">
                  <div className="space-y-1"><Label className="text-xs">Assistant ID</Label><Input value={mode.vapi_assistant_id} onChange={(e) => updateMode(mode.difficulty, "vapi_assistant_id", e.target.value)} placeholder="asst_..." /></div>
                  <div className="space-y-1"><Label className="text-xs">Public Key</Label><Input value={mode.vapi_public_key} onChange={(e) => updateMode(mode.difficulty, "vapi_public_key", e.target.value)} placeholder="pk_..." /></div>
                  <div className="space-y-1"><Label className="text-xs">Private Key</Label><Input type="password" value={mode.vapi_private_key} onChange={(e) => updateMode(mode.difficulty, "vapi_private_key", e.target.value)} placeholder="sk_..." /></div>
                  <div className="space-y-1"><Label className="text-xs">Judgment System Prompt</Label><Textarea value={mode.judgment_system_prompt || ""} onChange={(e) => updateMode(mode.difficulty, "judgment_system_prompt", e.target.value)} placeholder="Custom system prompt for AI analysis..." className="min-h-[80px] text-xs" /></div>
                  <div className="space-y-1"><Label className="text-xs">Output Structure (JSON)</Label><Textarea value={mode.output_structure || ""} onChange={(e) => updateMode(mode.difficulty, "output_structure", e.target.value)} placeholder='{"difficulty":"Hard","verdict":"","overall_score":0,...}' className="min-h-[100px] text-xs font-mono" /></div>
                </div>
                <Button size="sm" onClick={() => handleSaveMode(mode)} disabled={savingMode === mode.difficulty} className="bg-accent text-accent-foreground hover:bg-accent/90">
                  {savingMode === mode.difficulty ? <><Loader2 className="mr-2 h-3 w-3 animate-spin" /> Saving...</> : <><Save className="mr-2 h-3 w-3" /> Save {mode.difficulty}</>}
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Form Fields Builder Dialog */}
      <Dialog open={fieldsDialogOpen} onOpenChange={setFieldsDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>Form Fields — {fieldsVisaType?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
            <p className="text-xs text-muted-foreground">Tip: Drag fields with the grip handle, or use arrow buttons for precise ordering.</p>
            {formFields.length === 0 && (
              <p className="text-center text-muted-foreground py-4 text-sm">No fields configured. Add fields that users fill during onboarding.</p>
            )}
            {formFields.length > 0 && (
              <Accordion type="multiple" className="space-y-2">
                {formFields.map((field, index) => (
                  <AccordionItem
                    key={field.id ?? `field-${index}-${field.field_key || "new"}`}
                    value={`field-${index}`}
                    className={cn(
                      "rounded-lg border px-3",
                      dragOverFieldIndex === index ? "border-accent ring-1 ring-accent/40" : "border-border"
                    )}
                    draggable
                    onDragStart={() => setDraggingFieldIndex(index)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverFieldIndex(index);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (draggingFieldIndex !== null) {
                        moveFormField(draggingFieldIndex, index);
                      }
                      setDraggingFieldIndex(null);
                      setDragOverFieldIndex(null);
                    }}
                    onDragEnd={() => {
                      setDraggingFieldIndex(null);
                      setDragOverFieldIndex(null);
                    }}
                  >
                    <div className="flex items-center gap-2 py-1">
                      <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                      <AccordionTrigger className="py-2 hover:no-underline">
                        <div className="flex items-center gap-2 text-left">
                          <span className="text-xs font-medium text-muted-foreground">Field {index + 1}</span>
                          <span className="text-sm font-semibold">{field.label || "Untitled Field"}</span>
                          {field.is_required && <Badge variant="secondary" className="text-[10px]">Required</Badge>}
                        </div>
                      </AccordionTrigger>
                      <div className="flex items-center gap-1 ml-2">
                        <Button type="button" variant="ghost" size="icon" onClick={() => moveFieldUp(index)} disabled={index === 0}>
                          <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" onClick={() => moveFieldDown(index)} disabled={index === formFields.length - 1}>
                          <ArrowDown className="h-3.5 w-3.5" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeFormField(index)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>

                    <AccordionContent>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        <div className="space-y-1">
                          <Label className="text-xs">Label</Label>
                          <Input value={field.label} onChange={e => updateFormField(index, "label", e.target.value)} placeholder="e.g. University Name" className="text-sm" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Field Key</Label>
                          <Input value={field.field_key} onChange={e => updateFormField(index, "field_key", e.target.value.toLowerCase().replace(/\s+/g, "_"))} placeholder="e.g. university_name" className="text-sm font-mono" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Type</Label>
                          <Select value={field.field_type} onValueChange={v => updateFormField(index, "field_type", v)}>
                            <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>{FIELD_TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Placeholder</Label>
                          <Input value={field.placeholder} onChange={e => updateFormField(index, "placeholder", e.target.value)} placeholder="Hint text" className="text-sm" />
                        </div>
                      </div>
                      {field.field_type === "select" && (
                        <div className="space-y-1 mt-2">
                          <Label className="text-xs">Options (comma-separated)</Label>
                          <Input value={(field.options || []).join(", ")} onChange={e => updateFormField(index, "options", e.target.value.split(",").map(s => s.trim()).filter(Boolean))} placeholder="Option 1, Option 2, Option 3" className="text-sm" />
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <Switch checked={field.is_required} onCheckedChange={v => updateFormField(index, "is_required", v)} />
                        <Label className="text-xs">Required</Label>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={addFormField} className="flex-1"><Plus className="h-4 w-4 mr-2" /> Add Field</Button>
              <Button onClick={handleSaveFields} disabled={savingFields} className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90">
                {savingFields ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : <><Save className="mr-2 h-4 w-4" /> Save Fields</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
