import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function callAI(apiKey: string, systemPrompt: string, userPrompt: string): Promise<any> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 4096,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("AI gateway error:", res.status, errText);
    throw new Error(`AI gateway error: ${res.status}`);
  }

  const data = await res.json();
  let text = data.choices?.[0]?.message?.content || "";
  text = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  return JSON.parse(text);
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

    const { data: userData, error: authError } = await supabase.auth.getUser();
    if (authError || !userData?.user) {
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
      .select("*, countries(name), visa_types(name)")
      .eq("id", interviewId)
      .single();

    if (!interview) {
      return new Response(JSON.stringify({ error: "Interview not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (interview.status === "failed") {
      return new Response(
        JSON.stringify({ success: false, error: "Interview failed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch live transcript from Vapi
    let vapiMessages: any[] = [];
    let vapiTranscript = "";
    let endedReason = "";

    if (interview.vapi_call_id) {
      const vapiKey = Deno.env.get("VAPI_PRIVATE_KEY");
      if (vapiKey) {
        try {
          // Try with per-visa key first
          let privateKey = vapiKey;
          if (interview.visa_type_id) {
            const { data: visaType } = await serviceClient
              .from("visa_types")
              .select("vapi_private_key")
              .eq("id", interview.visa_type_id)
              .single();
            if (visaType?.vapi_private_key) privateKey = visaType.vapi_private_key;
          }

          const vapiRes = await fetch(
            `https://api.vapi.ai/call/${interview.vapi_call_id}`,
            { headers: { Authorization: `Bearer ${privateKey}` } }
          );
          const callData = await vapiRes.json();
          vapiMessages = callData?.artifact?.messages ?? [];
          vapiTranscript = callData?.artifact?.transcript ?? "";
          endedReason = callData?.endedReason ?? "";
        } catch (e) {
          console.error("Failed to fetch Vapi data for analysis:", e);
        }
      }
    }

    // Build conversation text
    const messages = vapiMessages.length > 0 ? vapiMessages : (interview.messages || []);
    let conversationContext = "";
    if (Array.isArray(messages) && messages.length > 0) {
      conversationContext = messages
        .filter((m: any) => m.role === "assistant" || m.role === "user")
        .map((m: any) => `${m.role === "assistant" ? "Officer" : "Applicant"}: ${m.content || m.message || ""}`)
        .join("\n\n");
    }

    const textToAnalyze = conversationContext || vapiTranscript || interview.transcript || "";

    if (!textToAnalyze || textToAnalyze.trim().length < 20) {
      return new Response(JSON.stringify({ error: "Insufficient transcript data" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const countryName = (interview.countries as any)?.name || "Unknown";
    const visaType = (interview.visa_types as any)?.name || "Unknown";

    // Context about auto-cut
    const autoCutNote = (endedReason && (endedReason.includes("max-duration") || endedReason === "customer-ended-call-too-short"))
      ? "\n\nIMPORTANT: This interview was automatically terminated because the maximum time limit was reached. The applicant did not finish the interview naturally. This should be considered a NEGATIVE factor in the evaluation — it shows poor time management or inability to provide concise answers."
      : "";

    const baseSystemPrompt = `You are an expert visa interview evaluator specializing in ${countryName} ${visaType} visa interviews. Return ONLY valid JSON with no markdown, no code blocks, no extra text.`;
    const baseTranscript = `\n\nInterview Transcript:\n${textToAnalyze}${autoCutNote}`;

    // Upsert a blank row so report page knows analysis started
    await serviceClient.from("interview_reports").upsert(
      { interview_id: interviewId },
      { onConflict: "interview_id" }
    );

    // Fire 4 parallel workers
    const worker1 = async () => {
      try {
        const result = await callAI(LOVABLE_API_KEY, baseSystemPrompt, `Analyze this ${countryName} ${visaType} visa mock interview and return JSON with exactly these fields:
{
  "mock_name": "<creative 3-5 word name for this mock test>",
  "overall_score": <number 0-100, weighted average considering all aspects>,
  "summary": "<3-4 sentence comprehensive summary of performance>"
}

Be honest and thorough.${baseTranscript}`);

        if (result.mock_name) {
          await serviceClient.from("interviews").update({ name: result.mock_name }).eq("id", interviewId);
        }
        await serviceClient.from("interview_reports").update({
          overall_score: result.overall_score,
          summary: result.summary,
        }).eq("interview_id", interviewId);
        console.log("Worker 1 (summary) completed");
      } catch (e) {
        console.error("Worker 1 failed:", e);
      }
    };

    const worker2 = async () => {
      try {
        const result = await callAI(LOVABLE_API_KEY, baseSystemPrompt, `Analyze this ${countryName} ${visaType} visa mock interview and return JSON with exactly these 7 scores (each 0-100):
{
  "english_score": <grammar accuracy, sentence structure, fluency>,
  "confidence_score": <directness, absence of hesitation, clarity>,
  "financial_clarity_score": <how well financial situation explained>,
  "immigration_intent_score": <clarity of purpose, return plan, ties to home>,
  "pronunciation_score": <clarity of speech, comprehensibility>,
  "vocabulary_score": <range and appropriateness for formal interview>,
  "response_relevance_score": <how directly each question was answered>
}${baseTranscript}`);

        await serviceClient.from("interview_reports").update({
          english_score: result.english_score,
          confidence_score: result.confidence_score,
          financial_clarity_score: result.financial_clarity_score,
          immigration_intent_score: result.immigration_intent_score,
          pronunciation_score: result.pronunciation_score,
          vocabulary_score: result.vocabulary_score,
          response_relevance_score: result.response_relevance_score,
        }).eq("interview_id", interviewId);
        console.log("Worker 2 (scores) completed");
      } catch (e) {
        console.error("Worker 2 failed:", e);
      }
    };

    const worker3 = async () => {
      try {
        const result = await callAI(LOVABLE_API_KEY, baseSystemPrompt, `Analyze this ${countryName} ${visaType} visa mock interview and return JSON with:
{
  "grammar_mistakes": [
    {"original": "<exact phrase>", "corrected": "<corrected version>", "explanation": "<brief explanation>"}
  ],
  "red_flags": ["<concerns a real visa officer would flag>"],
  "improvement_plan": ["<specific, actionable recommendation>"]
}

Find EVERY grammar mistake. Flag EVERY red flag. Provide at least 5 improvement recommendations. Be thorough.${baseTranscript}`);

        await serviceClient.from("interview_reports").update({
          grammar_mistakes: result.grammar_mistakes || [],
          red_flags: result.red_flags || [],
          improvement_plan: result.improvement_plan || [],
        }).eq("interview_id", interviewId);
        console.log("Worker 3 (issues) completed");
      } catch (e) {
        console.error("Worker 3 failed:", e);
      }
    };

    const worker4 = async () => {
      try {
        const result = await callAI(LOVABLE_API_KEY, baseSystemPrompt, `Analyze this ${countryName} ${visaType} visa mock interview. For EACH question-answer exchange, return JSON:
{
  "detailed_feedback": [
    {
      "question": "<officer's question>",
      "answer": "<applicant's response summary>",
      "score": <0-100>,
      "feedback": "<what was good/bad>",
      "suggested_answer": "<a better way to answer>"
    }
  ]
}

Cover every Q&A exchange. Be constructive.${baseTranscript}`);

        await serviceClient.from("interview_reports").update({
          detailed_feedback: result.detailed_feedback || [],
        }).eq("interview_id", interviewId);
        console.log("Worker 4 (feedback) completed");
      } catch (e) {
        console.error("Worker 4 failed:", e);
      }
    };

    // Run all in parallel and wait
    await Promise.allSettled([worker1(), worker2(), worker3(), worker4()]);

    // Recompute overall_score as the true average of the 7 individual scores
    try {
      const { data: finalReport } = await serviceClient
        .from("interview_reports")
        .select("english_score, confidence_score, financial_clarity_score, immigration_intent_score, pronunciation_score, vocabulary_score, response_relevance_score")
        .eq("interview_id", interviewId)
        .single();

      if (finalReport) {
        const scores = [
          finalReport.english_score,
          finalReport.confidence_score,
          finalReport.financial_clarity_score,
          finalReport.immigration_intent_score,
          finalReport.pronunciation_score,
          finalReport.vocabulary_score,
          finalReport.response_relevance_score,
        ].filter((s): s is number => s !== null && s !== undefined);

        if (scores.length > 0) {
          const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
          await serviceClient.from("interview_reports").update({ overall_score: avg }).eq("interview_id", interviewId);
          console.log("Recomputed overall_score:", avg, "from", scores.length, "categories");
        }
      }
    } catch (e) {
      console.error("Failed to recompute overall_score:", e);
    }

    return new Response(
      JSON.stringify({ success: true }),
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
