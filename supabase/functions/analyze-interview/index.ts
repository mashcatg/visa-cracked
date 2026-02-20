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

    // Don't analyze failed interviews
    if (interview.status === "failed") {
      return new Response(
        JSON.stringify({ success: false, error: "Interview failed, no analysis needed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const transcript = interview.transcript || "";
    const messages = interview.messages || [];
    const countryName = (interview.countries as any)?.name || "Unknown";
    const visaType = (interview.visa_types as any)?.name || "Unknown";

    // Build conversation context from messages array
    let conversationContext = "";
    if (Array.isArray(messages) && messages.length > 0) {
      conversationContext = messages
        .filter((m: any) => m.role === "assistant" || m.role === "user")
        .map((m: any) => `${m.role === "assistant" ? "Officer" : "Applicant"}: ${m.content || m.message || ""}`)
        .join("\n\n");
    }
    
    const textToAnalyze = conversationContext || transcript;
    
    if (!textToAnalyze || textToAnalyze.trim().length < 20) {
      return new Response(JSON.stringify({ error: "Insufficient transcript data for analysis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call Lovable AI Gateway
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: `You are an expert visa interview evaluator and language coach specializing in ${countryName} ${visaType} visa interviews. You must return ONLY valid JSON with no markdown, no code blocks, no extra text.`,
            },
            {
              role: "user",
              content: `Analyze this ${countryName} ${visaType} visa mock interview and return a comprehensive evaluation as JSON.

Return ONLY valid JSON with this exact structure:
{
  "overall_score": <number 0-100>,
  "english_score": <number 0-100>,
  "confidence_score": <number 0-100>,
  "financial_clarity_score": <number 0-100>,
  "immigration_intent_score": <number 0-100>,
  "pronunciation_score": <number 0-100>,
  "vocabulary_score": <number 0-100>,
  "response_relevance_score": <number 0-100>,
  "grammar_mistakes": [
    {"original": "<exact phrase said>", "corrected": "<corrected version>", "explanation": "<brief explanation of the error>"}
  ],
  "red_flags": ["<description of concern that a real visa officer would flag>"],
  "improvement_plan": ["<specific, actionable recommendation>"],
  "detailed_feedback": [
    {
      "question": "<officer's question>",
      "answer": "<applicant's response summary>",
      "score": <0-100>,
      "feedback": "<what was good/bad about this answer>",
      "suggested_answer": "<a better way to answer this>"
    }
  ],
  "summary": "<3-4 sentence comprehensive summary of performance>"
}

Scoring guidelines:
- Overall: Weighted average of all category scores
- English: Grammar accuracy, sentence structure, vocabulary usage, fluency
- Confidence: Directness of answers, absence of hesitation words (um, uh, like), clarity
- Financial Clarity: How well financial situation, sponsorship, funding sources are explained
- Immigration Intent: Clarity of purpose, return plan, ties to home country, genuine intent
- Pronunciation: Clarity of speech, word pronunciation, accent comprehensibility
- Vocabulary: Range and appropriateness of vocabulary for formal interview context
- Response Relevance: How directly and completely each question was answered

Be extremely thorough:
- Find EVERY grammar mistake, even minor ones
- Flag EVERY potential red flag a real visa officer would notice
- Provide at least 5 improvement recommendations
- Give per-question feedback for each Q&A exchange
- Be honest but constructive in feedback

Interview Transcript:
${textToAnalyze}`,
            },
          ],
          temperature: 0.3,
          max_tokens: 8192,
        }),
      }
    );

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    let analysisText = aiData.choices?.[0]?.message?.content || "";

    // Clean markdown code blocks if present
    analysisText = analysisText
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();

    let analysis;
    try {
      analysis = JSON.parse(analysisText);
    } catch {
      console.error("Failed to parse AI response:", analysisText.substring(0, 500));
      analysis = {
        overall_score: 50,
        english_score: 50,
        confidence_score: 50,
        financial_clarity_score: 50,
        immigration_intent_score: 50,
        pronunciation_score: 50,
        vocabulary_score: 50,
        response_relevance_score: 50,
        grammar_mistakes: [],
        red_flags: ["Analysis parsing failed - please retry"],
        improvement_plan: ["Please try the mock test again for a complete analysis"],
        detailed_feedback: [],
        summary: "The analysis encountered a parsing error. Please try running the mock test again.",
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
        pronunciation_score: analysis.pronunciation_score,
        vocabulary_score: analysis.vocabulary_score,
        response_relevance_score: analysis.response_relevance_score,
        grammar_mistakes: analysis.grammar_mistakes,
        red_flags: analysis.red_flags,
        improvement_plan: analysis.improvement_plan,
        detailed_feedback: analysis.detailed_feedback,
        summary: analysis.summary,
      },
      { onConflict: "interview_id" }
    );

    return new Response(
      JSON.stringify({ success: true, analysis }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("analyze-interview error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
