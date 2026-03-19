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
import { Loader2, Upload, ArrowRight, ArrowLeft } from "lucide-react";
import logoAlt from "@/assets/logo-alt.png";

type Step = 1 | 2 | 3;

interface FormField {
  id: string;
  field_key: string;
  label: string;
  field_type: string;
  placeholder: string | null;
  is_required: boolean;
  sort_order: number;
  options: any;
  section_title?: string | null;
  layout_width?: "1" | "2" | "3" | "4" | "full" | "half";
}

const borderlessInputClass = "border-0 shadow-none focus-visible:ring-1 focus-visible:ring-accent bg-muted/30";

function getGridSpanClass(layoutWidth?: FormField["layout_width"]) {
  if (layoutWidth === "4") return "md:col-span-3";
  if (layoutWidth === "3") return "md:col-span-4";
  if (layoutWidth === "2" || layoutWidth === "half") return "md:col-span-6";
  return "md:col-span-12";
}

export default function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Step 1: Country + Visa Type
  const [countries, setCountries] = useState<any[]>([]);
  const [visaTypes, setVisaTypes] = useState<any[]>([]);
  const [countryId, setCountryId] = useState("");
  const [visaTypeId, setVisaTypeId] = useState("");

  // Step 2: Dynamic form
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [formData, setFormData] = useState<Record<string, string>>({});

  // Step 3: Contact & Social
  const [whatsapp, setWhatsapp] = useState("");
  const [facebook, setFacebook] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [instagram, setInstagram] = useState("");

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
      const traceId = `extract-${Date.now()}`;
      const expectedKeys = formFields.map((field) => field.field_key);
      const requiredKeys = formFields.filter((field) => field.is_required).map((field) => field.field_key);
      const clientProjectRef = (import.meta.env.VITE_SUPABASE_URL || "")
        .replace("https://", "")
        .replace("http://", "")
        .split(".")[0];

      console.group(`[DOC_EXTRACT][${traceId}] Request`);
      console.log("visa_type_id", visaTypeId);
      console.log("clientProjectRef", clientProjectRef);
      console.log("file", { name: file.name, type: file.type, size: file.size, base64Length: base64.length });
      console.log("expectedKeys", expectedKeys);
      console.log("requiredKeys", requiredKeys);
      console.groupEnd();

      const { data, error } = await supabase.functions.invoke("extract-document", {
        body: {
          file_base64: base64,
          file_type: file.type,
          visa_type_id: visaTypeId,
          debug_client_project_ref: clientProjectRef,
          debug_trace_id: traceId,
        },
      });

      console.group(`[DOC_EXTRACT][${traceId}] Response`);
      console.log("rawData", data);
      console.log("rawError", error);

      const responseKeys = data && typeof data === "object" ? Object.keys(data) : [];
      const unknownKeys = responseKeys.filter((key) => !expectedKeys.includes(key));
      const missingExpectedKeys = expectedKeys.filter((key) => !responseKeys.includes(key));
      const matchedNonEmpty = expectedKeys.filter((key) => typeof data?.[key] === "string" && data[key].trim().length > 0);

      console.log("responseKeys", responseKeys);
      console.log("matchedNonEmpty", matchedNonEmpty);
      console.log("missingExpectedKeys", missingExpectedKeys);
      console.log("unknownKeys", unknownKeys);
      console.groupEnd();

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
      console.group("[DOC_EXTRACT] Failure");
      console.error("error", err);
      console.error("message", err?.message);
      console.error("details", err?.details);
      console.error("hint", err?.hint);
      console.groupEnd();
      toast.error(err.message || "Failed to extract document data");
    }
    setUploading(false);
  }

  async function handleComplete() {
    if (!user) return;
    if (!whatsapp.trim()) { toast.error("WhatsApp number is required"); setStep(3); return; }
    if (!countryId || !visaTypeId) { toast.error("Please select country and visa type"); setStep(1); return; }

    // Validate required fields
    const missingRequired = formFields.filter(f => f.is_required && !formData[f.field_key]?.trim());
    if (missingRequired.length > 0) {
      toast.error(`Please fill required field: ${missingRequired[0].label}`);
      setStep(2);
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
      const { error: dynamicError } = await supabase
        .from("user_visa_form_data")
        .upsert(upserts, { onConflict: "user_id,visa_type_id,field_key" });

      if (dynamicError) {
        toast.error("Failed to save visa details");
        setLoading(false);
        return;
      }
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

  const dynamicSections = formFields.reduce<Array<{ title: string; fields: FormField[] }>>((acc, field) => {
    const sectionTitle = (field.section_title || "General Details").trim();
    const last = acc[acc.length - 1];
    if (!last || last.title !== sectionTitle) {
      acc.push({ title: sectionTitle, fields: [field] });
    } else {
      last.fields.push(field);
    }
    return acc;
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <img src={logoAlt} alt="Visa Cracked" className="h-10 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground">Complete Your Profile</h1>
          <p className="text-muted-foreground text-sm mt-1">Step {step} of 3</p>
          <div className="flex gap-2 justify-center mt-3">
            {[1, 2, 3].map((s) => (
              <div key={s} className={`h-1.5 w-12 rounded-full transition-colors ${s <= step ? "bg-accent" : "bg-muted"}`} />
            ))}
          </div>
        </div>

        <div className="bg-card rounded-2xl border-0 p-6 shadow-sm">
          {step === 1 && (
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
              <Button className="w-full border-0 bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => {
                if (!countryId || !visaTypeId) { toast.error("Please select country and visa type"); return; }
                setStep(2);
              }}>Next <ArrowRight className="ml-2 h-4 w-4" /></Button>
            </div>
          )}

          {step === 2 && (
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
                  <div className="space-y-4">
                    {dynamicSections.map((section) => (
                      <div key={section.title} className="space-y-3">
                        <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                          {section.fields.map((field) => (
                            <div key={field.field_key} className={`space-y-1 ${getGridSpanClass(field.layout_width)}`}>
                              <Label className="text-xs">{field.label}{field.is_required && <span className="text-destructive"> *</span>}</Label>
                              {renderDynamicField(field)}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">No additional fields required for this visa type. Click Next to continue.</p>
              )}
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1 border-0"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
                <Button className="flex-1 border-0 bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => {
                  const missingRequired = formFields.filter(f => f.is_required && !formData[f.field_key]?.trim());
                  if (missingRequired.length > 0) {
                    toast.error(`Please fill required field: ${missingRequired[0].label}`);
                    return;
                  }
                  setStep(3);
                }}>Next <ArrowRight className="ml-2 h-4 w-4" /></Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="font-semibold text-lg text-foreground">Contact & Social</h2>
              <div className="space-y-2">
                <Label>WhatsApp Number <span className="text-destructive">*</span></Label>
                <Input className={borderlessInputClass} value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="+8801XXXXXXXXX" />
              </div>
              <div className="space-y-2"><Label>Facebook URL</Label><Input className={borderlessInputClass} value={facebook} onChange={e => setFacebook(e.target.value)} placeholder="https://facebook.com/your.profile" /></div>
              <div className="space-y-2"><Label>LinkedIn URL</Label><Input className={borderlessInputClass} value={linkedin} onChange={e => setLinkedin(e.target.value)} placeholder="https://linkedin.com/in/your-profile" /></div>
              <div className="space-y-2"><Label>Instagram URL</Label><Input className={borderlessInputClass} value={instagram} onChange={e => setInstagram(e.target.value)} placeholder="https://instagram.com/your.handle" /></div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1 border-0"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
                <Button className="flex-1 border-0 bg-accent text-accent-foreground hover:bg-accent/90" onClick={handleComplete} disabled={loading}>
                  {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : "Complete Setup"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
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
