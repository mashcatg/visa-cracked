import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const plans = [
  {
    name: "Starter",
    subtitle: "For beginners",
    mocks: 10,
    credits: 100,
    price: "800",
    currency: "TK",
    badge: null,
    popular: false,
    features: [
      "10 Mock Tests",
      "100 Credits",
      "AI-Powered Analysis",
      "Detailed Score Reports",
      "Grammar Correction",
    ],
  },
  {
    name: "Pro",
    subtitle: "For serious prep",
    mocks: 20,
    credits: 200,
    price: "1,500",
    currency: "TK",
    badge: "Best Value",
    popular: true,
    features: [
      "20 Mock Tests",
      "200 Credits",
      "AI-Powered Analysis",
      "Detailed Score Reports",
      "Grammar Correction",
      "Red Flag Detection",
      "Improvement Plans",
    ],
  },
  {
    name: "Premium",
    subtitle: "Maximum preparation",
    mocks: 40,
    credits: 400,
    price: "2,800",
    currency: "TK",
    badge: "Popular",
    popular: false,
    features: [
      "40 Mock Tests",
      "400 Credits",
      "AI-Powered Analysis",
      "Detailed Score Reports",
      "Grammar Correction",
      "Red Flag Detection",
      "Improvement Plans",
      "Priority Support",
    ],
  },
];

function PricingContent() {
  return (
    <div className="grid gap-4 md:grid-cols-3 py-4">
      {plans.map((plan) => (
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
            <span className="text-4xl font-extrabold tracking-tight">{plan.price}</span>
            <span className="text-sm text-muted-foreground ml-1">{plan.currency}</span>
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
              plan.popular
                ? "bg-accent text-accent-foreground hover:bg-accent/90"
                : ""
            )}
            variant={plan.popular ? "default" : "outline"}
          >
            Get {plan.name}
          </Button>
        </div>
      ))}
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
            <PricingContent />
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
        <PricingContent />
      </DialogContent>
    </Dialog>
  );
}
