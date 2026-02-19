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

    // Get interview data
    const { data: interview } = await serviceClient
      .from("interviews")
      .select("*, countries(name), visa_types(name)")
      .eq("id", interviewId)
      .single();

    if (!interview) {
      return new Response(JSON.stringify({ error: "Interview not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const transcript = interview.transcript || "";
    const countryName = (interview.countries as any)?.name || "Unknown";
    const visaType = (interview.visa_types as any)?.name || "Unknown";

    // Call Gemini 2.5 Flash for analysis
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) {
      return new Response(JSON.stringify({ error: "Gemini API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `You are a professional visa interview evaluator specializing in ${countryName} ${visaType} visa interviews.

Analyze the following interview transcript and generate a detailed evaluation report in JSON format.

Return ONLY valid JSON with this exact structure (no markdown, no code blocks):
{
  "overall_score": <number 0-100>,
  "english_score": <number 0-100>,
  "confidence_score": <number 0-100>,
  "financial_clarity_score": <number 0-100>,
  "immigration_intent_score": <number 0-100>,
  "grammar_mistakes": [
    {"original": "<exact phrase said>", "corrected": "<corrected version>"}
  ],
  "red_flags": ["<description of concern>"],
  "improvement_plan": ["<actionable recommendation>"],
  "summary": "<2-3 sentence summary of performance>"
}

Scoring guidelines:
- Overall: Weighted average considering all factors
- English: Grammar, vocabulary, fluency, pronunciation clarity
- Confidence: Clarity of answers, hesitation, directness
- Financial Clarity: How well financial situation/sponsorship is explained
- Immigration Intent: Clarity of purpose, return plan, ties to home country

Be thorough with grammar mistakes — find every instance.
Red flags should highlight anything an actual visa officer would find concerning.
Improvement plan should be specific and actionable.

Transcript:
${transcript}`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 4096,
          },
        }),
      }
    );

    const geminiData = await geminiResponse.json();
    let analysisText =
      geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Clean markdown code blocks if present
    analysisText = analysisText
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();

    let analysis;
    try {
      analysis = JSON.parse(analysisText);
    } catch {
      analysis = {
        overall_score: 50,
        english_score: 50,
        confidence_score: 50,
        financial_clarity_score: 50,
        immigration_intent_score: 50,
        grammar_mistakes: [],
        red_flags: ["Analysis could not be completed"],
        improvement_plan: ["Please try the interview again"],
        summary: "The analysis could not be completed due to insufficient data.",
      };
    }

    // Store the report
    await serviceClient.from("interview_reports").upsert(
      {
        interview_id: interviewId,
        overall_score: analysis.overall_score,
        english_score: analysis.english_score,
        confidence_score: analysis.confidence_score,
        financial_clarity_score: analysis.financial_clarity_score,
        immigration_intent_score: analysis.immigration_intent_score,
        grammar_mistakes: analysis.grammar_mistakes,
        red_flags: analysis.red_flags,
        improvement_plan: analysis.improvement_plan,
        summary: analysis.summary,
      },
      { onConflict: "interview_id" }
    );

    return new Response(
      JSON.stringify({ success: true, analysis }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
