import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { useIsMobile } from "@/hooks/use-mobile";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function CreateInterviewForm({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [countries, setCountries] = useState<Tables<"countries">[]>([]);
  const [visaTypes, setVisaTypes] = useState<Tables<"visa_types">[]>([]);
  const [difficulties, setDifficulties] = useState<any[]>([]);
  const [countryId, setCountryId] = useState("");
  const [visaTypeId, setVisaTypeId] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [loading, setLoading] = useState(false);
  const [credits, setCredits] = useState<number>(0);

  useEffect(() => {
    supabase.from("countries").select("*").order("name").then(({ data }) => {
      if (data) setCountries(data);
    });
    if (user) {
      supabase.from("profiles").select("credits").eq("user_id", user.id).single().then(({ data }) => {
        if (data) setCredits(data.credits ?? 0);
      });
    }
  }, [user]);

  useEffect(() => {
    if (!countryId) { setVisaTypes([]); return; }
    supabase.from("visa_types").select("*").eq("country_id", countryId).order("name").then(({ data }) => {
      if (data) setVisaTypes(data);
    });
    setVisaTypeId("");
    setDifficulty("");
    setDifficulties([]);
  }, [countryId]);

  useEffect(() => {
    if (!visaTypeId) { setDifficulties([]); setDifficulty(""); return; }
    supabase
      .from("difficulty_modes")
      .select("*")
      .eq("visa_type_id", visaTypeId)
      .not("vapi_assistant_id", "is", null)
      .then(({ data }) => {
        if (data) setDifficulties(data);
      });
    setDifficulty("");
  }, [visaTypeId]);

  async function handleSubmit() {
    if (!user || !countryId || !visaTypeId || !difficulty) {
      toast.error("Please select country, visa type, and difficulty");
      return;
    }
    if (credits < 10) {
      toast.error("Insufficient credits. You need 10 credits per mock test.");
      return;
    }
    setLoading(true);

    const country = countries.find(c => c.id === countryId);
    const visa = visaTypes.find(v => v.id === visaTypeId);
    const diffLabel = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
    const mockName = `${country?.flag_emoji || ''} ${country?.name || ''} ${visa?.name || ''} Mock (${diffLabel})`;

    const { data: interview, error } = await supabase
      .from("interviews")
      .insert({
        user_id: user.id,
        country_id: countryId,
        visa_type_id: visaTypeId,
        difficulty,
        status: "pending",
        name: mockName,
      })
      .select()
      .single();

    if (error || !interview) {
      toast.error("Failed to create mock test");
      setLoading(false);
      return;
    }

    onOpenChange(false);
    navigate(`/interview/${interview.id}/room`);
    setLoading(false);
  }

  const difficultyOrder = ["easy", "medium", "hard"];
  const sortedDifficulties = [...difficulties].sort(
    (a, b) => difficultyOrder.indexOf(a.difficulty) - difficultyOrder.indexOf(b.difficulty)
  );

  return (
    <div className="space-y-4 py-4 px-1">
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
        <Label>Difficulty</Label>
        <Select value={difficulty} onValueChange={setDifficulty} disabled={!visaTypeId || sortedDifficulties.length === 0}>
          <SelectTrigger><SelectValue placeholder={sortedDifficulties.length === 0 && visaTypeId ? "No modes configured" : "Select difficulty"} /></SelectTrigger>
          <SelectContent>
            {sortedDifficulties.map((d) => (
              <SelectItem key={d.difficulty} value={d.difficulty} className="capitalize">
                {d.difficulty.charAt(0).toUpperCase() + d.difficulty.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button onClick={handleSubmit} className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-semibold" disabled={loading || credits < 10 || !difficulty}>
        {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</> : "Start Mock Test (10 Credits)"}
      </Button>
    </div>
  );
}

export default function CreateInterviewModal({ open, onOpenChange }: Props) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Create Mock Test</DrawerTitle>
            <DrawerDescription>Select country, visa type, and difficulty</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-6">
            <CreateInterviewForm onOpenChange={onOpenChange} />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Mock Test</DialogTitle>
          <DialogDescription>Select country, visa type, and difficulty to start</DialogDescription>
        </DialogHeader>
        <CreateInterviewForm onOpenChange={onOpenChange} />
      </DialogContent>
    </Dialog>
  );
}
