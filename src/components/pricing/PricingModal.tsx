import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Loader2, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface PlanDef {
  name: string;
  subtitle: string;
  mocks: number;
  credits: number;
  bdt: number;
  usd: number;
  badge: string | null;
  popular: boolean;
  features: string[];
}

const plans: PlanDef[] = [
  {
    name: "Starter",
    subtitle: "For beginners",
    mocks: 10,
    credits: 100,
    bdt: 800,
    usd: 8,
    badge: null,
    popular: false,
    features: ["100 Credits", "AI-Powered Analysis", "Detailed Score Reports", "Email Support"],
  },
  {
    name: "Pro",
    subtitle: "For serious prep",
    mocks: 20,
    credits: 200,
    bdt: 1500,
    usd: 15,
    badge: "Best Value",
    popular: true,
    features: ["200 Credits", "AI-Powered Analysis", "Detailed Score Reports", "Priority Support"],
  },
  {
    name: "Premium",
    subtitle: "Maximum preparation",
    mocks: 40,
    credits: 400,
    bdt: 2800,
    usd: 28,
    badge: "Popular",
    popular: false,
    features: ["400 Credits", "AI-Powered Analysis", "Detailed Score Reports", "24/7 Support"],
  },
];

function formatPrice(amount: number) {
  return amount.toLocaleString();
}

function applyDiscount(amount: number, discountType: string, discountAmount: number): number {
  if (discountType === "percentage") {
    return Math.round(amount * (1 - discountAmount / 100));
  }
  return Math.max(0, Math.round(amount - discountAmount));
}

