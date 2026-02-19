import { useState, useEffect } from "react";
import AppSidebar from "./AppSidebar";
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import CreateInterviewModal from "@/components/interview/CreateInterviewModal";
import PricingModal from "@/components/pricing/PricingModal";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { FileText } from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [interviews, setInterviews] = useState<any[]>([]);
  const navigate = useNavigate();
  const { user } = useAuth();

  // Ctrl+K shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!user || !searchOpen) return;
    supabase
      .from("interviews")
      .select("*, countries(name), visa_types(name)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (data) setInterviews(data);
      });
  }, [user, searchOpen]);

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar
        onSearchOpen={() => setSearchOpen(true)}
        onCreateInterview={() => setCreateOpen(true)}
        onPricingOpen={() => setPricingOpen(true)}
      />
      <main className="flex-1 overflow-y-auto bg-background">
        {children}
      </main>

      {/* Search Command Palette */}
      <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
        <CommandInput placeholder="Search mock tests..." />
        <CommandList>
          <CommandEmpty>No mock tests found.</CommandEmpty>
          <CommandGroup heading="Mock Tests">
            {interviews.map((i) => (
              <CommandItem
                key={i.id}
                onSelect={() => {
                  navigate(`/interview/${i.id}/report`);
                  setSearchOpen(false);
                }}
              >
                <FileText className="mr-2 h-4 w-4" />
                <span>{(i.countries as any)?.name} — {(i.visa_types as any)?.name}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {new Date(i.created_at).toLocaleDateString()}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      {/* Create Mock Test Modal */}
      <CreateInterviewModal open={createOpen} onOpenChange={setCreateOpen} />

      {/* Pricing Modal */}
      <PricingModal open={pricingOpen} onOpenChange={setPricingOpen} />
    </div>
  );
}
