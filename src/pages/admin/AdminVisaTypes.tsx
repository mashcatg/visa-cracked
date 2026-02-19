import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Trash2, Plus, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { Tables } from "@/integrations/supabase/types";

export default function AdminVisaTypes() {
  const [visaTypes, setVisaTypes] = useState<any[]>([]);
  const [countries, setCountries] = useState<Tables<"countries">[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [countryId, setCountryId] = useState("");

  async function fetchData() {
    const [vt, c] = await Promise.all([
      supabase.from("visa_types").select("*, countries(name, flag_emoji)").order("name"),
      supabase.from("countries").select("*").order("name"),
    ]);
    if (vt.data) setVisaTypes(vt.data);
    if (c.data) setCountries(c.data);
  }

  useEffect(() => { fetchData(); }, []);

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

  async function handleSave() {
    if (!name || !countryId) { toast.error("Name and country are required"); return; }

    if (editing) {
      const { error } = await supabase.from("visa_types").update({ name, description: description || null, country_id: countryId }).eq("id", editing.id);
      if (error) toast.error(error.message);
      else toast.success("Updated");
    } else {
      const { error } = await supabase.from("visa_types").insert({ name, description: description || null, country_id: countryId });
      if (error) toast.error(error.message);
      else toast.success("Added");
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
    <div>
      <div className="flex justify-end mb-4">
        <Button onClick={openNew} className="bg-accent text-accent-foreground hover:bg-accent/90">
          <Plus className="h-4 w-4 mr-2" /> Add Visa Type
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Country</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visaTypes.map((vt) => (
              <TableRow key={vt.id}>
                <TableCell>{(vt.countries as any)?.flag_emoji} {(vt.countries as any)?.name}</TableCell>
                <TableCell className="font-medium">{vt.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{vt.description || "—"}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(vt)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(vt.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {visaTypes.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No visa types</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
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
    </div>
  );
}
