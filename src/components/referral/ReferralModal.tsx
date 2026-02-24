import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check, Gift, Users, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";

interface ReferralModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ReferralContent({ code, loading, usedCount, onCopy, copied }: {
  code: string | null;
  loading: boolean;
  usedCount: number;
  onCopy: () => void;
  copied: boolean;
}) {
  const referralLink = code ? `${window.location.origin}/signup?ref=${code}` : "";

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Your referral link</label>
        <div className="flex gap-2">
          <Input value={loading ? "Loading..." : referralLink} readOnly className="text-sm" />
          <Button size="icon" variant="outline" onClick={onCopy} disabled={!code}>
            {copied ? <Check className="h-4 w-4 text-green-900" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className="bg-muted/50 rounded-lg p-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span>Referrals used</span>
        </div>
        <span className="text-sm font-bold">{usedCount}/3</span>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold">How it works</p>
        <ul className="text-sm text-muted-foreground space-y-1.5">
          <li className="flex items-start gap-2">
            <Gift className="h-3.5 w-3.5 mt-0.5 text-accent shrink-0" />
            When someone signs up using your link, you earn 10 credits
          </li>
          <li className="flex items-start gap-2">
            <Users className="h-3.5 w-3.5 mt-0.5 text-accent shrink-0" />
            You can earn referral credits up to 3 times
          </li>
        </ul>
      </div>
    </div>
  );
}

export default function ReferralModal({ open, onOpenChange }: ReferralModalProps) {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [code, setCode] = useState<string | null>(null);
  const [usedCount, setUsedCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && user) fetchOrCreateCode();
  }, [open, user]);

  async function fetchOrCreateCode() {
    if (!user) return;
    setLoading(true);

    const { data: existing } = await supabase
      .from("referral_codes")
      .select("code")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      setCode(existing.code);
    } else {
      const newCode = user.id.slice(0, 8);
      const { error } = await supabase.from("referral_codes").insert({ user_id: user.id, code: newCode });
      if (!error) setCode(newCode);
      else toast.error("Failed to generate referral code");
    }

    const { count } = await supabase
      .from("referrals")
      .select("*", { count: "exact", head: true })
      .eq("referrer_id", user.id)
      .eq("credits_awarded", true);

    setUsedCount(count ?? 0);
    setLoading(false);
  }

  const referralLink = code ? `${window.location.origin}/signup?ref=${code}` : "";

  function handleCopy() {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success("Link copied!");
    setTimeout(() => setCopied(false), 2000);
  }

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader className="text-left">
            <DrawerTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-accent" /> Refer & Earn Credits
            </DrawerTitle>
            <DrawerDescription></DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-6">
            <ReferralContent code={code} loading={loading} usedCount={usedCount} onCopy={handleCopy} copied={copied} />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-accent" /> Refer & Earn Credits
          </DialogTitle>
          <DialogDescription>Share your link and earn free credits</DialogDescription>
        </DialogHeader>
        <ReferralContent code={code} loading={loading} usedCount={usedCount} onCopy={handleCopy} copied={copied} />
      </DialogContent>
    </Dialog>
  );
}
