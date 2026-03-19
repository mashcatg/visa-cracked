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

function toIsoDate(raw: string): string {
  const value = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const numeric = value.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (numeric) {
    const month = Number(numeric[1]);
    const day = Number(numeric[2]);
    const year = Number(numeric[3].length === 2 ? `20${numeric[3]}` : numeric[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1900 && year <= 2100) {
      return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
    }
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    const year = parsed.getUTCFullYear();
    const month = `${parsed.getUTCMonth() + 1}`.padStart(2, "0");
    const day = `${parsed.getUTCDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  return raw.trim();
}

function extractHeuristicValue(text: string, fieldKey: string, label: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const keyVariants = [fieldKey, fieldKey.replace(/_/g, " "), label, label.toLowerCase()]
    .map((variant) => variant.trim().toLowerCase())
    .filter(Boolean);

  for (const line of lines) {
    const lower = line.toLowerCase();
    for (const keyVariant of keyVariants) {
      if (!lower.includes(keyVariant)) continue;

      const regex = new RegExp(`${keyVariant.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*[:\\-]\\s*(.+)$`, "i");
      const match = line.match(regex);
      if (match?.[1]) {
        return match[1].trim();
      }
    }
  }

  const keyPattern = fieldKey.toLowerCase();
  if (keyPattern.includes("dob") || keyPattern.includes("date")) {
    const dateMatch = text.match(/\b(\d{4}-\d{2}-\d{2}|\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|[A-Za-z]{3,9}\s+\d{1,2},\s*\d{4})\b/);
    if (dateMatch?.[1]) {
      return toIsoDate(dateMatch[1]);
    }
  }

  return "";
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

    const { file_base64, file_type, visa_type_id } = await req.json();
    if (!file_base64) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    if (!visa_type_id) {
      return new Response(JSON.stringify({ error: "visa_type_id is required" }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const { data: dynamicFieldsInput, error: fieldsError } = await supabase
      .from("visa_type_form_fields")
      .select("field_key, label, field_type, options, is_required")
      .eq("visa_type_id", visa_type_id)
      .order("sort_order");

    if (fieldsError) {
      return new Response(JSON.stringify({ error: "Failed to load dynamic fields" }), {
        status: 500,
        headers: jsonHeaders,
      });
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

    let ocrRes = await fetch("https://api.mistral.ai/v1/ocr", {
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
      const dataUrl = `data:${mimeType};base64,${file_base64}`;
      ocrRes = await fetch("https://api.mistral.ai/v1/ocr", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${MISTRAL_API_KEY}`,
        },
        body: JSON.stringify({
          document: {
            type: "document_url",
            document_url: dataUrl,
          },
          model: "mistral-ocr-latest",
          include_image_base64: false,
        }),
      });
    }

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

    const sanitizedFields = (dynamicFieldsInput || [])
      .filter((field: any) => typeof field?.field_key === "string" && field.field_key.trim().length > 0)
      .map((field: any) => ({
        field_key: normalizeKey(String(field.field_key)),
        label: typeof field.label === "string" ? field.label : field.field_key,
        field_type: typeof field.field_type === "string" ? field.field_type : "text",
        options: Array.isArray(field.options) ? field.options : [],
        is_required: Boolean(field.is_required),
      }));

    console.log("extract-document schema", {
      visa_type_id,
      field_count: sanitizedFields.length,
      field_keys: sanitizedFields.map((field: any) => field.field_key),
    });

    if (sanitizedFields.length === 0) {
      return new Response(JSON.stringify({ error: "No valid dynamic fields provided" }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const allowedFieldKeys = sanitizedFields.map((field: any) => field.field_key);
    const ocrTextLength = extractedText.length;

    const heuristicNormalized = Object.fromEntries(
      sanitizedFields.map((field: any) => {
        const extracted = extractHeuristicValue(extractedText, field.field_key, field.label);
        return [field.field_key, field.field_type === "date" && extracted ? toIsoDate(extracted) : extracted];
      })
    );

    const heuristicFilledCount = Object.values(heuristicNormalized).filter((value) => String(value || "").trim().length > 0).length;
    const minHeuristicReturn = Math.max(2, Math.ceil(sanitizedFields.length * 0.75));

    if (heuristicFilledCount >= minHeuristicReturn) {
      console.log("Heuristic extraction used (AI skipped)", {
        heuristicFilledCount,
        total: sanitizedFields.length,
      });

      extractedText = "";
      return new Response(JSON.stringify({
        ...heuristicNormalized,
        __debug: {
          extractor_version: "2026-03-18-heuristic-v1",
          source: "heuristic_only",
          visa_type_id,
          allowed_keys: allowedFieldKeys,
          returned_keys: Object.keys(heuristicNormalized),
          heuristic_filled_count: heuristicFilledCount,
          total_fields: sanitizedFields.length,
          ocr_text_length: ocrTextLength,
        },
      }), {
        headers: {
          ...jsonHeaders,
          "x-extractor-version": "2026-03-18-heuristic-v1",
        },
      });
    }

    const schemaExample = Object.fromEntries(sanitizedFields.map((field: any) => [field.field_key, ""]));
    const fieldHints = sanitizedFields
      .map((field: any) => {
        const opts = field.options.length > 0 ? `; options: ${field.options.join(", ")}` : "";
        return `- ${field.field_key}: ${field.label} (type: ${field.field_type}; required: ${field.is_required ? "yes" : "no"}${opts})`;
      })
      .join("\n");

    const baseMessages = [
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
        content: `Extract data from this document:\n\n${extractedText.slice(0, 12000)}`,
      },
    ];

    const requestWithJsonMode = {
      model: "google/gemini-2.5-flash",
      response_format: { type: "json_object" },
      messages: baseMessages,
      temperature: 0,
      max_tokens: 1600,
    };

    const schemaProperties = Object.fromEntries(
      sanitizedFields.map((field: any) => [field.field_key, { type: "string" }])
    );

    const requestWithJsonSchemaMode = {
      model: "google/gemini-2.5-flash",
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "visa_dynamic_fields",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: schemaProperties,
            required: sanitizedFields.map((field: any) => field.field_key),
          },
        },
      },
      messages: baseMessages,
      temperature: 0,
      max_tokens: 1600,
    };

    let aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestWithJsonSchemaMode),
    });

    if (!aiRes.ok) {
      const schemaError = await aiRes.text();
      console.error("AI gateway error (json schema mode):", aiRes.status, schemaError.slice(0, 1000));

      aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestWithJsonMode),
      });

      if (!aiRes.ok) {
        const firstError = await aiRes.text();
        console.error("AI gateway error (json mode):", aiRes.status, firstError.slice(0, 1000));
        return new Response(JSON.stringify({
          error: "Data extraction failed",
          details: `AI gateway failed. json_schema_mode=failed, json_mode=failed, status=${aiRes.status}`,
        }), {
          status: 500,
          headers: jsonHeaders,
        });
      }
    }

    const aiData = await aiRes.json();
    const content = aiData.choices?.[0]?.message?.content;
    let text = typeof content === "string"
      ? content
      : Array.isArray(content)
        ? content.map((part: any) => (typeof part?.text === "string" ? part.text : "")).join("\n")
        : "";

    if (!text.trim()) {
      console.error("AI extraction empty content:", JSON.stringify(aiData).slice(0, 1200));
      return new Response(JSON.stringify({ error: "Data extraction failed", details: "AI returned empty content" }), {
        status: 500,
        headers: jsonHeaders,
      });
    }

    text = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

    let structured;
    try {
      structured = JSON.parse(text);
    } catch {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return new Response(JSON.stringify({ error: "Failed to parse extracted data" }), {
          status: 500,
          headers: jsonHeaders,
        });
      }
      structured = JSON.parse(jsonMatch[0]);
    }

    const structuredEntries = Object.entries(structured || {});
    const structuredMap = new Map<string, string>();
    structuredEntries.forEach(([key, value]) => {
      structuredMap.set(normalizeKey(String(key)), typeof value === "string" ? value : value == null ? "" : String(value));
    });

    const allowedKeys = new Set(sanitizedFields.map((field: any) => field.field_key));
    const unknownKeys = Array.from(structuredMap.keys()).filter((key) => !allowedKeys.has(key));

    const normalized = Object.fromEntries(
      sanitizedFields.map((field: any) => {
        const raw = structured?.[field.field_key];
        if (typeof raw === "string") {
          return [field.field_key, raw];
        }
        const mapped = structuredMap.get(field.field_key);
        const heuristic = heuristicNormalized[field.field_key] || "";
        return [field.field_key, mapped ?? heuristic];
      })
    );

    const filledCount = Object.values(normalized).filter((value) => String(value || "").trim().length > 0).length;
    const fillRatio = sanitizedFields.length > 0 ? filledCount / sanitizedFields.length : 0;

    if ((unknownKeys.length > 0 && fillRatio < 0.7) || filledCount === 0) {
      console.warn("AI extraction had unknown keys or low fill ratio", {
        unknownKeys,
        fillRatio,
        filledCount,
        totalFields: sanitizedFields.length,
      });
    }

    console.log("Extraction result summary", {
      keysReturned: Object.keys(normalized),
      filledCount,
      total: sanitizedFields.length,
    });

    const staticLeakKeys = ["sevis_id", "visa_country", "visa_type", "start_date", "student_name"];
    const leakedStaticKeys = Object.keys(structured || {}).filter((key) => staticLeakKeys.includes(normalizeKey(key)));

    extractedText = "";

    return new Response(JSON.stringify({
      ...normalized,
      __debug: {
        extractor_version: "2026-03-18-heuristic-ai-min-v1",
        source: "ai_with_filter",
        visa_type_id,
        allowed_keys: allowedFieldKeys,
        ai_raw_keys: Object.keys(structured || {}),
        unknown_ai_keys: unknownKeys,
        leaked_static_ai_keys: leakedStaticKeys,
        returned_keys: Object.keys(normalized),
        filled_count: filledCount,
        total_fields: sanitizedFields.length,
        heuristic_filled_count: heuristicFilledCount,
        ocr_text_length: ocrTextLength,
      },
    }), {
      headers: {
        ...jsonHeaders,
        "x-extractor-version": "2026-03-18-heuristic-ai-min-v1",
      },
    });
  } catch (error) {
    console.error("extract-document error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});
