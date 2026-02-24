import React, { useState, useEffect } from "react";
import AppSidebar from "./AppSidebar";
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import CreateInterviewModal from "@/components/interview/CreateInterviewModal";
import PricingModal from "@/components/pricing/PricingModal";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { FileText, Search } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [interviews, setInterviews] = useState<any[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileSearch, setMobileSearch] = useState("");
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMobile = useIsMobile();

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

  // URL query param listener for ?pricing=on
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("pricing") === "on") {
      setPricingOpen(true);
      // Clean URL by removing the query param
      window.history.replaceState({}, "", window.location.pathname);
    }
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

  const filteredInterviews = mobileSearch
    ? interviews.filter((i) => {
        const name = i.name || `${(i.countries as any)?.name} ${(i.visa_types as any)?.name}`;
        return name.toLowerCase().includes(mobileSearch.toLowerCase());
      })
    : interviews;

  return (
    <div className="flex h-screen overflow-hidden w-full">
      <AppSidebar
        onSearchOpen={() => setSearchOpen(true)}
        onCreateInterview={() => setCreateOpen(true)}
        onPricingOpen={() => setPricingOpen(true)}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
      />
      <main className={`flex-1 overflow-y-auto bg-background ${isMobile ? 'pt-16' : ''}`}>
        {typeof children === 'object' && children !== null
          ? React.Children.map(children, (child) =>
              React.isValidElement(child)
                ? React.cloneElement(child as React.ReactElement<any>, { onCreateInterview: () => setCreateOpen(true) })
                : child
            )
          : children}
      </main>

      {/* Search: Drawer on mobile, CommandDialog on desktop */}
      {isMobile ? (
        <Drawer open={searchOpen} onOpenChange={setSearchOpen}>
          <DrawerContent className="max-h-[80vh]">
            <DrawerHeader className="pb-2">
              <DrawerTitle className="text-base">Search Mock Tests</DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search mock tests..."
                  value={mobileSearch}
                  onChange={(e) => setMobileSearch(e.target.value)}
                  className="pl-9"
                  autoFocus
                />
              </div>
            </div>
            <div className="px-4 pb-4 overflow-y-auto max-h-[60vh] space-y-1.5">
              {filteredInterviews.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No mock tests found.</p>
              ) : (
                filteredInterviews.map((i) => (
                  <button
                    key={i.id}
                    onClick={() => {
                      navigate(`/interview/${i.id}/report`);
                      setSearchOpen(false);
                      setMobileSearch("");
                    }}
                    className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted transition-colors text-left"
                  >
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium truncate flex-1">
                      {i.name || `${(i.countries as any)?.name} — ${(i.visa_types as any)?.name}`}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {new Date(i.created_at).toLocaleDateString()}
                    </span>
                  </button>
                ))
              )}
            </div>
          </DrawerContent>
        </Drawer>
      ) : (
        <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
          <CommandInput placeholder="Search mock tests..." />
          <CommandList>
            <CommandEmpty>No mock tests found.</CommandEmpty>
            <CommandGroup heading="RECENT MOCKS" className="[&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-muted-foreground/60 [&_[cmdk-group-heading]]:font-semibold">
              {interviews.map((i) => (
                <CommandItem
                  key={i.id}
                  value={`${i.name || `${(i.countries as any)?.name} ${(i.visa_types as any)?.name}`} ${i.id}`}
                  onSelect={() => {
                    navigate(`/interview/${i.id}/report`);
                    setSearchOpen(false);
                  }}
                  className="flex items-center gap-3 py-2.5"
                >
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="flex-1 truncate">
                    {i.name || `${(i.countries as any)?.name} — ${(i.visa_types as any)?.name}`}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {new Date(i.created_at).toLocaleDateString()}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </CommandDialog>
      )}

      <CreateInterviewModal open={createOpen} onOpenChange={setCreateOpen} />
      <PricingModal open={pricingOpen} onOpenChange={setPricingOpen} />
    </div>
  );
}
