import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  isAdmin: boolean;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  isAdmin: false,
  isLoading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Set up listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (session?.user) {
        setTimeout(() => checkAdmin(session.user.id), 0);
        // Process referral for new Google OAuth signups
        if (event === "SIGNED_IN") {
          const refCode = localStorage.getItem("referral_code");
          if (refCode) {
            import("@/lib/fingerprint").then(({ getDeviceFingerprint }) => {
              const fingerprint = getDeviceFingerprint();
              supabase.functions.invoke("process-referral", {
                body: { referral_code: refCode, referred_user_id: session.user.id, device_fingerprint: fingerprint },
              }).finally(() => localStorage.removeItem("referral_code"));
            });
          }
        }
      } else {
        setIsAdmin(false);
      }
      setIsLoading(false);
    });

    // THEN check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        checkAdmin(session.user.id);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function checkAdmin(userId: string) {
    const { data } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    setIsAdmin(!!data);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setSession(null);
    setIsAdmin(false);
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        isAdmin,
        isLoading,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, isLoading } = useAuth();
  const navigate = useNavigate();
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    // Wait for auth to fully resolve before deciding to redirect
    if (!isLoading) {
      // Give an extra moment for OAuth callbacks to settle
      const hasOAuthIndicators =
        window.location.hash.includes("access_token") ||
        window.location.search.includes("code=");
      if (hasOAuthIndicators && !session) {
        // Re-check session after a delay for OAuth
        const timer = setTimeout(async () => {
          const { data } = await supabase.auth.getSession();
          if (!data.session) {
            setSessionChecked(true);
          }
        }, 3000);
        return () => clearTimeout(timer);
      }
      setSessionChecked(true);
    }
  }, [isLoading, session]);

  useEffect(() => {
    if (sessionChecked && !session) {
      navigate("/login");
    }
  }, [sessionChecked, session, navigate]);

  if (!sessionChecked || isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!session) return null;
  return <>{children}</>;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAdmin, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      navigate("/dashboard");
    }
  }, [isAdmin, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAdmin) return null;
  return <>{children}</>;
}
