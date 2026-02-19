import { useState, useEffect, useCallback } from "react";
import AppSidebar from "./AppSidebar";
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import CreateInterviewModal from "@/components/interview/CreateInterviewModal";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { FileText } from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
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
      <AppSidebar onSearchOpen={() => setSearchOpen(true)} onCreateInterview={() => setCreateOpen(true)} />
      <main className="flex-1 overflow-y-auto bg-background">
        {children}
      </main>

      {/* Search Command Palette */}
      <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
        <CommandInput placeholder="Search interviews..." />
        <CommandList>
          <CommandEmpty>No interviews found.</CommandEmpty>
          <CommandGroup heading="Interviews">
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

      {/* Create Interview Modal */}
      <CreateInterviewModal open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
