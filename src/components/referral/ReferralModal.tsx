import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check, Gift, Users, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

interface ReferralModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ReferralModal({ open, onOpenChange }: ReferralModalProps) {
  const { user } = useAuth();
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

    // Try to get existing code
    const { data: existing } = await supabase
      .from("referral_codes")
      .select("code")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      setCode(existing.code);
    } else {
      // Generate a short code
      const newCode = user.id.slice(0, 8);
      const { error } = await supabase.from("referral_codes").insert({ user_id: user.id, code: newCode });
      if (!error) setCode(newCode);
      else toast.error("Failed to generate referral code");
    }

    // Get successful referral count
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-accent" /> Refer & Earn Credits
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Referral link */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Your referral link</label>
            <div className="flex gap-2">
              <Input value={loading ? "Loading..." : referralLink} readOnly className="text-sm" />
              <Button size="icon" variant="outline" onClick={handleCopy} disabled={!code}>
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Usage */}
          <div className="bg-muted/50 rounded-lg p-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span>Referrals used</span>
            </div>
            <span className="text-sm font-bold">{usedCount}/3</span>
          </div>

          {/* Rules */}
          <div className="space-y-2">
            <p className="text-sm font-semibold">How it works</p>
            <ul className="text-sm text-muted-foreground space-y-1.5">
              <li className="flex items-start gap-2">
                <Gift className="h-3.5 w-3.5 mt-0.5 text-accent shrink-0" />
                Share your link — when someone signs up, you earn <strong className="text-foreground">10 credits</strong>
              </li>
              <li className="flex items-start gap-2">
                <Users className="h-3.5 w-3.5 mt-0.5 text-accent shrink-0" />
                You can earn referral credits up to <strong className="text-foreground">3 times</strong> (max 30 credits)
              </li>
              <li className="flex items-start gap-2">
                <ShieldCheck className="h-3.5 w-3.5 mt-0.5 text-accent shrink-0" />
                Anti-abuse: duplicate devices or IPs won't earn extra credits
              </li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