function PricingContent({ isMobile }: { isMobile: boolean }) {
  const { session } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [currency, setCurrency] = useState<"BDT" | "USD">("BDT");
  const [couponInput, setCouponInput] = useState("");
  const [showCoupon, setShowCoupon] = useState(false);
  const [couponLoading, setCouponLoading] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount_type: string; discount_amount: number } | null>(null);

  // Detect country via IP
  useEffect(() => {
    fetch("https://ipapi.co/json/")
      .then(r => r.json())
      .then(data => {
        if (!data?.country_code) return;
        setCurrency(data.country_code === "BD" ? "BDT" : "USD");
      })
      .catch(() => {}); // Default BDT on error
  }, []);

  async function handleApplyCoupon() {
    if (!couponInput.trim()) return;
    if (!session) { toast.error("Please log in first"); return; }
    setCouponLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("validate-coupon", {
        body: { coupon_code: couponInput.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.valid) {
        setAppliedCoupon({ code: data.code, discount_type: data.discount_type, discount_amount: data.discount_amount });
        toast.success(`Coupon "${data.code}" applied!`);
      }
    } catch (err: any) {
      toast.error(err.message || "Invalid coupon");
      setAppliedCoupon(null);
    }
    setCouponLoading(false);
  }

  function removeCoupon() {
    setAppliedCoupon(null);
    setCouponInput("");
  }

  const handlePurchase = async (planName: string) => {
    if (!session) { toast.error("Please log in to purchase a plan"); return; }
    setLoading(planName);
    try {
      const { data, error } = await supabase.functions.invoke("initiate-payment", {
        body: {
          plan_name: planName,
          currency,
          ...(appliedCoupon ? { coupon_code: appliedCoupon.code } : {}),
        },
      });
      if (error) throw error;
      if (data?.GatewayPageURL) {
        window.location.href = data.GatewayPageURL;
      } else {
        throw new Error(data?.error || "Failed to initiate payment");
      }
    } catch (err: any) {
      toast.error(err.message || "Payment initiation failed");
      setLoading(null);
    }
  };

  const currencySymbol = currency === "USD" ? "$" : "৳";

  return (
    <div className="space-y-4 py-4">
      {/* Currency Switcher - Switch */}
      <div className="flex items-center justify-between gap-4 bg-muted/30 rounded-lg p-3">
        <div className="flex items-center justify-center gap-3 flex-1">
          <span className={cn("text-sm font-medium transition-colors", currency === "BDT" ? "text-foreground" : "text-muted-foreground")}>BDT</span>
          <Switch 
            checked={currency === "USD"} 
            onCheckedChange={(checked) => setCurrency(checked ? "USD" : "BDT")}
            className="data-[state=checked]:bg-accent"
          />
          <span className={cn("text-sm font-medium transition-colors", currency === "USD" ? "text-foreground" : "text-muted-foreground")}>USD</span>
        </div>
      </div>

      {/* Coupon Section on Mobile (at top) */}
      {isMobile && (
        <div className="text-center">
          {!showCoupon && !appliedCoupon && (
            <button
              onClick={() => setShowCoupon(true)}
              className="text-sm hover:underline inline-flex items-center gap-1"
            >
              <Tag className="h-3.5 w-3.5" /> Have a coupon?
            </button>
          )}
          {showCoupon && !appliedCoupon && (
            <div className="flex items-center gap-2 max-w-xs mx-auto">
              <Input
                placeholder="Enter coupon code"
                value={couponInput}
                onChange={e => setCouponInput(e.target.value)}
                className="uppercase"
                onKeyDown={e => e.key === "Enter" && handleApplyCoupon()}
              />
              <Button size="sm" onClick={handleApplyCoupon} disabled={couponLoading} className="bg-accent text-accent-foreground hover:bg-accent/90">
                {couponLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
              </Button>
            </div>
          )}
          {appliedCoupon && (
            <div className="inline-flex items-center gap-2 text-sm bg-accent/10 text-accent-foreground px-3 py-1.5 rounded-full">
              <Tag className="h-3.5 w-3.5" />
              <span className="font-semibold">{appliedCoupon.code}</span>
              <span>—</span>
              <span>{appliedCoupon.discount_type === "percentage" ? `${appliedCoupon.discount_amount}% off` : `${currencySymbol}${appliedCoupon.discount_amount} off`}</span>
              <button onClick={removeCoupon} className="ml-1 text-muted-foreground hover:text-foreground">✕</button>
            </div>
          )}
        </div>
      )}

      {/* Plan Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => {
          const basePrice = currency === "USD" ? plan.usd : plan.bdt;
          const finalPrice = appliedCoupon
            ? applyDiscount(basePrice, appliedCoupon.discount_type, appliedCoupon.discount_type === "fixed" && currency === "USD" ? Math.round(appliedCoupon.discount_amount * (plan.usd / plan.bdt)) : appliedCoupon.discount_amount)
            : basePrice;
          const hasDiscount = appliedCoupon && finalPrice < basePrice;

          return (
            <div
              key={plan.name}
              className={cn(
                "relative rounded-2xl border p-6 flex flex-col",
                plan.popular
                  ? "border-accent shadow-lg shadow-accent/10 ring-2 ring-accent"
                  : "border-border"
              )}
            >
              {plan.badge && (
                <div className={cn(
                  "absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-1 rounded-full",
                  plan.popular
                    ? "bg-accent text-accent-foreground"
                    : "bg-muted text-muted-foreground"
                )}>
                  {plan.badge}
                </div>
              )}
              <h3 className="font-bold text-lg">{plan.name}</h3>
              <p className="text-xs text-muted-foreground mb-4">{plan.subtitle}</p>
              <div className="mb-1">
                {hasDiscount && (
                  <span className="text-xl line-through text-muted-foreground mr-2">{currencySymbol}{formatPrice(basePrice)}</span>
                )}
                <span className="text-3xl font-extrabold tracking-tight">{currencySymbol}{formatPrice(finalPrice)}</span>
              </div>
              <p className="text-xs text-muted-foreground mb-5">/pack</p>
              <ul className="space-y-2.5 flex-1 mb-6">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2.5 text-sm">
                    <div className="h-4 w-4 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                      <Check className="h-2.5 w-2.5 text-emerald-600" />
                    </div>
                    {feature}
                  </li>
                ))}
              </ul>
              <Button
                className={cn(
                  "w-full font-semibold",
                  plan.popular ? "bg-accent text-accent-foreground hover:bg-accent/90" : ""
                )}
                variant={plan.popular ? "default" : "outline"}
                disabled={loading !== null}
                onClick={() => handlePurchase(plan.name)}
              >
                {loading === plan.name ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</>
                ) : (
                  `Get ${plan.name}`
                )}
              </Button>
            </div>
          );
        })}
      </div>

      {/* Coupon Section on Desktop (at bottom) */}
      {!isMobile && (
        <div className="text-center pt-4">
          {!showCoupon && !appliedCoupon && (
            <button
              onClick={() => setShowCoupon(true)}
              className="text-sm hover:underline inline-flex items-center gap-1"
            >
              <Tag className="h-3.5 w-3.5" /> Have a coupon?
            </button>
          )}
          {showCoupon && !appliedCoupon && (
            <div className="flex items-center gap-2 max-w-xs mx-auto">
              <Input
                placeholder="Enter coupon code"
                value={couponInput}
                onChange={e => setCouponInput(e.target.value)}
                className="uppercase"
                onKeyDown={e => e.key === "Enter" && handleApplyCoupon()}
              />
              <Button size="sm" onClick={handleApplyCoupon} disabled={couponLoading} className="bg-accent text-accent-foreground hover:bg-accent/90">
                {couponLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
              </Button>
            </div>
          )}
          {appliedCoupon && (
            <div className="inline-flex items-center gap-2 text-sm bg-accent/10 text-accent-foreground px-3 py-1.5 rounded-full">
              <Tag className="h-3.5 w-3.5" />
              <span className="font-semibold">{appliedCoupon.code}</span>
              <span>—</span>
              <span>{appliedCoupon.discount_type === "percentage" ? `${appliedCoupon.discount_amount}% off` : `${currencySymbol}${appliedCoupon.discount_amount} off`}</span>
              <button onClick={removeCoupon} className="ml-1 text-muted-foreground hover:text-foreground">✕</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PricingModal({ open, onOpenChange }: Props) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="text-center">
            <DrawerTitle className="text-2xl">Upgrade Your Plan</DrawerTitle>
            <DrawerDescription>Choose the plan that fits your needs</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-6 overflow-y-auto">
            <PricingContent isMobile={true} />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader className="text-center">
          <DialogTitle className="text-2xl">Upgrade Your Plan</DialogTitle>
          <DialogDescription>Choose the plan that fits your preparation needs</DialogDescription>
        </DialogHeader>
        <PricingContent isMobile={false} />
      </DialogContent>
    </Dialog>
  );
}
