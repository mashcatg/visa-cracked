import { useLocation, Link } from "react-router-dom";
import { CheckCircle, XCircle, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";
import { toast } from "sonner";

const configs = {
  "/payment/success": {
    icon: CheckCircle,
    iconClass: "text-emerald-500",
    title: "Payment Successful!",
    description: "Your credits have been added to your account. You can start using them right away.",
    toast: { type: "success" as const, message: "Payment successful! Credits added to your account." },
  },
  "/payment/fail": {
    icon: XCircle,
    iconClass: "text-destructive",
    title: "Payment Failed",
    description: "Something went wrong with your payment. Please try again or use a different payment method.",
    toast: { type: "error" as const, message: "Payment failed. Please try again." },
  },
  "/payment/cancel": {
    icon: Ban,
    iconClass: "text-muted-foreground",
    title: "Payment Cancelled",
    description: "You cancelled the payment. No charges were made to your account.",
    toast: { type: "info" as const, message: "Payment was cancelled." },
  },
};

export default function PaymentResult() {
  const { pathname } = useLocation();
  const config = configs[pathname as keyof typeof configs] || configs["/payment/fail"];
  const Icon = config.icon;

  useEffect(() => {
    if (config.toast.type === "success") toast.success(config.toast.message);
    else if (config.toast.type === "error") toast.error(config.toast.message);
    else toast.info(config.toast.message);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <Icon className={`h-16 w-16 mx-auto ${config.iconClass}`} />
        <h1 className="text-2xl font-bold">{config.title}</h1>
        <p className="text-muted-foreground">{config.description}</p>
        <div className="flex flex-col gap-3">
          <Button asChild>
            <Link to="/dashboard">Go to Dashboard</Link>
          </Button>
          {pathname !== "/payment/success" && (
            <Button variant="outline" asChild>
              <Link to="/dashboard">Try Again</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
