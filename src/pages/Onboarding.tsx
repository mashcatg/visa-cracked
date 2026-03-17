import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Upload, FileText, ArrowRight, ArrowLeft, Check } from "lucide-react";
import logoAlt from "@/assets/logo-alt.png";

type Step = 1 | 2 | 3;

interface FormData {
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
}

export default function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState<FormData>({
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
      .select("onboarding_completed")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.onboarding_completed) navigate("/dashboard", { replace: true });
      });
  }, [user, navigate]);

  function update(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File too large (max 10MB)");
      return;
    }

    setUploading(true);
    try {
      const base64 = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke("extract-document", {
        body: { file_base64: base64, file_type: file.type },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data) {
        setForm((prev) => ({
          ...prev,
          university_name: data.university_name || prev.university_name,
          program_name: data.program_name || prev.program_name,
          sevis_id: data.sevis_id || prev.sevis_id,
          visa_country: data.visa_country || prev.visa_country,
          visa_type: data.visa_type || prev.visa_type,
          start_date: data.start_date || prev.start_date,
        }));
        toast.success("Document data extracted! Please review the fields.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to extract document data");
    }
    setUploading(false);
  }

  async function handleComplete() {
    if (!user) return;
    if (!form.whatsapp_number.trim()) {
      toast.error("WhatsApp number is required");
      setStep(1);
      return;
    }

    setLoading(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        whatsapp_number: form.whatsapp_number,
        facebook_url: form.facebook_url || null,
        linkedin_url: form.linkedin_url || null,
        instagram_url: form.instagram_url || null,
        university_name: form.university_name || null,
        program_name: form.program_name || null,
        sevis_id: form.sevis_id || null,
        visa_country: form.visa_country || null,
        visa_type: form.visa_type || null,
        start_date: form.start_date || null,
        onboarding_completed: true,
      })
      .eq("user_id", user.id);

    if (error) {
      toast.error("Failed to save profile");
    } else {
      toast.success("Profile setup complete!");
      navigate("/dashboard", { replace: true });
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <img src={logoAlt} alt="Visa Cracked" className="h-10 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground">Complete Your Profile</h1>
          <p className="text-muted-foreground text-sm mt-1">Step {step} of 3</p>
          <div className="flex gap-2 justify-center mt-3">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1.5 w-12 rounded-full transition-colors ${
                  s <= step ? "bg-accent" : "bg-muted"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="font-semibold text-lg text-foreground">Contact & Social</h2>
              <div className="space-y-2">
                <Label>
                  WhatsApp Number <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={form.whatsapp_number}
                  onChange={(e) => update("whatsapp_number", e.target.value)}
                  placeholder="+8801XXXXXXXXX"
                />
              </div>
              <div className="space-y-2">
                <Label>Facebook URL</Label>
                <Input
                  value={form.facebook_url}
                  onChange={(e) => update("facebook_url", e.target.value)}
                  placeholder="https://facebook.com/your.profile"
                />
              </div>
              <div className="space-y-2">
                <Label>LinkedIn URL</Label>
                <Input
                  value={form.linkedin_url}
                  onChange={(e) => update("linkedin_url", e.target.value)}
                  placeholder="https://linkedin.com/in/your-profile"
                />
              </div>
              <div className="space-y-2">
                <Label>Instagram URL</Label>
                <Input
                  value={form.instagram_url}
                  onChange={(e) => update("instagram_url", e.target.value)}
                  placeholder="https://instagram.com/your.handle"
                />
              </div>
              <Button
                className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                onClick={() => {
                  if (!form.whatsapp_number.trim()) {
                    toast.error("WhatsApp number is required");
                    return;
                  }
                  setStep(2);
                }}
              >
                Next <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="font-semibold text-lg text-foreground">Visa & University Details</h2>
              <p className="text-sm text-muted-foreground">
                Upload a document (I-20, Offer Letter, etc.) to auto-fill, or enter manually.
              </p>

              <div className="border-2 border-dashed border-border rounded-xl p-6 text-center">
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  id="doc-upload"
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
                <label htmlFor="doc-upload" className="cursor-pointer">
                  {uploading ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-8 w-8 animate-spin text-accent" />
                      <span className="text-sm text-muted-foreground">Extracting data...</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="h-8 w-8 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">Upload Document</span>
                      <span className="text-xs text-muted-foreground">PDF, JPG, PNG (max 10MB)</span>
                    </div>
                  )}
                </label>
              </div>

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">or enter manually</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <div className="grid gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">University Name</Label>
                  <Input value={form.university_name} onChange={(e) => update("university_name", e.target.value)} placeholder="e.g. Stanford University" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Program Name</Label>
                  <Input value={form.program_name} onChange={(e) => update("program_name", e.target.value)} placeholder="e.g. MS Computer Science" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">SEVIS ID</Label>
                  <Input value={form.sevis_id} onChange={(e) => update("sevis_id", e.target.value)} placeholder="N00XXXXXXXXX" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Visa Country</Label>
                    <Input value={form.visa_country} onChange={(e) => update("visa_country", e.target.value)} placeholder="e.g. USA" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Visa Type</Label>
                    <Input value={form.visa_type} onChange={(e) => update("visa_type", e.target.value)} placeholder="e.g. F1" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Program Start Date</Label>
                  <Input type="date" value={form.start_date} onChange={(e) => update("start_date", e.target.value)} />
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => setStep(3)}>
                  Next <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="font-semibold text-lg text-foreground">Review & Confirm</h2>
              <div className="space-y-3 text-sm">
                <ReviewItem label="WhatsApp" value={form.whatsapp_number} required />
                <ReviewItem label="Facebook" value={form.facebook_url} />
                <ReviewItem label="LinkedIn" value={form.linkedin_url} />
                <ReviewItem label="Instagram" value={form.instagram_url} />
                <div className="h-px bg-border" />
                <ReviewItem label="University" value={form.university_name} />
                <ReviewItem label="Program" value={form.program_name} />
                <ReviewItem label="SEVIS ID" value={form.sevis_id} />
                <ReviewItem label="Visa Country" value={form.visa_country} />
                <ReviewItem label="Visa Type" value={form.visa_type} />
                <ReviewItem label="Start Date" value={form.start_date} />
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button
                  className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
                  onClick={handleComplete}
                  disabled={loading}
                >
                  {loading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                  ) : (
                    <><Check className="mr-2 h-4 w-4" /> Complete Setup</>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewItem({ label, value, required }: { label: string; value: string; required?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium ${!value && required ? "text-destructive" : "text-foreground"}`}>
        {value || (required ? "Required!" : "—")}
      </span>
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
