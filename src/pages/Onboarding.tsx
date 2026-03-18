import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Upload, ArrowRight, ArrowLeft, Check } from "lucide-react";
import logoAlt from "@/assets/logo-alt.png";

type Step = 1 | 2 | 3 | 4;

interface FormField {
  id: string;
  field_key: string;
  label: string;
  field_type: string;
  placeholder: string | null;
  is_required: boolean;
  sort_order: number;
  options: any;
}

const borderlessInputClass = "border-0 shadow-none focus-visible:ring-1 focus-visible:ring-accent bg-muted/30";

export default function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Step 1: Social
  const [whatsapp, setWhatsapp] = useState("");
  const [facebook, setFacebook] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [instagram, setInstagram] = useState("");

  // Step 2: Country + Visa Type
  const [countries, setCountries] = useState<any[]>([]);
  const [visaTypes, setVisaTypes] = useState<any[]>([]);
  const [countryId, setCountryId] = useState("");
  const [visaTypeId, setVisaTypeId] = useState("");

  // Step 3: Dynamic form
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [formData, setFormData] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("onboarding_completed").eq("user_id", user.id).single()
      .then(({ data }) => { if (data?.onboarding_completed) navigate("/dashboard", { replace: true }); });
    supabase.from("countries").select("*").order("name").then(({ data }) => { if (data) setCountries(data); });
  }, [user, navigate]);

  useEffect(() => {
    if (!countryId) { setVisaTypes([]); setVisaTypeId(""); return; }
    supabase.from("visa_types").select("*").eq("country_id", countryId).order("name")
      .then(({ data }) => { if (data) setVisaTypes(data); });
    setVisaTypeId("");
  }, [countryId]);

  useEffect(() => {
    if (!visaTypeId) { setFormFields([]); setFormData({}); return; }
    supabase.from("visa_type_form_fields").select("*").eq("visa_type_id", visaTypeId).order("sort_order")
      .then(({ data }) => {
        if (data) {
          setFormFields(data as FormField[]);
          const initial: Record<string, string> = {};
          data.forEach((f: any) => { initial[f.field_key] = ""; });
          setFormData(initial);
        }
      });
  }, [visaTypeId]);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("File too large (max 10MB)"); return; }
    setUploading(true);
    try {
      const base64 = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke("extract-document", {
        body: { file_base64: base64, file_type: file.type },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data) {
        setFormData((prev) => {
          const updated = { ...prev };
          for (const [key, value] of Object.entries(data)) {
            if (key in updated && typeof value === "string" && value) {
              updated[key] = value;
            }
          }
          return updated;
        });
        toast.success("Document data extracted! Please review the fields.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to extract document data");
    }
    setUploading(false);
  }

  async function handleComplete() {
    if (!user) return;
    if (!whatsapp.trim()) { toast.error("WhatsApp number is required"); setStep(1); return; }
    if (!visaTypeId) { toast.error("Please select a visa type"); setStep(2); return; }

    // Validate required fields
    const missingRequired = formFields.filter(f => f.is_required && !formData[f.field_key]?.trim());
    if (missingRequired.length > 0) {
      toast.error(`Please fill required field: ${missingRequired[0].label}`);
      setStep(3);
      return;
    }

    setLoading(true);

    // Save profile social + country/visa
    const country = countries.find(c => c.id === countryId);
    const visa = visaTypes.find(v => v.id === visaTypeId);
    const { error: profileError } = await supabase.from("profiles").update({
      whatsapp_number: whatsapp,
      facebook_url: facebook || null,
      linkedin_url: linkedin || null,
      instagram_url: instagram || null,
      visa_country: country?.name || null,
      visa_type: visa?.name || null,
      onboarding_completed: true,
    }).eq("user_id", user.id);

    if (profileError) { toast.error("Failed to save profile"); setLoading(false); return; }

    // Save dynamic form data
    if (formFields.length > 0) {
      const upserts = formFields.map(f => ({
        user_id: user.id,
        visa_type_id: visaTypeId,
        field_key: f.field_key,
        field_value: formData[f.field_key] || null,
      }));
      await supabase.from("user_visa_form_data").upsert(upserts, { onConflict: "user_id,visa_type_id,field_key" });
    }

    toast.success("Profile setup complete!");
    navigate("/dashboard", { replace: true });
    setLoading(false);
  }

  function renderDynamicField(field: FormField) {
    const value = formData[field.field_key] || "";
    const onChange = (val: string) => setFormData(prev => ({ ...prev, [field.field_key]: val }));

    if (field.field_type === "textarea") {
      return <Textarea className={borderlessInputClass} value={value} onChange={e => onChange(e.target.value)} placeholder={field.placeholder || ""} />;
    }
    if (field.field_type === "select" && Array.isArray(field.options)) {
      return (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className={borderlessInputClass}><SelectValue placeholder={field.placeholder || "Select..."} /></SelectTrigger>
          <SelectContent>
            {field.options.map((opt: string) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    }
    return <Input className={borderlessInputClass} type={field.field_type === "date" ? "date" : field.field_type === "number" ? "number" : "text"} value={value} onChange={e => onChange(e.target.value)} placeholder={field.placeholder || ""} />;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <img src={logoAlt} alt="Visa Cracked" className="h-10 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground">Complete Your Profile</h1>
          <p className="text-muted-foreground text-sm mt-1">Step {step} of 4</p>
          <div className="flex gap-2 justify-center mt-3">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className={`h-1.5 w-12 rounded-full transition-colors ${s <= step ? "bg-accent" : "bg-muted"}`} />
            ))}
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="font-semibold text-lg text-foreground">Contact & Social</h2>
              <div className="space-y-2">
                <Label>WhatsApp Number <span className="text-destructive">*</span></Label>
                <Input className={borderlessInputClass} value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="+8801XXXXXXXXX" />
              </div>
              <div className="space-y-2"><Label>Facebook URL</Label><Input className={borderlessInputClass} value={facebook} onChange={e => setFacebook(e.target.value)} placeholder="https://facebook.com/your.profile" /></div>
              <div className="space-y-2"><Label>LinkedIn URL</Label><Input className={borderlessInputClass} value={linkedin} onChange={e => setLinkedin(e.target.value)} placeholder="https://linkedin.com/in/your-profile" /></div>
              <div className="space-y-2"><Label>Instagram URL</Label><Input className={borderlessInputClass} value={instagram} onChange={e => setInstagram(e.target.value)} placeholder="https://instagram.com/your.handle" /></div>
              <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => {
                if (!whatsapp.trim()) { toast.error("WhatsApp number is required"); return; }
                setStep(2);
              }}>Next <ArrowRight className="ml-2 h-4 w-4" /></Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="font-semibold text-lg text-foreground">Select Country & Visa Type</h2>
              <div className="space-y-2">
                <Label>Country <span className="text-destructive">*</span></Label>
                <Select value={countryId} onValueChange={setCountryId}>
                  <SelectTrigger className={borderlessInputClass}><SelectValue placeholder="Select a country" /></SelectTrigger>
                  <SelectContent>{countries.map(c => <SelectItem key={c.id} value={c.id}>{c.flag_emoji} {c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Visa Type <span className="text-destructive">*</span></Label>
                <Select value={visaTypeId} onValueChange={setVisaTypeId} disabled={!countryId}>
                  <SelectTrigger className={borderlessInputClass}><SelectValue placeholder="Select visa type" /></SelectTrigger>
                  <SelectContent>{visaTypes.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
                <Button className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => {
                  if (!visaTypeId) { toast.error("Please select a visa type"); return; }
                  setStep(3);
                }}>Next <ArrowRight className="ml-2 h-4 w-4" /></Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="font-semibold text-lg text-foreground">Visa Details</h2>
              {formFields.length > 0 ? (
                <>
                  <p className="text-sm text-muted-foreground">Upload a document (I-20, Offer Letter, etc.) to auto-fill, or enter manually.</p>
                  <div className="rounded-xl p-6 text-center bg-muted/30">
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" id="doc-upload" onChange={handleFileUpload} disabled={uploading} />
                    <label htmlFor="doc-upload" className="cursor-pointer">
                      {uploading ? (
                        <div className="flex flex-col items-center gap-2"><Loader2 className="h-8 w-8 animate-spin text-accent" /><span className="text-sm text-muted-foreground">Extracting data...</span></div>
                      ) : (
                        <div className="flex flex-col items-center gap-2"><Upload className="h-8 w-8 text-muted-foreground" /><span className="text-sm font-medium text-foreground">Upload Document</span><span className="text-xs text-muted-foreground">PDF, JPG, PNG (max 10MB)</span></div>
                      )}
                    </label>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-border" /><span className="text-xs text-muted-foreground">or enter manually</span><div className="h-px flex-1 bg-border" />
                  </div>
                  <div className="grid gap-3">
                    {formFields.map(field => (
                      <div key={field.field_key} className="space-y-1">
                        <Label className="text-xs">{field.label}{field.is_required && <span className="text-destructive"> *</span>}</Label>
                        {renderDynamicField(field)}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">No additional fields required for this visa type. Click Next to continue.</p>
              )}
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
                <Button className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => setStep(4)}>Next <ArrowRight className="ml-2 h-4 w-4" /></Button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h2 className="font-semibold text-lg text-foreground">Review & Confirm</h2>
              <div className="space-y-3 text-sm">
                <ReviewItem label="WhatsApp" value={whatsapp} required />
                <ReviewItem label="Facebook" value={facebook} />
                <ReviewItem label="LinkedIn" value={linkedin} />
                <ReviewItem label="Instagram" value={instagram} />
                <div className="h-px bg-border" />
                <ReviewItem label="Country" value={countries.find(c => c.id === countryId)?.name || ""} />
                <ReviewItem label="Visa Type" value={visaTypes.find(v => v.id === visaTypeId)?.name || ""} />
                {formFields.length > 0 && <>
                  <div className="h-px bg-border" />
                  {formFields.map(f => <ReviewItem key={f.field_key} label={f.label} value={formData[f.field_key] || ""} required={f.is_required} />)}
                </>}
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(3)} className="flex-1"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
                <Button className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90" onClick={handleComplete} disabled={loading}>
                  {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : <><Check className="mr-2 h-4 w-4" /> Complete Setup</>}
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
    reader.onload = () => { resolve((reader.result as string).split(",")[1]); };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
