import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import logoLight from "@/assets/logo.png";
import logoDark from "@/assets/visa-cracked-dark-logo.png";
import { ArrowLeft } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const { theme } = useTheme();

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Check your email for the reset link!");
    }
    setLoading(false);
  }

  return (
    <div className={`flex min-h-screen items-center justify-center px-4 ${
      theme === "dark"
        ? "bg-secondary"
        : "bg-white"
    }`}>
      <Card className={`w-full max-w-md border-0 ${
        theme === "dark"
          ? "bg-secondary shadow-none"
          : "bg-white shadow-none"
      }`}>
        <CardHeader className="text-center space-y-4">
          <img
            src={theme === "dark" ? logoDark : logoLight}
            alt="Visa Cracked"
            className={`mx-auto ${
              theme === "dark"
                ? "h-10 sm:h-12"
                : "h-12 sm:h-14"
            }`}
          />
          <CardTitle className={`text-2xl ${
            theme === "dark" ? "text-white" : ""
          }`}>Reset password</CardTitle>
          <CardDescription className={theme === "dark" ? "text-muted-foreground" : ""}>Enter your email and we'll send a reset link</CardDescription>
        </CardHeader>
        <form onSubmit={handleReset}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className={theme === "dark" ? "text-white" : ""}>Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={`rounded-lg border ${
                  theme === "dark"
                    ? "bg-[#25e4750a] border-0 text-white placeholder:text-muted-foreground"
                    : "border-input bg-white"
                }`}
              />
            </div>
            <Button
              type="submit"
              className={`w-full font-semibold ${
                theme === "dark"
                  ? "bg-accent text-accent-foreground hover:bg-accent/80"
                  : "bg-accent text-accent-foreground hover:bg-accent/90"
              }`}
              disabled={loading}
            >
              {loading ? "Sending..." : "Send Reset Link"}
            </Button>
            <Link to="/login" className={`flex items-center justify-center gap-2 text-sm font-medium hover:opacity-80 transition-opacity ${
              theme === "dark" ? "text-accent" : "text-accent"
            }`}>
              <ArrowLeft className="h-4 w-4" /> Back to login
            </Link>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
