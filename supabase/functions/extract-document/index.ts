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

    const requestWithoutJsonMode = {
      model: "google/gemini-2.5-flash",
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

        aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestWithoutJsonMode),
        });

        if (!aiRes.ok) {
          const secondError = await aiRes.text();
          console.error("AI gateway error (fallback):", aiRes.status, secondError.slice(0, 1000));
          return new Response(JSON.stringify({
            error: "Data extraction failed",
            details: `AI gateway failed. json_schema_mode=failed, json_mode=failed, fallback_status=${aiRes.status}`,
          }), {
            status: 500,
            headers: jsonHeaders,
          });
        }
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

    let normalized = Object.fromEntries(
      sanitizedFields.map((field: any) => {
        const raw = structured?.[field.field_key];
        if (typeof raw === "string") {
          return [field.field_key, raw];
        }
        const mapped = structuredMap.get(field.field_key);
        return [field.field_key, mapped ?? ""];
      })
    );

    let filledCount = Object.values(normalized).filter((value) => String(value || "").trim().length > 0).length;
    const fillRatio = sanitizedFields.length > 0 ? filledCount / sanitizedFields.length : 0;

    if ((unknownKeys.length > 0 && fillRatio < 0.7) || filledCount === 0) {
      console.warn("AI extraction had unknown keys or low fill ratio", {
        unknownKeys,
        fillRatio,
        filledCount,
        totalFields: sanitizedFields.length,
      });

      const remapMessages = [
        {
          role: "system",
          content: `You must map extracted values to ONLY the exact schema keys.

Allowed keys only:
${JSON.stringify(schemaExample, null, 2)}

Forbidden keys include legacy/static keys like sevis_id, visa_country, visa_type, start_date, student_name.

Rules:
- Return ONLY a JSON object with exactly the allowed keys.
- If a value cannot be found, return empty string.
- Do not invent values.
- Do not include any key outside allowed keys.`,
        },
        {
          role: "user",
          content: `Field hints:\n${fieldHints}\n\nDocument text:\n${extractedText.slice(0, 12000)}\n\nPrevious model output:\n${JSON.stringify(structured, null, 2)}\n\nNow remap strictly to allowed keys only.`,
        },
      ];

      const remapRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          response_format: { type: "json_object" },
          messages: remapMessages,
          temperature: 0,
          max_tokens: 1600,
        }),
      });

      if (remapRes.ok) {
        const remapData = await remapRes.json();
        const remapContent = remapData.choices?.[0]?.message?.content;
        let remapText = typeof remapContent === "string"
          ? remapContent
          : Array.isArray(remapContent)
            ? remapContent.map((part: any) => (typeof part?.text === "string" ? part.text : "")).join("\n")
            : "";

        remapText = remapText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

        try {
          const remapStructured = JSON.parse(remapText);
          const remapEntries = Object.entries(remapStructured || {});
          const remapMap = new Map<string, string>();
          remapEntries.forEach(([key, value]) => {
            remapMap.set(normalizeKey(String(key)), typeof value === "string" ? value : value == null ? "" : String(value));
          });

          const remapNormalized = Object.fromEntries(
            sanitizedFields.map((field: any) => [field.field_key, remapMap.get(field.field_key) ?? ""])
          );

          const remapFilledCount = Object.values(remapNormalized).filter((value) => String(value || "").trim().length > 0).length;
          if (remapFilledCount >= filledCount) {
            normalized = remapNormalized;
            filledCount = remapFilledCount;
          }
        } catch (remapParseError) {
          console.error("Failed to parse remap output", remapParseError);
        }
      } else {
        console.error("AI remap retry failed", remapRes.status, await remapRes.text());
      }
    }

    console.log("Extraction result summary", {
      keysReturned: Object.keys(normalized),
      filledCount,
      total: sanitizedFields.length,
    });

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
