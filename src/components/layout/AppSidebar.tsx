import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Search, Plus, FileText, Shield, LogOut, Coins, PanelLeftClose, PanelLeft, Menu } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import sidebarLogo from "@/assets/sidebar-logo.png";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface AppSidebarProps {
  onSearchOpen: () => void;
  onCreateInterview: () => void;
  onPricingOpen: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

function SidebarInner({ onSearchOpen, onCreateInterview, onPricingOpen, collapsed, onToggleCollapse, onClose }: AppSidebarProps & { onClose?: () => void }) {
  const { pathname } = useLocation();
  const { user, isAdmin, signOut } = useAuth();
  const [recentInterviews, setRecentInterviews] = useState<any[]>([]);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [credits, setCredits] = useState<number>(0);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("interviews")
      .select("*, countries(name, flag_emoji), visa_types(name)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => {
        if (data) setRecentInterviews(data);
      });

    supabase
      .from("profiles")
      .select("full_name, credits")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          if (data.full_name) setProfileName(data.full_name);
          setCredits(data.credits ?? 0);
        }
      });
  }, [user]);

  const displayName = profileName || user?.email || "User";
  const initials = profileName
    ? profileName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? "U";

  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  ];

  const handleAction = (fn: () => void) => {
    fn();
    onClose?.();
  };

  return (
    <aside className={cn(
      "flex h-screen flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300",
      collapsed ? "w-16" : "w-64"
    )}>
      {/* Logo + Collapse toggle */}
      <div className="flex items-center gap-2 px-3 py-5 border-b border-sidebar-border">
        {!collapsed && <img src={sidebarLogo} alt="VisaCracker" className="h-8 ml-3" />}
        <button
          onClick={onToggleCollapse}
          className="ml-auto text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors p-1 rounded-lg hover:bg-sidebar-accent/50"
        >
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-1">
        {navItems.map((item) => (
          <Tooltip key={item.href} delayDuration={0}>
            <TooltipTrigger asChild>
              <Link
                to={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  collapsed && "justify-center px-0",
                  pathname === item.href
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && item.label}
              </Link>
            </TooltipTrigger>
            {collapsed && <TooltipContent side="right">{item.label}</TooltipContent>}
          </Tooltip>
        ))}

        {/* Search */}
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              onClick={() => handleAction(onSearchOpen)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors",
                collapsed && "justify-center px-0"
              )}
            >
              <Search className="h-4 w-4 shrink-0" />
              {!collapsed && <>Search<kbd className="ml-auto text-[10px] bg-sidebar-accent/50 px-1.5 py-0.5 rounded font-mono">⌘K</kbd></>}
            </button>
          </TooltipTrigger>
          {collapsed && <TooltipContent side="right">Search (⌘K)</TooltipContent>}
        </Tooltip>

        {/* Create Mock Test */}
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Button
              onClick={() => handleAction(onCreateInterview)}
              className={cn(
                "w-full mt-3 bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 font-semibold",
                collapsed && "px-0"
              )}
              size={collapsed ? "icon" : "default"}
            >
              <Plus className={cn("h-4 w-4", !collapsed && "mr-2")} />
              {!collapsed && "Create Mock Test"}
            </Button>
          </TooltipTrigger>
          {collapsed && <TooltipContent side="right">Create Mock Test</TooltipContent>}
        </Tooltip>

        {/* Credits */}
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              onClick={() => handleAction(onPricingOpen)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 mt-2 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors",
                collapsed && "justify-center px-0"
              )}
            >
              <Coins className="h-4 w-4 text-sidebar-primary shrink-0" />
              {!collapsed && (
                <>
                  <span>{credits} Credits</span>
                  <span className="ml-auto text-[10px] bg-sidebar-primary/20 text-sidebar-primary px-2 py-0.5 rounded-full font-semibold">Buy</span>
                </>
              )}
            </button>
          </TooltipTrigger>
          {collapsed && <TooltipContent side="right">{credits} Credits</TooltipContent>}
        </Tooltip>

        {/* Recent Mock Tests */}
        {!collapsed && recentInterviews.length > 0 && (
          <div className="mt-6">
            <p className="px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/40 mb-2">Recent Mocks</p>
            {recentInterviews.map((interview) => (
              <Link
                key={interview.id}
                to={`/interview/${interview.id}/report`}
                onClick={onClose}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
              >
                <FileText className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{interview.name || `${(interview.countries as any)?.flag_emoji || ''} ${(interview.visa_types as any)?.name || 'Mock'}`}</span>
              </Link>
            ))}
          </div>
        )}

        {/* Admin Link */}
        {isAdmin && (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Link
                to="/admin"
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors mt-4",
                  collapsed && "justify-center px-0",
                  pathname.startsWith("/admin")
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <Shield className="h-4 w-4 shrink-0" />
                {!collapsed && "Admin Panel"}
              </Link>
            </TooltipTrigger>
            {collapsed && <TooltipContent side="right">Admin Panel</TooltipContent>}
          </Tooltip>
        )}
      </nav>

      {/* User & Logout */}
      <div className="border-t border-sidebar-border p-2">
        <div className={cn("flex items-center gap-3 px-2 py-2", collapsed && "justify-center")}>
          <div className="h-8 w-8 rounded-full bg-sidebar-primary/20 flex items-center justify-center text-sidebar-primary text-xs font-bold shrink-0">
            {initials}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{displayName}</p>
              </div>
              <button onClick={signOut} className="text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors">
                <LogOut className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}

export default function AppSidebar(props: AppSidebarProps) {
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (isMobile) {
    return (
      <>
        <button
          onClick={() => setMobileOpen(true)}
          className="fixed top-4 left-4 z-50 bg-primary text-primary-foreground p-2 rounded-lg shadow-lg"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="p-0 w-64 border-0">
            <SidebarInner {...props} collapsed={false} onClose={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return <SidebarInner {...props} onClose={undefined} />;
}
