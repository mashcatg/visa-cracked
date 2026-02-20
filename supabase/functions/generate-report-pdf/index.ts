import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    const { data: interview } = await serviceClient
      .from("interviews")
      .select("*, countries(name), visa_types(name), interview_reports(*)")
      .eq("id", interviewId)
      .single();

    if (!interview) {
      return new Response(JSON.stringify({ error: "Interview not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const report = interview.interview_reports;
    const countryName = (interview.countries as any)?.name || "Unknown";
    const visaType = (interview.visa_types as any)?.name || "Unknown";

    const grammarMistakes = Array.isArray(report?.grammar_mistakes) ? report.grammar_mistakes : [];
    const redFlags = Array.isArray(report?.red_flags) ? report.red_flags : [];
    const improvementPlan = Array.isArray(report?.improvement_plan) ? report.improvement_plan : [];

    let content = `VISA CRACKED - MOCK TEST REPORT\n`;
    content += `${"=".repeat(50)}\n\n`;
    content += `Mock Name: ${interview.name || "N/A"}\n`;
    content += `Country: ${countryName}\n`;
    content += `Visa Type: ${visaType}\n`;
    content += `Date: ${new Date(interview.created_at).toLocaleDateString()}\n\n`;

    content += `SCORES\n${"-".repeat(30)}\n`;
    content += `Overall Score: ${report?.overall_score ?? "N/A"} / 100\n`;
    content += `English: ${report?.english_score ?? "N/A"}\n`;
    content += `Confidence: ${report?.confidence_score ?? "N/A"}\n`;
    content += `Financial Clarity: ${report?.financial_clarity_score ?? "N/A"}\n`;
    content += `Immigration Intent: ${report?.immigration_intent_score ?? "N/A"}\n`;
    content += `Pronunciation: ${report?.pronunciation_score ?? "N/A"}\n`;
    content += `Vocabulary: ${report?.vocabulary_score ?? "N/A"}\n`;
    content += `Response Relevance: ${report?.response_relevance_score ?? "N/A"}\n\n`;

    if (grammarMistakes.length > 0) {
      content += `GRAMMAR MISTAKES\n${"-".repeat(30)}\n`;
      grammarMistakes.forEach((m: any, i: number) => {
        content += `${i + 1}. "${m.original}" → "${m.corrected}"\n`;
        if (m.explanation) content += `   ${m.explanation}\n`;
      });
      content += "\n";
    }

    if (redFlags.length > 0) {
      content += `RED FLAGS\n${"-".repeat(30)}\n`;
      redFlags.forEach((f: string, i: number) => {
        content += `${i + 1}. ${f}\n`;
      });
      content += "\n";
    }

    if (improvementPlan.length > 0) {
      content += `IMPROVEMENT PLAN\n${"-".repeat(30)}\n`;
      improvementPlan.forEach((item: string, i: number) => {
        content += `${i + 1}. ${item}\n`;
      });
      content += "\n";
    }

    if (report?.summary) {
      content += `SUMMARY\n${"-".repeat(30)}\n${report.summary}\n\n`;
    }

    if (interview.transcript) {
      content += `FULL TRANSCRIPT\n${"-".repeat(30)}\n${interview.transcript}\n`;
    }

    const encoder = new TextEncoder();
    const bytes = encoder.encode(content);
    const base64 = btoa(String.fromCharCode(...bytes));

    return new Response(
      JSON.stringify({ pdf: base64, filename: `mock-report-${interviewId}.txt` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
