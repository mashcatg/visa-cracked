import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import logoLight from "@/assets/logo.png";
import logoDark from "@/assets/visa-cracked-dark-logo.png";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { theme } = useTheme();

  useEffect(() => {
    // Check if we have the recovery token in the URL
    const hash = window.location.hash;
    if (!hash.includes("type=recovery")) {
      navigate("/login");
    }
  }, [navigate]);

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Password updated successfully!");
      navigate("/dashboard");
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
          ? "bg-secondary shadow-none border border-border"
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
          }`}>Set new password</CardTitle>
          <CardDescription className={theme === "dark" ? "text-muted-foreground" : ""}>Enter your new password below</CardDescription>
        </CardHeader>
        <form onSubmit={handleUpdate}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password" className={theme === "dark" ? "text-white" : ""}>New Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
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
              {loading ? "Updating..." : "Update Password"}
            </Button>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
