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
  visa_country: string;
  visa_type: string;
};

type DynamicProfileField = {
  field_key: string;
  label: string;
  value: string;
  is_required: boolean;
  section_title: string;
  layout_width: "1" | "2" | "3" | "4" | "full" | "half";
};

function getGridSpanClass(layoutWidth?: DynamicProfileField["layout_width"]) {
  if (layoutWidth === "4") return "md:col-span-3";
  if (layoutWidth === "3") return "md:col-span-4";
  if (layoutWidth === "2" || layoutWidth === "half") return "md:col-span-6";
  return "md:col-span-12";
}

export default function ProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dynamicFields, setDynamicFields] = useState<DynamicProfileField[]>([]);
  const [profile, setProfile] = useState<ProfileData>({
    full_name: "",
    email: "",
    whatsapp_number: "",
    facebook_url: "",
    linkedin_url: "",
    instagram_url: "",
    visa_country: "",
    visa_type: "",
  });

  async function loadDynamicFields(visaCountry: string, visaType: string, userId: string) {
    if (!visaType) {
      setDynamicFields([]);
      return;
    }

    let countryId: string | null = null;
    if (visaCountry) {
      const { data: country } = await supabase
        .from("countries")
        .select("id")
        .eq("name", visaCountry)
        .limit(1)
        .single();
      countryId = country?.id ?? null;
    }

    const visaTypeQuery = supabase
      .from("visa_types")
      .select("id")
      .eq("name", visaType)
      .limit(1);

    if (countryId) {
      visaTypeQuery.eq("country_id", countryId);
    }

    const { data: visaTypeRow } = await visaTypeQuery.single();
    const visaTypeId = visaTypeRow?.id;

    if (!visaTypeId) {
      setDynamicFields([]);
      return;
    }

    const [fieldsRes, valuesRes] = await Promise.all([
      supabase
        .from("visa_type_form_fields")
        .select("field_key, label, is_required, section_title, layout_width")
        .eq("visa_type_id", visaTypeId)
        .order("sort_order"),
      supabase
        .from("user_visa_form_data")
        .select("field_key, field_value")
        .eq("user_id", userId)
        .eq("visa_type_id", visaTypeId),
    ]);

    const valuesMap = new Map<string, string>();
    (valuesRes.data || []).forEach((item: any) => {
      valuesMap.set(item.field_key, item.field_value || "");
    });

    setDynamicFields(
      (fieldsRes.data || []).map((field: any) => ({
        field_key: field.field_key,
        label: field.label,
        is_required: Boolean(field.is_required),
        value: valuesMap.get(field.field_key) || "",
        section_title: field.section_title || "General Details",
        layout_width: ["1", "2", "3", "4", "full", "half"].includes(field.layout_width)
          ? field.layout_width
          : "1",
      }))
    );
  }

  const dynamicSections = dynamicFields.reduce<Array<{ title: string; fields: DynamicProfileField[] }>>((acc, field) => {
    const sectionTitle = (field.section_title || "General Details").trim();
    const last = acc[acc.length - 1];
    if (!last || last.title !== sectionTitle) {
      acc.push({ title: sectionTitle, fields: [field] });
    } else {
      last.fields.push(field);
    }
    return acc;
  }, []);

  useEffect(() => {
    if (!user) return;

    supabase
      .from("profiles")
      .select("full_name, email, whatsapp_number, facebook_url, linkedin_url, instagram_url, visa_country, visa_type")
      .eq("user_id", user.id)
      .single()
      .then(async ({ data, error }) => {
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
            visa_country: data.visa_country || "",
            visa_type: data.visa_type || "",
          });

          await loadDynamicFields(data.visa_country || "", data.visa_type || "", user.id);
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
            <p className="text-sm text-muted-foreground mt-1">View your personal, social, visa selection, and dynamic form details.</p>
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
            <CardTitle>Visa Selection</CardTitle>
            <CardDescription>Selected country and visa type</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Info label="Visa Country" value={profile.visa_country} />
            <Info label="Visa Type" value={profile.visa_type} />
          </CardContent>
        </Card>

        {dynamicFields.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Visa Form Data</CardTitle>
              <CardDescription>All visa-type specific fields configured by admin</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {dynamicSections.map((section) => (
                <div key={section.title} className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    {section.fields.map((field) => (
                      <div key={field.field_key} className={getGridSpanClass(field.layout_width)}>
                        <Info
                          label={`${field.label}${field.is_required ? " *" : ""}`}
                          value={field.value}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
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
