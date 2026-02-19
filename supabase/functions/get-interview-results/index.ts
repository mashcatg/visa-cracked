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

    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { interviewId } = await req.json();

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get the interview to find the Vapi call ID
    const { data: interview } = await serviceClient
      .from("interviews")
      .select("vapi_call_id")
      .eq("id", interviewId)
      .single();

    if (!interview?.vapi_call_id) {
      return new Response(JSON.stringify({ error: "No Vapi call found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch call data from Vapi
    const vapiPrivateKey = Deno.env.get("VAPI_PRIVATE_KEY");
    const vapiResponse = await fetch(
      `https://api.vapi.ai/call/${interview.vapi_call_id}`,
      {
        headers: { Authorization: `Bearer ${vapiPrivateKey}` },
      }
    );

    const callData = await vapiResponse.json();

    // Update interview with call data
    await serviceClient
      .from("interviews")
      .update({
        status: "completed",
        transcript: callData.artifact?.transcript ?? null,
        messages: callData.artifact?.messages ?? null,
        recording_url: callData.artifact?.recordingUrl ?? null,
        duration: callData.duration ?? null,
        cost: callData.cost ?? null,
        ended_at: new Date().toISOString(),
      })
      .eq("id", interviewId);

    return new Response(
      JSON.stringify({ success: true, callData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
