import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Upload, Loader2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreateInterviewModal({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [countries, setCountries] = useState<Tables<"countries">[]>([]);
  const [visaTypes, setVisaTypes] = useState<Tables<"visa_types">[]>([]);
  const [countryId, setCountryId] = useState("");
  const [visaTypeId, setVisaTypeId] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    supabase.from("countries").select("*").order("name").then(({ data }) => {
      if (data) setCountries(data);
    });
  }, [open]);

  useEffect(() => {
    if (!countryId) { setVisaTypes([]); return; }
    supabase.from("visa_types").select("*").eq("country_id", countryId).order("name").then(({ data }) => {
      if (data) setVisaTypes(data);
    });
    setVisaTypeId("");
  }, [countryId]);

  async function handleSubmit() {
    if (!user || !countryId || !visaTypeId) {
      toast.error("Please select a country and visa type");
      return;
    }
    setLoading(true);

    // Create interview record
    const { data: interview, error } = await supabase
      .from("interviews")
      .insert({ user_id: user.id, country_id: countryId, visa_type_id: visaTypeId, status: "pending" })
      .select()
      .single();

    if (error || !interview) {
      toast.error("Failed to create interview");
      setLoading(false);
      return;
    }

    // Upload files
    for (const file of files) {
      await supabase.storage.from("interview-documents").upload(`${user.id}/${interview.id}/${file.name}`, file);
    }

    onOpenChange(false);
    navigate(`/interview/${interview.id}/room`);
    setLoading(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Interview</DialogTitle>
          <DialogDescription>Select country and visa type to start a mock interview</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Country</Label>
            <Select value={countryId} onValueChange={setCountryId}>
              <SelectTrigger><SelectValue placeholder="Select a country" /></SelectTrigger>
              <SelectContent>
                {countries.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.flag_emoji} {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Visa Type</Label>
            <Select value={visaTypeId} onValueChange={setVisaTypeId} disabled={!countryId}>
              <SelectTrigger><SelectValue placeholder="Select visa type" /></SelectTrigger>
              <SelectContent>
                {visaTypes.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Supporting Documents (optional)</Label>
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
              <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground mb-2">Drop files or click to upload</p>
              <input
                type="file"
                multiple
                className="absolute inset-0 opacity-0 cursor-pointer"
                onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              />
              {files.length > 0 && (
                <p className="text-sm font-medium">{files.length} file(s) selected</p>
              )}
            </div>
          </div>
          <Button onClick={handleSubmit} className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-semibold" disabled={loading}>
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</> : "Start Interview"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
