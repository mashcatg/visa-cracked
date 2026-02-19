import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Check, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const plans = [
  {
    name: "Starter",
    mocks: 10,
    credits: 100,
    price: "800",
    currency: "TK",
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
    mocks: 20,
    credits: 200,
    price: "1,500",
    currency: "TK",
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
    mocks: 40,
    credits: 400,
    price: "2,800",
    currency: "TK",
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
            "relative rounded-xl border p-5 flex flex-col",
            plan.popular
              ? "border-accent shadow-lg shadow-accent/10 ring-1 ring-accent"
              : "border-border"
          )}
        >
          {plan.popular && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-accent-foreground text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
              <Zap className="h-3 w-3" /> Most Popular
            </div>
          )}
          <h3 className="font-semibold text-lg">{plan.name}</h3>
          <div className="mt-2 mb-4">
            <span className="text-3xl font-bold">{plan.price}</span>
            <span className="text-sm text-muted-foreground ml-1">{plan.currency}</span>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            {plan.mocks} mock tests · {plan.credits} credits
          </p>
          <ul className="space-y-2 flex-1 mb-5">
            {plan.features.map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-accent flex-shrink-0" />
                {feature}
              </li>
            ))}
          </ul>
          <Button
            className={cn(
              "w-full font-semibold",
              plan.popular
                ? "bg-accent text-accent-foreground hover:bg-accent/90"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
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
