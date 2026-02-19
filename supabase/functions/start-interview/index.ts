import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
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

    // Use service role to read interview + visa type Vapi config
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

    const visaType = interview.visa_types as any;
    const vapiPrivateKey = visaType?.vapi_private_key || Deno.env.get("VAPI_PRIVATE_KEY");
    const vapiPublicKey = visaType?.vapi_public_key || Deno.env.get("VAPI_PUBLIC_KEY");
    const assistantId = visaType?.vapi_assistant_id || Deno.env.get("VAPI_ASSISTANT_ID");

    if (!vapiPrivateKey || !vapiPublicKey || !assistantId) {
      return new Response(JSON.stringify({ error: "Vapi not configured for this visa type" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create a web call via Vapi API
    const vapiResponse = await fetch("https://api.vapi.ai/call", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${vapiPrivateKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "webCall",
        assistantId: assistantId,
      }),
    });

    const callData = await vapiResponse.json();

    if (!vapiResponse.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to create Vapi call", details: callData }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update interview with Vapi call ID
    await serviceClient
      .from("interviews")
      .update({ vapi_call_id: callData.id, status: "in_progress" })
      .eq("id", interviewId);

    return new Response(
      JSON.stringify({
        publicKey: vapiPublicKey,
        callConfig: callData,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
