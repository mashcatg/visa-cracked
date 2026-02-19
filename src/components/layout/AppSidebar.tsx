import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Search, Plus, FileText, Settings, Shield, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo-alt.png";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

interface AppSidebarProps {
  onSearchOpen: () => void;
  onCreateInterview: () => void;
}

export default function AppSidebar({ onSearchOpen, onCreateInterview }: AppSidebarProps) {
  const { pathname } = useLocation();
  const { user, isAdmin, signOut } = useAuth();
  const [recentInterviews, setRecentInterviews] = useState<Tables<"interviews">[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("interviews")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => {
        if (data) setRecentInterviews(data);
      });
  }, [user]);

  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  ];

  return (
    <aside className="flex h-screen w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      {/* Logo */}
      <div className="flex items-center gap-2 px-6 py-5 border-b border-sidebar-border">
        <img src={logo} alt="VisaCracker" className="h-8" />
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              pathname === item.href
                ? "bg-sidebar-accent text-sidebar-primary"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}

        {/* Search */}
        <button
          onClick={onSearchOpen}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
        >
          <Search className="h-4 w-4" />
          Search
          <kbd className="ml-auto text-[10px] bg-sidebar-accent/50 px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
        </button>

        {/* Create Interview */}
        <Button
          onClick={onCreateInterview}
          className="w-full mt-3 bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 font-semibold"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Interview
        </Button>

        {/* Recent Interviews */}
        {recentInterviews.length > 0 && (
          <div className="mt-6">
            <p className="px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/40 mb-2">Recent Interviews</p>
            {recentInterviews.map((interview) => (
              <Link
                key={interview.id}
                to={`/interview/${interview.id}/report`}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
              >
                <FileText className="h-3.5 w-3.5" />
                <span className="truncate">{new Date(interview.created_at).toLocaleDateString()}</span>
              </Link>
            ))}
          </div>
        )}

        {/* Admin Link */}
        {isAdmin && (
          <Link
            to="/admin"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors mt-4",
              pathname.startsWith("/admin")
                ? "bg-sidebar-accent text-sidebar-primary"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            )}
          >
            <Shield className="h-4 w-4" />
            Admin Panel
          </Link>
        )}
      </nav>

      {/* User & Logout */}
      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="h-8 w-8 rounded-full bg-sidebar-primary/20 flex items-center justify-center text-sidebar-primary text-sm font-bold">
            {user?.email?.[0]?.toUpperCase() ?? "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.email}</p>
          </div>
          <button onClick={signOut} className="text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
