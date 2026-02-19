import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Trash2, Plus, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { Tables } from "@/integrations/supabase/types";

export default function AdminCountries() {
  const [countries, setCountries] = useState<Tables<"countries">[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Tables<"countries"> | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [flagEmoji, setFlagEmoji] = useState("");

  async function fetchCountries() {
    const { data } = await supabase.from("countries").select("*").order("name");
    if (data) setCountries(data);
  }

  useEffect(() => { fetchCountries(); }, []);

  function openEdit(country: Tables<"countries">) {
    setEditing(country);
    setName(country.name);
    setCode(country.code);
    setFlagEmoji(country.flag_emoji ?? "");
    setDialogOpen(true);
  }

  function openNew() {
    setEditing(null);
    setName("");
    setCode("");
    setFlagEmoji("");
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!name || !code) { toast.error("Name and code are required"); return; }

    if (editing) {
      const { error } = await supabase.from("countries").update({ name, code, flag_emoji: flagEmoji || null }).eq("id", editing.id);
      if (error) toast.error(error.message);
      else toast.success("Country updated");
    } else {
      const { error } = await supabase.from("countries").insert({ name, code, flag_emoji: flagEmoji || null });
      if (error) toast.error(error.message);
      else toast.success("Country added");
    }
    setDialogOpen(false);
    fetchCountries();
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from("countries").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); fetchCountries(); }
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button onClick={openNew} className="bg-accent text-accent-foreground hover:bg-accent/90">
          <Plus className="h-4 w-4 mr-2" /> Add Country
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Flag</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {countries.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="text-xl">{c.flag_emoji}</TableCell>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{c.code}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {countries.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No countries</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Country" : "Add Country"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="United States" /></div>
            <div className="space-y-2"><Label>Code</Label><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="US" maxLength={3} /></div>
            <div className="space-y-2"><Label>Flag Emoji</Label><Input value={flagEmoji} onChange={(e) => setFlagEmoji(e.target.value)} placeholder="🇺🇸" /></div>
            <Button onClick={handleSave} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
