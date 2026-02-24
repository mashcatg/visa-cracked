import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Search, Plus, FileText, Shield, LogOut, Coins, PanelLeftClose, PanelLeft, Menu, MoreVertical, Share2, Pencil, Trash2, ChevronRight, Sun, Moon, User, Lock, Gift, Receipt } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import sidebarLogo from "@/assets/sidebar-logo.png";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "next-themes";
import ReferralModal from "@/components/referral/ReferralModal";

interface AppSidebarProps {
  onSearchOpen: () => void;
  onCreateInterview: () => void;
  onPricingOpen: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

function SidebarInner({ onSearchOpen, onCreateInterview, onPricingOpen, collapsed, onToggleCollapse, onClose }: AppSidebarProps & { onClose?: () => void }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [recentInterviews, setRecentInterviews] = useState<any[]>([]);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [credits, setCredits] = useState<number>(0);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [changePassOpen, setChangePassOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passSaving, setPassSaving] = useState(false);
  const [transactionsOpen, setTransactionsOpen] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchInterviews();
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

  function fetchInterviews() {
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
  }

  async function handleShare(interviewId: string) {
    await supabase.from("interviews").update({ is_public: true }).eq("id", interviewId);
    const url = `${window.location.origin}/mock/${interviewId}/public`;
    navigator.clipboard.writeText(url);
    toast.success("Public link copied to clipboard!");
  }

  async function handleRename() {
    if (!renameId || !renameName.trim()) return;
    await supabase.from("interviews").update({ name: renameName.trim() }).eq("id", renameId);
    setRenameId(null);
    fetchInterviews();
    toast.success("Renamed!");
  }

  async function handleDelete() {
    if (!deleteId) return;
    await supabase.from("interviews").delete().eq("id", deleteId);
    setDeleteId(null);
    fetchInterviews();
    toast.success("Deleted!");
    if (pathname.includes(deleteId)) navigate("/dashboard");
  }

  async function handleEditProfile() {
    if (!user || !editName.trim()) return;
    setEditSaving(true);
    const { error } = await supabase.from("profiles").update({ full_name: editName.trim() }).eq("user_id", user.id);
    setEditSaving(false);
    if (error) { toast.error("Failed to update profile"); return; }
    setProfileName(editName.trim());
    setEditProfileOpen(false);
    toast.success("Profile updated!");
  }

  async function loadTransactions() {
    if (!user) return;
    setTransactionsLoading(true);
    const { data } = await supabase
      .from("orders")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setTransactions(data || []);
    setTransactionsLoading(false);
  }

  function downloadInvoice(order: any) {
    const lines = [
      "=== VISA CRACKED - INVOICE ===",
      "",
      `Transaction ID: ${order.tran_id}`,
      `Date: ${new Date(order.created_at).toLocaleDateString()}`,
      `Plan: ${order.plan_name}`,
      `Credits: ${order.credits}`,
      `Amount: ${order.currency === "USD" ? "$" : "৳"}${order.amount}`,
      `Currency: ${order.currency}`,
      `Status: ${order.status.toUpperCase()}`,
      "",
      "Thank you for your purchase!",
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoice-${order.tran_id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleChangePassword() {
    if (newPassword.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    if (newPassword !== confirmPassword) { toast.error("Passwords don't match"); return; }
    setPassSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPassSaving(false);
    if (error) { toast.error(error.message); return; }
    setChangePassOpen(false);
    setNewPassword("");
    setConfirmPassword("");
    toast.success("Password changed!");
  }

  const displayName = profileName || user?.email || "User";
  const initials = profileName
    ? profileName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? "U";

  const handleAction = (fn: () => void) => { fn(); onClose?.(); };

  return (
    <aside className={cn(
      "flex h-screen flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300",
      collapsed ? "w-16" : "w-64"
    )}>
      <div className="flex items-center gap-2 px-3 py-5 border-b border-sidebar-border">
        {!collapsed && <img src={sidebarLogo} alt="Visa Cracked" className="h-8 ml-3" />}
        {!onClose && (
          <button onClick={onToggleCollapse} className="ml-auto text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors p-1 rounded-lg hover:bg-sidebar-accent/50">
            {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-4 space-y-1">
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Link to="/dashboard" onClick={onClose} className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              collapsed && "justify-center px-0",
              pathname === "/dashboard" ? "bg-sidebar-accent text-sidebar-primary" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            )}>
              <LayoutDashboard className="h-4 w-4 shrink-0" />
              {!collapsed && "Dashboard"}
            </Link>
          </TooltipTrigger>
          {collapsed && <TooltipContent side="right">Dashboard</TooltipContent>}
        </Tooltip>

        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button onClick={() => handleAction(onSearchOpen)} className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors",
              collapsed && "justify-center px-0"
            )}>
              <Search className="h-4 w-4 shrink-0" />
              {!collapsed && <>Search<kbd className="ml-auto text-[10px] bg-sidebar-accent/50 px-1.5 py-0.5 rounded font-mono">⌘K</kbd></>}
            </button>
          </TooltipTrigger>
          {collapsed && <TooltipContent side="right">Search (⌘K)</TooltipContent>}
        </Tooltip>

        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Button onClick={() => handleAction(onCreateInterview)} className={cn(
              "w-full mt-3 bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 font-semibold",
              collapsed && "px-0"
            )} size={collapsed ? "icon" : "default"}>
              <Plus className={cn("h-4 w-4", !collapsed && "mr-2")} />
              {!collapsed && "Create Mock Test"}
            </Button>
          </TooltipTrigger>
          {collapsed && <TooltipContent side="right">Create Mock Test</TooltipContent>}
        </Tooltip>

        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button onClick={() => handleAction(onPricingOpen)} className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 mt-2 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors",
              collapsed && "justify-center px-0"
            )}>
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

        {/* Recent Mocks with 3-dot menu */}
        {!collapsed && recentInterviews.length > 0 && (
          <div className="mt-6">
            <p className="px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/40 mb-2">Recent Mocks</p>
            {recentInterviews.map((interview) => (
              <div key={interview.id} className="group relative flex items-center min-w-0">
                <Link
                  to={`/interview/${interview.id}/report`}
                  onClick={onClose}
                  className={cn(
                    "flex-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors min-w-0 pr-8",
                    pathname === `/interview/${interview.id}/report`
                      ? "bg-sidebar-accent/50 text-sidebar-foreground"
                      : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate block max-w-[calc(100%-2rem)]">{interview.name || `${(interview.countries as any)?.flag_emoji || ''} ${(interview.visa_types as any)?.name || 'Mock'}`}</span>
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-sidebar-accent/80">
                      <MoreVertical className="h-3.5 w-3.5 text-sidebar-foreground/50" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-36">
                    <DropdownMenuItem onClick={() => handleShare(interview.id)}>
                      <Share2 className="h-3.5 w-3.5 mr-2" /> Share
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setRenameId(interview.id); setRenameName(interview.name || ""); }}>
                      <Pencil className="h-3.5 w-3.5 mr-2" /> Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setDeleteId(interview.id)} className="text-destructive focus:text-destructive">
                      <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        )}

        {isAdmin && (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Link to="/admin" onClick={onClose} className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors mt-4",
                collapsed && "justify-center px-0",
                pathname.startsWith("/admin") ? "bg-sidebar-accent text-sidebar-primary" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}>
                <Shield className="h-4 w-4 shrink-0" />
                {!collapsed && "Admin Panel"}
              </Link>
            </TooltipTrigger>
            {collapsed && <TooltipContent side="right">Admin Panel</TooltipContent>}
          </Tooltip>
        )}
      </nav>

      <div className="border-t border-sidebar-border p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn("flex items-center gap-3 px-2 py-2 w-full rounded-lg hover:bg-sidebar-accent/50 transition-colors", collapsed && "justify-center")}>
              <div className="h-8 w-8 rounded-full bg-sidebar-primary/20 flex items-center justify-center text-sidebar-primary text-xs font-bold shrink-0">
                {initials}
              </div>
              {!collapsed && (
                <>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium truncate">{displayName}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-sidebar-foreground/50 shrink-0" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" sideOffset={8} className="w-64 mb-1 bg-popover z-[100]">
            <DropdownMenuLabel className="pb-0">
              <p className="text-sm font-semibold truncate">{displayName}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="px-2 py-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Credits</span>
                <span className="text-xs font-semibold">{credits}</span>
              </div>
              <Progress value={Math.min(credits, 100)} className="h-1.5" />
            </div>
            <div className="px-2 py-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider bg-accent/10 text-accent px-2 py-0.5 rounded-full">
                {credits >= 400 ? "Premium" : credits >= 200 ? "Pro" : credits >= 100 ? "Starter" : "Free Plan"}
              </span>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => { setEditName(profileName || ""); setEditProfileOpen(true); }} className="cursor-pointer">
              <User className="h-3.5 w-3.5 mr-2" /> Edit Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setNewPassword(""); setConfirmPassword(""); setChangePassOpen(true); }} className="cursor-pointer">
              <Lock className="h-3.5 w-3.5 mr-2" /> Change Password
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { loadTransactions(); setTransactionsOpen(true); }} className="cursor-pointer">
              <Receipt className="h-3.5 w-3.5 mr-2" /> Transactions
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <div className="px-2 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                {theme === "dark" ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
                <span>Dark Mode</span>
              </div>
              <Switch checked={theme === "dark"} onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")} className="scale-90" />
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive cursor-pointer">
              <LogOut className="h-3.5 w-3.5 mr-2" /> Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Rename Dialog */}
      <Dialog open={!!renameId} onOpenChange={(o) => !o && setRenameId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Rename Mock Test</DialogTitle></DialogHeader>
          <Input value={renameName} onChange={(e) => setRenameName(e.target.value)} placeholder="Mock test name" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameId(null)}>Cancel</Button>
            <Button onClick={handleRename}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Mock Test?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this mock test and its report.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Profile Dialog */}
      <Dialog open={editProfileOpen} onOpenChange={setEditProfileOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Edit Profile</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Full Name</label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Your name" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditProfileOpen(false)}>Cancel</Button>
            <Button onClick={handleEditProfile} disabled={editSaving}>{editSaving ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={changePassOpen} onOpenChange={setChangePassOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Change Password</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">New Password</label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 6 characters" />
            </div>
            <div>
              <label className="text-sm font-medium">Confirm Password</label>
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat password" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangePassOpen(false)}>Cancel</Button>
            <Button onClick={handleChangePassword} disabled={passSaving}>{passSaving ? "Saving..." : "Change Password"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transactions Dialog */}
      <Dialog open={transactionsOpen} onOpenChange={setTransactionsOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Your Transactions</DialogTitle></DialogHeader>
          {transactionsLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : transactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No transactions yet</p>
          ) : (
            <div className="space-y-3">
              {transactions.map((o: any) => (
                <div key={o.id} className="flex items-center justify-between border rounded-lg p-3">
                  <div>
                    <p className="text-sm font-medium">{o.plan_name} Pack</p>
                    <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-semibold">{o.currency === "USD" ? "$" : "৳"}{o.amount}</p>
                      <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full ${o.status === "paid" ? "bg-emerald-500/10 text-emerald-600" : o.status === "pending" ? "bg-yellow-500/10 text-yellow-600" : "bg-destructive/10 text-destructive"}`}>
                        {o.status}
                      </span>
                    </div>
                    {o.status === "paid" && (
                      <Button size="icon" variant="ghost" onClick={() => downloadInvoice(o)} title="Download Invoice">
                        <Receipt className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </aside>
  );
}

export default function AppSidebar(props: AppSidebarProps) {
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [referralOpen, setReferralOpen] = useState(false);
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [mobileProfile, setMobileProfile] = useState<{ name: string | null; credits: number }>({ name: null, credits: 0 });

  useEffect(() => {
    if (!isMobile || !user) return;
    supabase.from("profiles").select("full_name, credits").eq("user_id", user.id).single().then(({ data }) => {
      if (data) setMobileProfile({ name: data.full_name, credits: data.credits ?? 0 });
    });
  }, [isMobile, user]);

  if (isMobile) {
    const initials = mobileProfile.name
      ? mobileProfile.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
      : user?.email?.[0]?.toUpperCase() ?? "U";

    return (
      <>
        {/* Fixed top bar */}
        <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 bg-background/95 backdrop-blur-sm border-b border-border">
          {/* Left: hamburger */}
          <button onClick={() => setMobileOpen(true)} className="bg-primary text-primary-foreground p-2 rounded-lg">
            <Menu className="h-5 w-5" />
          </button>

          {/* Right: Refer + Avatar */}
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setReferralOpen(true)} className="gap-1.5">
              <Gift className="h-4 w-4" /> Refer
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
                  {initials}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 z-[100]">
                <DropdownMenuLabel className="pb-0">
                  <p className="text-sm font-semibold truncate">{mobileProfile.name || user?.email || "User"}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="px-2 py-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">Credits</span>
                    <span className="text-xs font-semibold">{mobileProfile.credits}</span>
                  </div>
                  <Progress value={Math.min(mobileProfile.credits, 100)} className="h-1.5" />
                </div>
                <div className="px-2 py-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider bg-accent/10 text-accent px-2 py-0.5 rounded-full">
                    {mobileProfile.credits >= 400 ? "Premium" : mobileProfile.credits >= 200 ? "Pro" : mobileProfile.credits >= 100 ? "Starter" : "Free Plan"}
                  </span>
                </div>
                <DropdownMenuSeparator />
                <div className="px-2 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    {theme === "dark" ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
                    <span>Dark Mode</span>
                  </div>
                  <Switch checked={theme === "dark"} onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")} className="scale-90" />
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive cursor-pointer">
                  <LogOut className="h-3.5 w-3.5 mr-2" /> Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="p-0 w-64 border-0">
            <SidebarInner {...props} collapsed={false} onClose={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>

        <ReferralModal open={referralOpen} onOpenChange={setReferralOpen} />
      </>
    );
  }

  return <SidebarInner {...props} onClose={undefined} />;
}
