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
import { Loader2, Zap } from "lucide-react";
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
  const [countryId, setCountryId] = useState("");
  const [visaTypeId, setVisaTypeId] = useState("");
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
  }, [countryId]);

  async function handleSubmit() {
    if (!user || !countryId || !visaTypeId) {
      toast.error("Please select a country and visa type");
      return;
    }
    if (credits < 10) {
      toast.error("Insufficient credits. You need 10 credits per mock test.");
      return;
    }
    setLoading(true);

    const country = countries.find(c => c.id === countryId);
    const visa = visaTypes.find(v => v.id === visaTypeId);
    const mockName = `${country?.flag_emoji || ''} ${country?.name || ''} ${visa?.name || ''} Mock`;

    // Create interview WITHOUT deducting credits - credits are deducted after successful call
    const { data: interview, error } = await supabase
      .from("interviews")
      .insert({ user_id: user.id, country_id: countryId, visa_type_id: visaTypeId, status: "pending", name: mockName })
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
      <Button onClick={handleSubmit} className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-semibold" disabled={loading || credits < 10}>
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
            <DrawerDescription>Select country and visa type to start</DrawerDescription>
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
          <DialogDescription>Select country and visa type to start a mock test</DialogDescription>
        </DialogHeader>
        <CreateInterviewForm onOpenChange={onOpenChange} />
      </DialogContent>
    </Dialog>
  );
}
