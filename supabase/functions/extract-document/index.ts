import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

    const { data: userData, error: authError } = await supabase.auth.getUser();
    if (authError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { file_base64, file_type } = await req.json();
    if (!file_base64) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 1: Mistral OCR
    const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY");
    if (!MISTRAL_API_KEY) {
      return new Response(JSON.stringify({ error: "OCR service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mimeType = file_type || "application/pdf";
    const documentUrl = `data:${mimeType};base64,${file_base64}`;

    const ocrRes = await fetch("https://api.mistral.ai/v1/ocr", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MISTRAL_API_KEY}`,
      },
      body: JSON.stringify({
        document: {
          type: "document_url",
          document_url: documentUrl,
        },
        model: "mistral-ocr-latest",
        include_image_base64: false,
      }),
    });

    if (!ocrRes.ok) {
      const errText = await ocrRes.text();
      console.error("Mistral OCR error:", ocrRes.status, errText);
      return new Response(JSON.stringify({ error: "OCR extraction failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ocrData = await ocrRes.json();

    // Extract text from OCR response
    let extractedText = "";
    if (ocrData.pages) {
      for (const page of ocrData.pages) {
        if (page.markdown) extractedText += page.markdown + "\n";
      }
    }

    if (!extractedText.trim()) {
      return new Response(JSON.stringify({ error: "No text could be extracted from the document" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 2: Gemini 2.5 Flash to structure data
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: `You are a data extraction assistant. Extract structured information from the document text provided. Return ONLY a valid JSON object with these fields (use empty string if not found):
{
  "university_name": "Name of the university/school",
  "program_name": "Name of the program/major",
  "sevis_id": "SEVIS number (format: N00XXXXXXXXX)",
  "visa_country": "Country for visa (e.g., USA, UK, Canada)",
  "visa_type": "Type of visa (e.g., F1, J1, H1B)",
  "start_date": "Program start date in YYYY-MM-DD format",
  "student_name": "Name of the student"
}
Do NOT include any markdown, code blocks, or explanations. Return ONLY the JSON.`,
          },
          {
            role: "user",
            content: `Extract data from this document:\n\n${extractedText.slice(0, 8000)}`,
          },
        ],
        temperature: 0.1,
        max_tokens: 1024,
      }),
    });

    if (!aiRes.ok) {
      console.error("AI gateway error:", aiRes.status, await aiRes.text());
      return new Response(JSON.stringify({ error: "Data extraction failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiRes.json();
    let text = aiData.choices?.[0]?.message?.content || "";
    text = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

    let structured;
    try {
      structured = JSON.parse(text);
    } catch {
      return new Response(JSON.stringify({ error: "Failed to parse extracted data" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(structured), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("extract-document error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
