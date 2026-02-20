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
    const date = new Date(interview.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    const grammarMistakes = Array.isArray(report?.grammar_mistakes) ? report.grammar_mistakes : [];
    const redFlags = Array.isArray(report?.red_flags) ? report.red_flags : [];
    const improvementPlan = Array.isArray(report?.improvement_plan) ? report.improvement_plan : [];

    const line = (char: string, len: number) => char.repeat(len);
    const pad = (str: string, len: number) => str + " ".repeat(Math.max(0, len - str.length));

    let c = "";
    c += `╔${line("═", 58)}╗\n`;
    c += `║${pad("  VISA CRACKED — MOCK TEST REPORT", 58)}║\n`;
    c += `╚${line("═", 58)}╝\n\n`;

    c += `  Mock Name:  ${interview.name || "N/A"}\n`;
    c += `  Country:    ${countryName}\n`;
    c += `  Visa Type:  ${visaType}\n`;
    c += `  Date:       ${date}\n`;
    c += `\n${line("─", 60)}\n`;
    c += `  SCORES\n${line("─", 60)}\n\n`;

    const scores = [
      ["Overall Score", report?.overall_score, "/100"],
      ["English", report?.english_score, "/100"],
      ["Confidence", report?.confidence_score, "/100"],
      ["Financial Clarity", report?.financial_clarity_score, "/100"],
      ["Immigration Intent", report?.immigration_intent_score, "/100"],
      ["Pronunciation", report?.pronunciation_score, "/100"],
      ["Vocabulary", report?.vocabulary_score, "/100"],
      ["Response Relevance", report?.response_relevance_score, "/100"],
    ];

    for (const [label, score, suffix] of scores) {
      const val = score != null ? `${score}${suffix}` : "N/A";
      c += `  ${pad(label as string, 22)} ${val}\n`;
    }

    if (grammarMistakes.length > 0) {
      c += `\n${line("─", 60)}\n`;
      c += `  GRAMMAR MISTAKES (${grammarMistakes.length})\n${line("─", 60)}\n\n`;
      grammarMistakes.forEach((m: any, i: number) => {
        c += `  ${i + 1}. "${m.original}" → "${m.corrected}"\n`;
        if (m.explanation) c += `     ${m.explanation}\n`;
      });
    }

    if (redFlags.length > 0) {
      c += `\n${line("─", 60)}\n`;
      c += `  RED FLAGS\n${line("─", 60)}\n\n`;
      redFlags.forEach((f: string, i: number) => {
        c += `  ${i + 1}. ${f}\n`;
      });
    }

    if (improvementPlan.length > 0) {
      c += `\n${line("─", 60)}\n`;
      c += `  IMPROVEMENT PLAN\n${line("─", 60)}\n\n`;
      improvementPlan.forEach((item: string, i: number) => {
        c += `  ${i + 1}. ${item}\n`;
      });
    }

    if (report?.summary) {
      c += `\n${line("─", 60)}\n`;
      c += `  AI SUMMARY\n${line("─", 60)}\n\n`;
      c += `  ${report.summary.replace(/\n/g, "\n  ")}\n`;
    }

    if (interview.transcript) {
      c += `\n${line("─", 60)}\n`;
      c += `  FULL TRANSCRIPT\n${line("─", 60)}\n\n`;
      c += `  ${interview.transcript.replace(/\n/g, "\n  ")}\n`;
    }

    c += `\n${line("─", 60)}\n`;
    c += `  Generated by Visa Cracked • visa-cracked.lovable.app\n`;
    c += `${line("─", 60)}\n`;

    const encoder = new TextEncoder();
    const bytes = encoder.encode(c);
    const base64 = btoa(String.fromCharCode(...bytes));

    const safeName = (interview.name || "report").replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
    return new Response(
      JSON.stringify({ pdf: base64, filename: `visa-cracked-${safeName}-${new Date().toISOString().slice(0, 10)}.txt` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
