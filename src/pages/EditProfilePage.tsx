import { useEffect, useState } from "react";
import { Loader2, Save, Upload } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

const borderlessInputClass = "border-0 shadow-none focus-visible:ring-1 focus-visible:ring-accent bg-muted/30";

interface FormField {
  field_key: string;
  label: string;
  field_type: string;
  placeholder: string | null;
  is_required: boolean;
  options: any;
}

export default function EditProfilePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: "", email: "", whatsapp_number: "", facebook_url: "", linkedin_url: "", instagram_url: "",
    visa_country: "", visa_type: "",
  });

  // Dynamic form
  const [countries, setCountries] = useState<any[]>([]);
  const [visaTypes, setVisaTypes] = useState<any[]>([]);
  const [selectedCountryId, setSelectedCountryId] = useState("");
  const [selectedVisaTypeId, setSelectedVisaTypeId] = useState("");
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [dynamicData, setDynamicData] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;
    supabase.from("countries").select("*").order("name").then(({ data }) => { if (data) setCountries(data); });

    supabase.from("profiles")
      .select("full_name, email, whatsapp_number, facebook_url, linkedin_url, instagram_url, visa_country, visa_type")
      .eq("user_id", user.id).single()
      .then(async ({ data }) => {
        if (data) {
          setForm({
            full_name: data.full_name || "", email: data.email || user.email || "",
            whatsapp_number: data.whatsapp_number || "", facebook_url: data.facebook_url || "",
            linkedin_url: data.linkedin_url || "", instagram_url: data.instagram_url || "",
            visa_country: data.visa_country || "", visa_type: data.visa_type || "",
          });

          // Try to find the matching country/visa type IDs
          if (data.visa_country) {
            const { data: c } = await supabase.from("countries").select("id").eq("name", data.visa_country).limit(1).single();
            if (c) {
              setSelectedCountryId(c.id);
              const { data: vts } = await supabase.from("visa_types").select("*").eq("country_id", c.id).order("name");
              if (vts) {
                setVisaTypes(vts);
                if (data.visa_type) {
                  const match = vts.find((v: any) => v.name === data.visa_type);
                  if (match) {
                    setSelectedVisaTypeId(match.id);
                    await loadFormFields(match.id);
                  }
                }
              }
            }
          }
        }
        setLoading(false);
      });
  }, [user]);

  async function loadFormFields(vtId: string) {
    const [fieldsRes, dataRes] = await Promise.all([
      supabase.from("visa_type_form_fields").select("*").eq("visa_type_id", vtId).order("sort_order"),
      supabase.from("user_visa_form_data").select("field_key, field_value").eq("user_id", user!.id).eq("visa_type_id", vtId),
    ]);
    const fields = (fieldsRes.data || []) as FormField[];
    setFormFields(fields);
    const existing: Record<string, string> = {};
    fields.forEach(f => { existing[f.field_key] = ""; });
    (dataRes.data || []).forEach((d: any) => { if (d.field_key in existing) existing[d.field_key] = d.field_value || ""; });
    setDynamicData(existing);
  }

  async function handleCountryChange(cId: string) {
    setSelectedCountryId(cId);
    setSelectedVisaTypeId("");
    setFormFields([]);
    setDynamicData({});
    const country = countries.find(c => c.id === cId);
    setForm(prev => ({ ...prev, visa_country: country?.name || "" }));
    const { data } = await supabase.from("visa_types").select("*").eq("country_id", cId).order("name");
    setVisaTypes(data || []);
  }

  async function handleVisaTypeChange(vtId: string) {
    setSelectedVisaTypeId(vtId);
    const vt = visaTypes.find(v => v.id === vtId);
    setForm(prev => ({ ...prev, visa_type: vt?.name || "" }));
    await loadFormFields(vtId);
  }

  async function handleSave() {
    if (!user) return;

    const missingRequired = formFields.filter((field) => field.is_required && !dynamicData[field.field_key]?.trim());
    if (missingRequired.length > 0) {
      toast.error(`Please fill required field: ${missingRequired[0].label}`);
      return;
    }

    setSaving(true);

    const { error: profileError } = await supabase.from("profiles").update({
      full_name: form.full_name || null, whatsapp_number: form.whatsapp_number || null,
      facebook_url: form.facebook_url || null, linkedin_url: form.linkedin_url || null,
      instagram_url: form.instagram_url || null, visa_country: form.visa_country || null,
      visa_type: form.visa_type || null,
    }).eq("user_id", user.id);

    if (profileError) {
      setSaving(false);
      toast.error("Failed to update profile");
      return;
    }

    if (selectedVisaTypeId && formFields.length > 0) {
      const upserts = formFields.map(f => ({
        user_id: user.id, visa_type_id: selectedVisaTypeId,
        field_key: f.field_key, field_value: dynamicData[f.field_key] || null,
      }));
      const { error: dynamicError } = await supabase
        .from("user_visa_form_data")
        .upsert(upserts, { onConflict: "user_id,visa_type_id,field_key" });

      if (dynamicError) {
        setSaving(false);
        toast.error("Failed to update visa form details");
        return;
      }
    }

    setSaving(false);
    toast.success("Profile updated successfully");
  }

  function renderDynamicField(field: FormField) {
    const value = dynamicData[field.field_key] || "";
    const onChange = (val: string) => setDynamicData(prev => ({ ...prev, [field.field_key]: val }));
    if (field.field_type === "textarea") return <Textarea className={borderlessInputClass} value={value} onChange={e => onChange(e.target.value)} placeholder={field.placeholder || ""} />;
    if (field.field_type === "select" && Array.isArray(field.options)) {
      return (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className={borderlessInputClass}><SelectValue placeholder={field.placeholder || "Select..."} /></SelectTrigger>
          <SelectContent>{field.options.map((opt: string) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent>
        </Select>
      );
    }
    return <Input className={borderlessInputClass} type={field.field_type === "date" ? "date" : field.field_type === "number" ? "number" : "text"} value={value} onChange={e => onChange(e.target.value)} placeholder={field.placeholder || ""} />;
  }

  if (loading) {
    return <DashboardLayout><div className="flex h-full min-h-[60vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-5xl p-4 md:p-6 space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Edit Profile</h1>
          <p className="text-sm text-muted-foreground mt-1">Update personal, social, and visa details.</p>
        </div>

        <Card>
          <CardHeader><CardTitle>Personal Details</CardTitle><CardDescription>Basic account information</CardDescription></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Full Name</Label><Input className={borderlessInputClass} value={form.full_name} onChange={e => setForm(prev => ({ ...prev, full_name: e.target.value }))} placeholder="Your name" /></div>
            <div className="space-y-2"><Label>Email</Label><Input className={borderlessInputClass} value={form.email} disabled /></div>
            <div className="space-y-2"><Label>WhatsApp Number</Label><Input className={borderlessInputClass} value={form.whatsapp_number} onChange={e => setForm(prev => ({ ...prev, whatsapp_number: e.target.value }))} placeholder="+8801XXXXXXXXX" /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Social Links</CardTitle><CardDescription>Optional social profiles</CardDescription></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Facebook URL</Label><Input className={borderlessInputClass} value={form.facebook_url} onChange={e => setForm(prev => ({ ...prev, facebook_url: e.target.value }))} placeholder="https://facebook.com/your.profile" /></div>
            <div className="space-y-2"><Label>LinkedIn URL</Label><Input className={borderlessInputClass} value={form.linkedin_url} onChange={e => setForm(prev => ({ ...prev, linkedin_url: e.target.value }))} placeholder="https://linkedin.com/in/your-profile" /></div>
            <div className="space-y-2 md:col-span-2"><Label>Instagram URL</Label><Input className={borderlessInputClass} value={form.instagram_url} onChange={e => setForm(prev => ({ ...prev, instagram_url: e.target.value }))} placeholder="https://instagram.com/your.handle" /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Visa Details</CardTitle><CardDescription>Country and visa type selection</CardDescription></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Country</Label>
              <Select value={selectedCountryId} onValueChange={handleCountryChange}>
                <SelectTrigger className={borderlessInputClass}><SelectValue placeholder="Select country" /></SelectTrigger>
                <SelectContent>{countries.map(c => <SelectItem key={c.id} value={c.id}>{c.flag_emoji} {c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Visa Type</Label>
              <Select value={selectedVisaTypeId} onValueChange={handleVisaTypeChange} disabled={!selectedCountryId}>
                <SelectTrigger className={borderlessInputClass}><SelectValue placeholder="Select visa type" /></SelectTrigger>
                <SelectContent>{visaTypes.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {formFields.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Visa Form Details</CardTitle><CardDescription>Fields specific to your visa type</CardDescription></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {formFields.map(field => (
                <div key={field.field_key} className="space-y-2">
                  <Label>{field.label}{field.is_required && <span className="text-destructive"> *</span>}</Label>
                  {renderDynamicField(field)}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end">
          <Button className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : <><Save className="mr-2 h-4 w-4" /> Save Changes</>}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
