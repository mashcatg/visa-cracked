import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PLANS: Record<string, { amount: number; credits: number }> = {
  Starter: { amount: 800, credits: 100 },
  Pro: { amount: 1500, credits: 200 },
  Premium: { amount: 2800, credits: 400 },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth
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

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;
    const { plan_name } = await req.json();

    const plan = PLANS[plan_name];
    if (!plan) {
      return new Response(JSON.stringify({ error: "Invalid plan" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get user profile for customer info
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("full_name, email")
      .eq("user_id", userId)
      .single();

    // Generate unique transaction ID
    const tran_id = `VC_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

    // Insert order
    const { error: orderError } = await serviceClient.from("orders").insert({
      user_id: userId,
      tran_id,
      plan_name,
      amount: plan.amount,
      credits: plan.credits,
      currency: "BDT",
      status: "pending",
    });

    if (orderError) {
      return new Response(JSON.stringify({ error: "Failed to create order" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SSLCommerz config
    const storeId = Deno.env.get("SSLCOMMERZ_STORE_ID") ?? "";
    const storePasswd = Deno.env.get("SSLCOMMERZ_STORE_PASSWORD") ?? "";
    const isSandbox = (Deno.env.get("SSLCOMMERZ_IS_SANDBOX") ?? "true") !== "false";
    const baseUrl = isSandbox
      ? "https://sandbox.sslcommerz.com"
      : "https://securepay.sslcommerz.com";

    console.log("SSLCommerz config:", { storeId, storePasswd: storePasswd ? `${storePasswd.substring(0,4)}...` : "EMPTY", isSandbox, baseUrl });

    const frontendUrl = "https://visa-cracked.lovable.app";
    const functionsUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1`;

    const formData = new URLSearchParams({
      store_id: storeId,
      store_passwd: storePasswd,
      total_amount: plan.amount.toString(),
      currency: "BDT",
      tran_id,
      success_url: `${frontendUrl}/payment/success`,
      fail_url: `${frontendUrl}/payment/fail`,
      cancel_url: `${frontendUrl}/payment/cancel`,
      ipn_url: `${functionsUrl}/payment-ipn`,
      cus_name: profile?.full_name || "Customer",
      cus_email: profile?.email || "customer@example.com",
      cus_add1: "N/A",
      cus_city: "N/A",
      cus_postcode: "0000",
      cus_country: "Bangladesh",
      cus_phone: "01700000000",
      product_name: `${plan_name} Credit Pack`,
      product_category: "topup",
      product_profile: "non-physical-goods",
      shipping_method: "NO",
      num_of_item: "1",
      value_a: userId,
      value_b: tran_id,
    });

    const sslRes = await fetch(`${baseUrl}/gwprocess/v4/api.php`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
    });

    const sslData = await sslRes.json();

    if (sslData.status !== "SUCCESS") {
      // Update order as failed
      await serviceClient.from("orders").update({ status: "failed" }).eq("tran_id", tran_id);
      return new Response(
        JSON.stringify({ error: sslData.failedreason || "Payment initiation failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Save session key
    await serviceClient
      .from("orders")
      .update({ session_key: sslData.sessionkey })
      .eq("tran_id", tran_id);

    return new Response(
      JSON.stringify({ GatewayPageURL: sslData.GatewayPageURL }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
