import { useState, useEffect } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Sun, Moon } from "lucide-react";
import logoLight from "@/assets/logo.png";
import logoDark from "@/assets/visa-cracked-dark-logo.png";
import { getDeviceFingerprint } from "@/lib/fingerprint";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const { theme, setTheme } = useTheme();

  // Redirect to dashboard if already logged in
  useEffect(() => {
    if (session) navigate("/dashboard", { replace: true });
  }, [session, navigate]);

  // Capture referral code from URL
  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) localStorage.setItem("referral_code", ref);
  }, [searchParams]);

  async function processReferral(userId: string) {
    const refCode = localStorage.getItem("referral_code");
    if (!refCode) return;
    try {
      const fingerprint = getDeviceFingerprint();
      await supabase.functions.invoke("process-referral", {
        body: { referral_code: refCode, referred_user_id: userId, device_fingerprint: fingerprint },
      });
    } catch {
      // Silent fail - referral is bonus
    } finally {
      localStorage.removeItem("referral_code");
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: window.location.origin + "/dashboard",
      },
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Check your email to confirm your account!");
      if (data.user) processReferral(data.user.id);
    }
    setLoading(false);
  }

  async function handleGoogleSignup() {
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/signup",
    });
    if (error) toast.error(error.message);
  }

  return (
    <div className={`flex min-h-screen items-center justify-center px-4 py-8 ${
      theme === "dark"
        ? "bg-secondary"
        : "bg-white"
    }`}>
      <Card className={`w-full max-w-md border-0 ${
        theme === "dark"
          ? "bg-secondary shadow-none"
          : "bg-white shadow-none"
      }`}>
        <CardHeader className={`text-center space-y-4 sm:space-y-6 pt-6 sm:pt-8 ${
          theme === "dark" ? "" : ""
        }`}>
          <div className="mx-auto">
            <img
              src={theme === "dark" ? logoDark : logoLight}
              alt="Visa Cracked"
              className={`mx-auto ${
                theme === "dark"
                  ? "h-10 sm:h-12"
                  : "h-12 sm:h-14"
              }`}
            />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl sm:text-3xl font-bold">Create your account</CardTitle>
            <CardDescription className="text-sm sm:text-base">Start preparing for your visa mock test</CardDescription>
          </div>
        </CardHeader>
        <form onSubmit={handleSignup}>
          <CardContent className="space-y-5 sm:space-y-6 px-6 sm:px-8">
            <div className="space-y-2.5">
              <Label htmlFor="name" className={`text-sm sm:text-base font-medium ${
                theme === "dark" ? "text-white" : ""
              }`}>Full Name</Label>
              <Input
                id="name"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className={`h-10 sm:h-12 text-sm sm:text-base px-3 sm:px-4 rounded-lg border ${
                  theme === "dark"
                    ? "bg-[#25e4750a] border-0 text-white placeholder:text-muted-foreground"
                    : "border-input bg-white"
                }`}
              />
            </div>
            <div className="space-y-2.5">
              <Label htmlFor="email" className={`text-sm sm:text-base font-medium ${
                theme === "dark" ? "text-white" : ""
              }`}>Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={`h-10 sm:h-12 text-sm sm:text-base px-3 sm:px-4 rounded-lg border ${
                  theme === "dark"
                    ? "bg-[#25e4750a] border-0 text-white placeholder:text-muted-foreground"
                    : "border-input bg-white"
                }`}
              />
            </div>
            <div className="space-y-2.5">
              <Label htmlFor="password" className={`text-sm sm:text-base font-medium ${
                theme === "dark" ? "text-white" : ""
              }`}>Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className={`h-10 sm:h-12 text-sm sm:text-base px-3 sm:px-4 rounded-lg border ${
                  theme === "dark"
                    ? "bg-[#25e4750a] border-0 text-white placeholder:text-muted-foreground"
                    : "border-input bg-white"
                }`}
              />
            </div>
            <Button
              type="submit"
              className="w-full h-10 sm:h-12 bg-accent text-accent-foreground hover:bg-accent/90 font-semibold text-sm sm:text-base rounded-lg transition-colors"
              disabled={loading}
            >
              {loading ? "Creating account..." : "Sign Up"}
            </Button>
            <div className="relative my-5 sm:my-6">
              <div className="absolute inset-0 flex items-center"><span className={`w-full border-t ${
                theme === "dark" ? "border-border/50" : "border-border"
              }`} /></div>
              <div className="relative flex justify-center text-xs uppercase"><span className={`px-2 text-xs font-medium ${
                theme === "dark"
                  ? "bg-secondary text-muted-foreground"
                  : "bg-white text-muted-foreground"
              }`}>or continue with</span></div>
            </div>
            <Button
              type="button"
              variant="outline"
              className={`w-full h-10 sm:h-12 text-sm sm:text-base rounded-lg transition-colors ${
                theme === "dark"
                  ? "border-0 bg-primary hover:bg-primary/80 text-secondary"
                  : "border border-input bg-white hover:bg-gray-50"
              }`}
              onClick={handleGoogleSignup}
            >
              {theme === "dark" ? (
                <svg className="mr-2 h-4 w-4 sm:h-5 sm:w-5 text-secondary" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="currentColor" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="currentColor" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="currentColor" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="currentColor" />
                </svg>
              ) : (
                <svg className="mr-2 h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
              )}
              Google
            </Button>
          </CardContent>
        </form>
        <CardFooter className="justify-center pb-6 sm:pb-8">
          <p className="text-xs sm:text-sm text-muted-foreground text-center">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-accent hover:underline">Sign in</Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
