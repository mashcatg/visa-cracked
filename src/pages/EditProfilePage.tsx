import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

type ProfileForm = {
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

const borderlessInputClass = "border-0 shadow-none focus-visible:ring-1 focus-visible:ring-accent bg-muted/30";

export default function EditProfilePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ProfileForm>({
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
          setForm({
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

  function updateField(field: keyof ProfileForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    if (!user) return;
    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: form.full_name || null,
        whatsapp_number: form.whatsapp_number || null,
        facebook_url: form.facebook_url || null,
        linkedin_url: form.linkedin_url || null,
        instagram_url: form.instagram_url || null,
        university_name: form.university_name || null,
        program_name: form.program_name || null,
        sevis_id: form.sevis_id || null,
        visa_country: form.visa_country || null,
        visa_type: form.visa_type || null,
        start_date: form.start_date || null,
      })
      .eq("user_id", user.id);

    setSaving(false);

    if (error) {
      toast.error("Failed to update profile");
      return;
    }

    toast.success("Profile updated successfully");
  }

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
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Edit Profile</h1>
          <p className="text-sm text-muted-foreground mt-1">Update personal, social, and onboarding details.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Personal Details</CardTitle>
            <CardDescription>Basic account information</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input className={borderlessInputClass} value={form.full_name} onChange={(e) => updateField("full_name", e.target.value)} placeholder="Your name" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input className={borderlessInputClass} value={form.email} disabled />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp Number</Label>
              <Input className={borderlessInputClass} value={form.whatsapp_number} onChange={(e) => updateField("whatsapp_number", e.target.value)} placeholder="+8801XXXXXXXXX" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Social Links</CardTitle>
            <CardDescription>Optional social profiles</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Facebook URL</Label>
              <Input className={borderlessInputClass} value={form.facebook_url} onChange={(e) => updateField("facebook_url", e.target.value)} placeholder="https://facebook.com/your.profile" />
            </div>
            <div className="space-y-2">
              <Label>LinkedIn URL</Label>
              <Input className={borderlessInputClass} value={form.linkedin_url} onChange={(e) => updateField("linkedin_url", e.target.value)} placeholder="https://linkedin.com/in/your-profile" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Instagram URL</Label>
              <Input className={borderlessInputClass} value={form.instagram_url} onChange={(e) => updateField("instagram_url", e.target.value)} placeholder="https://instagram.com/your.handle" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Onboarding Data</CardTitle>
            <CardDescription>Visa and university details used in your interview prep</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>University</Label>
              <Input className={borderlessInputClass} value={form.university_name} onChange={(e) => updateField("university_name", e.target.value)} placeholder="e.g. Stanford University" />
            </div>
            <div className="space-y-2">
              <Label>Program</Label>
              <Input className={borderlessInputClass} value={form.program_name} onChange={(e) => updateField("program_name", e.target.value)} placeholder="e.g. MS Computer Science" />
            </div>
            <div className="space-y-2">
              <Label>SEVIS ID</Label>
              <Input className={borderlessInputClass} value={form.sevis_id} onChange={(e) => updateField("sevis_id", e.target.value)} placeholder="N00XXXXXXXXX" />
            </div>
            <div className="space-y-2">
              <Label>Visa Country</Label>
              <Input className={borderlessInputClass} value={form.visa_country} onChange={(e) => updateField("visa_country", e.target.value)} placeholder="e.g. USA" />
            </div>
            <div className="space-y-2">
              <Label>Visa Type</Label>
              <Input className={borderlessInputClass} value={form.visa_type} onChange={(e) => updateField("visa_type", e.target.value)} placeholder="e.g. F1" />
            </div>
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input className={borderlessInputClass} type="date" value={form.start_date} onChange={(e) => updateField("start_date", e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
