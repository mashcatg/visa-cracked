import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PLANS: Record<string, { bdt: number; usd: number; credits: number }> = {
  Starter: { bdt: 800, usd: 8, credits: 100 },
  Pro: { bdt: 1500, usd: 15, credits: 200 },
  Premium: { bdt: 2800, usd: 28, credits: 400 },
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

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;
    const { plan_name, currency: rawCurrency = "BDT", coupon_code } = await req.json();

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

    // Determine base amount
    const currencyUpper = typeof rawCurrency === "string" ? rawCurrency.toUpperCase() : "BDT";
    const cur = currencyUpper === "USD" ? "USD" : "BDT";
    let amount = cur === "USD" ? plan.usd : plan.bdt;

    // Validate & apply coupon if provided
    let couponId: string | null = null;
    if (coupon_code) {
      const { data: coupon } = await serviceClient
        .from("coupons")
        .select("*")
        .ilike("code", coupon_code.trim())
        .eq("is_active", true)
        .single();

      if (!coupon) {
        return new Response(JSON.stringify({ error: "Invalid coupon code" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (coupon.expiration_date && new Date(coupon.expiration_date) <= new Date()) {
        return new Response(JSON.stringify({ error: "Coupon expired" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (coupon.total_usage_limit != null && coupon.times_used >= coupon.total_usage_limit) {
        return new Response(JSON.stringify({ error: "Coupon usage limit reached" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { count } = await serviceClient
        .from("coupon_usages")
        .select("*", { count: "exact", head: true })
        .eq("coupon_id", coupon.id)
        .eq("user_id", userId);

      if ((count ?? 0) >= coupon.per_user_limit) {
        return new Response(JSON.stringify({ error: "You already used this coupon" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Apply discount
      if (coupon.discount_type === "percentage") {
        amount = Math.round(amount * (1 - coupon.discount_amount / 100));
      } else {
        // Fixed discount - proportional for USD
        if (cur === "USD") {
          const ratio = plan.usd / plan.bdt;
          amount = Math.max(0, Math.round(amount - coupon.discount_amount * ratio));
        } else {
          amount = Math.max(0, Math.round(amount - coupon.discount_amount));
        }
      }

      couponId = coupon.id;
    }

    if (amount <= 0) {
      return new Response(JSON.stringify({ error: "Invalid discounted amount" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user profile
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("full_name, email")
      .eq("user_id", userId)
      .single();

    const tran_id = `VC_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

    const { error: orderError } = await serviceClient.from("orders").insert({
      user_id: userId,
      tran_id,
      plan_name,
      amount,
      credits: plan.credits,
      currency: cur,
      status: "pending",
    });

    if (orderError) {
      return new Response(JSON.stringify({ error: "Failed to create order" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Record coupon usage & increment counter
    if (couponId) {
      await serviceClient.from("coupon_usages").insert({
        coupon_id: couponId,
        user_id: userId,
      });
      // Increment times_used
      const { data: couponData } = await serviceClient.from("coupons").select("times_used").eq("id", couponId).single();
      if (couponData) {
        await serviceClient.from("coupons").update({ times_used: (couponData.times_used || 0) + 1 }).eq("id", couponId);
      }
    }

    // SSLCommerz config
    const storeId = Deno.env.get("SSLCOMMERZ_STORE_ID") ?? "";
    const storePasswd = Deno.env.get("SSLCOMMERZ_STORE_PASSWORD") ?? "";
    const isSandbox = (Deno.env.get("SSLCOMMERZ_IS_SANDBOX") ?? "true") !== "false";
    const baseUrl = isSandbox
      ? "https://sandbox.sslcommerz.com"
      : "https://securepay.sslcommerz.com";

    const frontendUrl = "https://visa-cracked.lovable.app";
    const functionsUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1`;

    const formData = new URLSearchParams({
      store_id: storeId,
      store_passwd: storePasswd,
      total_amount: amount.toString(),
      currency: cur,
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
      await serviceClient.from("orders").update({ status: "failed" }).eq("tran_id", tran_id);
      return new Response(
        JSON.stringify({ error: sslData.failedreason || "Payment initiation failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await serviceClient
      .from("orders")
      .update({ session_key: sslData.sessionkey })
      .eq("tran_id", tran_id);

    return new Response(
      JSON.stringify({ GatewayPageURL: sslData.GatewayPageURL }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
