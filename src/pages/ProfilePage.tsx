import { useEffect, useState } from "react";
import { Loader2, Pencil } from "lucide-react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

type ProfileData = {
  full_name: string;
  email: string;
  whatsapp_number: string;
  facebook_url: string;
  linkedin_url: string;
  instagram_url: string;
  university_name: string;
  program_name: string;
  sevis_id: string;
  visa_country: string;
  visa_type: string;
  start_date: string;
};

export default function ProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileData>({
    full_name: "",
    email: "",
    whatsapp_number: "",
    facebook_url: "",
    linkedin_url: "",
    instagram_url: "",
    university_name: "",
    program_name: "",
    sevis_id: "",
    visa_country: "",
    visa_type: "",
    start_date: "",
  });

  useEffect(() => {
    if (!user) return;

    supabase
      .from("profiles")
      .select("full_name, email, whatsapp_number, facebook_url, linkedin_url, instagram_url, university_name, program_name, sevis_id, visa_country, visa_type, start_date")
      .eq("user_id", user.id)
      .single()
      .then(({ data, error }) => {
        if (error) {
          toast.error("Failed to load profile");
          setLoading(false);
          return;
        }

        if (data) {
          setProfile({
            full_name: data.full_name || "",
            email: data.email || user.email || "",
            whatsapp_number: data.whatsapp_number || "",
            facebook_url: data.facebook_url || "",
            linkedin_url: data.linkedin_url || "",
            instagram_url: data.instagram_url || "",
            university_name: data.university_name || "",
            program_name: data.program_name || "",
            sevis_id: data.sevis_id || "",
            visa_country: data.visa_country || "",
            visa_type: data.visa_type || "",
            start_date: data.start_date || "",
          });
        }

        setLoading(false);
      });
  }, [user]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-full min-h-[60vh] items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-5xl p-4 md:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">My Profile</h1>
            <p className="text-sm text-muted-foreground mt-1">View your personal, social, and onboarding details.</p>
          </div>
          <Button className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => navigate("/profile/edit")}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit Profile
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Personal Details</CardTitle>
            <CardDescription>Basic account information</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Info label="Full Name" value={profile.full_name} />
            <Info label="Email" value={profile.email} />
            <Info label="WhatsApp Number" value={profile.whatsapp_number} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Social Links</CardTitle>
            <CardDescription>Connected social profiles</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Info label="Facebook" value={profile.facebook_url} />
            <Info label="LinkedIn" value={profile.linkedin_url} />
            <Info label="Instagram" value={profile.instagram_url} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Onboarding Data</CardTitle>
            <CardDescription>Visa and university details for interview preparation</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Info label="University" value={profile.university_name} />
            <Info label="Program" value={profile.program_name} />
            <Info label="SEVIS ID" value={profile.sevis_id} />
            <Info label="Visa Country" value={profile.visa_country} />
            <Info label="Visa Type" value={profile.visa_type} />
            <Info label="Start Date" value={profile.start_date} />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/30 p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground mt-1 break-words">{value || "—"}</p>
    </div>
  );
}
