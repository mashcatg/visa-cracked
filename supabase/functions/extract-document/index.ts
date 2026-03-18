import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json",
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
};

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: jsonHeaders,
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
        headers: jsonHeaders,
      });
    }

    const { file_base64, file_type, fields, visa_type_id } = await req.json();
    if (!file_base64) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    let dynamicFieldsInput: any[] = [];
    if (visa_type_id) {
      const { data: fetchedFields } = await supabase
        .from("visa_type_form_fields")
        .select("field_key, label, field_type, options, is_required")
        .eq("visa_type_id", visa_type_id)
        .order("sort_order");
      dynamicFieldsInput = fetchedFields || [];
    } else if (Array.isArray(fields)) {
      dynamicFieldsInput = fields;
    }

    // Step 1: Mistral OCR
    const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY");
    if (!MISTRAL_API_KEY) {
      return new Response(JSON.stringify({ error: "OCR service not configured" }), {
        status: 500,
        headers: jsonHeaders,
      });
    }

    const mimeType = file_type || "application/pdf";
    const documentUrl = `data:${mimeType};base64,${file_base64}`;

    // Test with direct base64 document format instead of data URL
    const ocrRes = await fetch("https://api.mistral.ai/v1/ocr", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MISTRAL_API_KEY}`,
      },
      body: JSON.stringify({
        document: {
          type: "document_base64",
          document_base64: file_base64,
          media_type: mimeType,
        },
        model: "mistral-ocr-latest",
        include_image_base64: false,
      }),
    });

    if (!ocrRes.ok) {
      const errorText = await ocrRes.text();
      console.error("Mistral OCR error:", ocrRes.status, errorText);
      return new Response(JSON.stringify({ 
        error: "OCR extraction failed", 
        details: `Mistral API returned ${ocrRes.status}. Please check file format and size.`
      }), {
        status: 500,
        headers: jsonHeaders,
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
        headers: jsonHeaders,
      });
    }

    // Step 2: Gemini 2.5 Flash to structure data
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: jsonHeaders,
      });
    }

    const sanitizedFields = dynamicFieldsInput
      .filter((field: any) => typeof field?.field_key === "string" && field.field_key.trim().length > 0)
      .map((field: any) => ({
        field_key: normalizeKey(String(field.field_key)),
        label: typeof field.label === "string" ? field.label : field.field_key,
        field_type: typeof field.field_type === "string" ? field.field_type : "text",
        options: Array.isArray(field.options) ? field.options : [],
        is_required: Boolean(field.is_required),
      }));

    if (sanitizedFields.length === 0) {
      return new Response(JSON.stringify({ error: "No valid dynamic fields provided" }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const schemaExample = Object.fromEntries(sanitizedFields.map((field: any) => [field.field_key, ""]));
    const fieldHints = sanitizedFields
      .map((field: any) => {
        const opts = field.options.length > 0 ? `; options: ${field.options.join(", ")}` : "";
        return `- ${field.field_key}: ${field.label} (type: ${field.field_type}; required: ${field.is_required ? "yes" : "no"}${opts})`;
      })
      .join("\n");

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
            content: `You are a data extraction assistant. Extract structured information from document text.

Return ONLY a valid JSON object with EXACTLY these keys (use empty string if not found):
${JSON.stringify(schemaExample, null, 2)}

Field descriptions:
${fieldHints}

Rules:
- Do not add any extra keys.
- Use plain string values only.
- For date fields, prefer YYYY-MM-DD when possible.
- For select fields, choose the closest matching option from provided options.
- Do NOT include markdown, code blocks, or explanations. Return ONLY JSON.`,
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
        headers: jsonHeaders,
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
        headers: jsonHeaders,
      });
    }

    const structuredEntries = Object.entries(structured || {});
    const structuredMap = new Map<string, string>();
    structuredEntries.forEach(([key, value]) => {
      structuredMap.set(normalizeKey(String(key)), typeof value === "string" ? value : value == null ? "" : String(value));
    });

    const normalized = Object.fromEntries(
      sanitizedFields.map((field: any) => {
        const raw = structured?.[field.field_key];
        if (typeof raw === "string") {
          return [field.field_key, raw];
        }
        const mapped = structuredMap.get(field.field_key);
        return [field.field_key, mapped ?? ""];
      })
    );

    extractedText = "";

    return new Response(JSON.stringify(normalized), {
      headers: jsonHeaders,
    });
  } catch (error) {
    console.error("extract-document error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});
