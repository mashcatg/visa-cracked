import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

    // Verify user
    const { data: userData, error: authError } = await supabase.auth.getUser();
    if (authError || !userData?.user) {
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

    // Get interview - verify ownership
    const { data: interview } = await serviceClient
      .from("interviews")
      .select("vapi_call_id, user_id, visa_type_id")
      .eq("id", interviewId)
      .single();

    if (!interview) {
      return new Response(JSON.stringify({ error: "Interview not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (interview.user_id !== userData.user.id) {
      // Check if user is admin
      const { data: isAdmin } = await serviceClient.rpc("has_role", {
        _user_id: userData.user.id,
        _role: "admin",
      });
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!interview.vapi_call_id) {
      return new Response(JSON.stringify({ error: "No Vapi call ID found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get per-visa private key, fallback to global
    let vapiPrivateKey = Deno.env.get("VAPI_PRIVATE_KEY");
    if (interview.visa_type_id) {
      const { data: visaType } = await serviceClient
        .from("visa_types")
        .select("vapi_private_key")
        .eq("id", interview.visa_type_id)
        .single();
      if (visaType?.vapi_private_key) {
        vapiPrivateKey = visaType.vapi_private_key;
      }
    }

    // Fetch from Vapi with retry (recording may not be ready immediately)
    let callData: any = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) await sleep(5000);

      const vapiResponse = await fetch(
        `https://api.vapi.ai/call/${interview.vapi_call_id}`,
        { headers: { Authorization: `Bearer ${vapiPrivateKey}` } }
      );
      callData = await vapiResponse.json();

      // If we have a recording URL, we're good
      if (callData.artifact?.recordingUrl) break;
    }

    return new Response(
      JSON.stringify({
        recordingUrl: callData?.artifact?.recordingUrl ?? null,
        stereoRecordingUrl: callData?.artifact?.stereoRecordingUrl ?? null,
        transcript: callData?.artifact?.transcript ?? null,
        messages: callData?.artifact?.messages ?? [],
        duration: callData?.duration ?? null,
        endedReason: callData?.endedReason ?? null,
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
