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

    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;
    const { interviewId } = await req.json();

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get the interview to find the Vapi call ID
    const { data: interview } = await serviceClient
      .from("interviews")
      .select("vapi_call_id, user_id")
      .eq("id", interviewId)
      .single();

    if (!interview?.vapi_call_id) {
      return new Response(JSON.stringify({ error: "No Vapi call found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch call data from Vapi with retry logic
    const vapiPrivateKey = Deno.env.get("VAPI_PRIVATE_KEY");
    let callData: any = null;
    
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await sleep(5000); // Wait 5s between retries
      
      const vapiResponse = await fetch(
        `https://api.vapi.ai/call/${interview.vapi_call_id}`,
        { headers: { Authorization: `Bearer ${vapiPrivateKey}` } }
      );
      callData = await vapiResponse.json();
      
      // If we have transcript or messages, we're good
      if (callData.artifact?.transcript || callData.artifact?.messages?.length > 0) {
        break;
      }
    }

    // Check call status - if failed, mark as failed and do NOT deduct credits
    const callStatus = callData.status;
    const endedReason = callData.endedReason;
    const isFailed = callStatus !== "ended" || 
      endedReason === "pipeline-error-openai-llm-failed" ||
      endedReason === "assistant-not-found" ||
      endedReason === "pipeline-error" ||
      (!callData.artifact?.transcript && (!callData.artifact?.messages || callData.artifact.messages.length === 0));

    if (isFailed) {
      // Mark interview as failed, NO credit deduction
      await serviceClient
        .from("interviews")
        .update({
          status: "failed",
          ended_at: new Date().toISOString(),
        })
        .eq("id", interviewId);

      return new Response(
        JSON.stringify({ success: true, status: "failed", reason: endedReason || "Call did not complete successfully" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call was successful - only update status (no data storage)
    await serviceClient
      .from("interviews")
      .update({
        status: "completed",
        ended_at: new Date().toISOString(),
      })
      .eq("id", interviewId);

    // Deduct 10 credits ONLY on successful call
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("credits")
      .eq("user_id", interview.user_id)
      .single();

    if (profile) {
      await serviceClient
        .from("profiles")
        .update({ credits: Math.max(0, (profile.credits ?? 0) - 10) })
        .eq("user_id", interview.user_id);
    }

    return new Response(
      JSON.stringify({ success: true, status: "completed", callData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
