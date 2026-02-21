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
    // Parse form data from SSLCommerz POST
    const body = await req.text();
    const params = new URLSearchParams(body);

    const tran_id = params.get("tran_id");
    const val_id = params.get("val_id");
    const status = params.get("status");

    if (!tran_id) {
      return new Response("Missing tran_id", { status: 400 });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // If payment failed or cancelled
    if (status === "FAILED" || status === "CANCELLED") {
      await serviceClient
        .from("orders")
        .update({ status: status === "FAILED" ? "failed" : "cancelled" })
        .eq("tran_id", tran_id);
      return new Response("OK", { status: 200 });
    }

    // Validate with SSLCommerz
    const storeId = Deno.env.get("SSLCOMMERZ_STORE_ID")!;
    const storePasswd = Deno.env.get("SSLCOMMERZ_STORE_PASSWORD")!;
    const isSandbox = (Deno.env.get("SSLCOMMERZ_IS_SANDBOX") ?? "true") !== "false";
    const validateUrl = isSandbox
      ? "https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php"
      : "https://securepay.sslcommerz.com/validator/api/validationserverAPI.php";

    const valRes = await fetch(
      `${validateUrl}?val_id=${val_id}&store_id=${storeId}&store_passwd=${storePasswd}&format=json`
    );
    const valData = await valRes.json();

    if (valData.status === "VALID" || valData.status === "VALIDATED") {
      // Get order to find credits and user_id
      const { data: order } = await serviceClient
        .from("orders")
        .select("*")
        .eq("tran_id", tran_id)
        .single();

      if (!order || order.status === "paid") {
        // Already processed or not found
        return new Response("OK", { status: 200 });
      }

      // Verify amount matches
      if (parseFloat(valData.amount) < order.amount) {
        await serviceClient
          .from("orders")
          .update({ status: "failed", val_id })
          .eq("tran_id", tran_id);
        return new Response("Amount mismatch", { status: 200 });
      }

      // Update order status
      await serviceClient
        .from("orders")
        .update({ status: "paid", val_id })
        .eq("tran_id", tran_id);

      // Grant credits
      const { data: profile } = await serviceClient
        .from("profiles")
        .select("credits")
        .eq("user_id", order.user_id)
        .single();

      if (profile) {
        await serviceClient
          .from("profiles")
          .update({ credits: (profile.credits ?? 0) + order.credits })
          .eq("user_id", order.user_id);
      }
    } else {
      await serviceClient
        .from("orders")
        .update({ status: "failed", val_id })
        .eq("tran_id", tran_id);
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("IPN Error:", error);
    return new Response("Error", { status: 500 });
  }
});
