import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { interviewId } = await req.json();
    if (!interviewId) {
      return new Response(JSON.stringify({ error: "interviewId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: interview, error: intError } = await serviceClient
      .from("interviews")
      .select("*, visa_types(vapi_assistant_id, vapi_public_key, vapi_private_key)")
      .eq("id", interviewId)
      .single();

    if (intError || !interview) {
      return new Response(JSON.stringify({ error: "Interview not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch user profile data
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("full_name, whatsapp_number, visa_country, visa_type, facebook_url, linkedin_url, instagram_url")
      .eq("user_id", user.id)
      .single();

    // Fetch dynamic form data for user's visa type
    let dynamicFormData: Record<string, string> = {};
    if (interview.visa_type_id) {
      const { data: formData } = await serviceClient
        .from("user_visa_form_data")
        .select("field_key, field_value")
        .eq("user_id", user.id)
        .eq("visa_type_id", interview.visa_type_id);

      if (formData) {
        for (const entry of formData) {
          if (entry.field_value) {
            dynamicFormData[entry.field_key] = entry.field_value;
          }
        }
      }
    }

    let vapiPublicKey: string | null = null;
    let assistantId: string | null = null;

    // Try difficulty_modes first if interview has a difficulty set
    if (interview.difficulty) {
      const { data: mode } = await serviceClient
        .from("difficulty_modes")
        .select("vapi_assistant_id, vapi_public_key, vapi_private_key")
        .eq("visa_type_id", interview.visa_type_id)
        .eq("difficulty", interview.difficulty)
        .single();

      if (mode?.vapi_assistant_id) {
        vapiPublicKey = mode.vapi_public_key;
        assistantId = mode.vapi_assistant_id;
      }
    }

    // Fallback to visa_type credentials
    if (!assistantId) {
      const visaType = interview.visa_types as any;
      vapiPublicKey = visaType?.vapi_public_key || Deno.env.get("VAPI_PUBLIC_KEY") || null;
      assistantId = visaType?.vapi_assistant_id || Deno.env.get("VAPI_ASSISTANT_ID") || null;
    }

    if (!vapiPublicKey || !assistantId) {
      return new Response(JSON.stringify({ error: "Vapi not configured for this visa type" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update interview status
    await serviceClient
      .from("interviews")
      .update({ status: "in_progress" })
      .eq("id", interviewId);

    // Build variableValues only from dynamic visa form data
    const variableValues: Record<string, string> = {
      ...dynamicFormData,
    };

    return new Response(
      JSON.stringify({ publicKey: vapiPublicKey, assistantId, variableValues }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
