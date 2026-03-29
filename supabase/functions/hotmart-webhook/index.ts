import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const payload = await req.json();
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Extract data from Hotmart webhook
    const event = payload.event || payload.data?.event || "";
    const purchase = payload.data?.purchase || payload.purchase || {};
    const buyer = payload.data?.buyer || payload.buyer || {};
    const product = payload.data?.product || payload.product || {};

    const buyerEmail = buyer.email || "";
    const buyerName = buyer.name || "";
    const buyerPhone = buyer.checkout_phone || buyer.phone || "";
    const originalAmount = purchase.price?.value || purchase.original_offer_price?.value || 0;
    const originalCurrency = purchase.price?.currency_code || "USD";
    const transactionId = purchase.transaction || "";
    const productName = product.name || "";
    const status = event.includes("REFUND") ? "refunded" : 
                   event.includes("CANCEL") ? "cancelled" :
                   event.includes("PURCHASE") || event.includes("APPROVED") ? "approved" : "pending";

    // Convert currency to MZN
    let exchangeRate = 1;
    let amountMzn = originalAmount;
    if (originalCurrency !== "MZN") {
      try {
        const rateRes = await fetch(`https://open.er-api.com/v6/latest/${originalCurrency}`);
        const rateData = await rateRes.json();
        exchangeRate = rateData.rates?.MZN || 63.5;
        amountMzn = originalAmount * exchangeRate;
      } catch {
        exchangeRate = originalCurrency === "USD" ? 63.5 : originalCurrency === "BRL" ? 12.5 : 63.5;
        amountMzn = originalAmount * exchangeRate;
      }
    }

    // Find user - multiple strategies
    const hottok = payload.hottok || payload.data?.hottok || "";
    let campaignId: string | null = null;
    let userId: string | null = null;
    let leadId: string | null = null;

    // Strategy 1: Find via hottok in profiles
    if (hottok) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("hotmart_token", hottok)
        .single();
      if (profile) userId = profile.user_id;

      const { data: camp } = await supabase
        .from("campaigns")
        .select("id, user_id")
        .eq("hotmart_token", hottok)
        .single();
      if (camp) {
        campaignId = camp.id;
        if (!userId) userId = camp.user_id;
      }
    }

    // Strategy 2: Find via buyer email in profiles
    if (!userId && buyerEmail) {
      // Check auth.users via admin API isn't possible, but we can check all profiles
      // and match campaigns by user
      const { data: allProfiles } = await supabase
        .from("profiles")
        .select("user_id, hotmart_token")
        .not("hotmart_token", "is", null);
      
      // If only one user exists with a hotmart_token configured, it's likely them
      if (allProfiles && allProfiles.length === 1) {
        userId = allProfiles[0].user_id;
      }
    }

    // Strategy 3: If still no user, get the first profile with hotmart_token
    if (!userId) {
      const { data: fallbackProfile } = await supabase
        .from("profiles")
        .select("user_id")
        .not("hotmart_token", "is", null)
        .limit(1)
        .single();
      if (fallbackProfile) userId = fallbackProfile.user_id;
    }

    // Lead attribution
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: leads } = await supabase
      .from("leads_clicks")
      .select("*")
      .gte("created_at", sevenDaysAgo)
      .order("created_at", { ascending: false })
      .limit(500);

    if (leads && leads.length > 0) {
      let bestScore = 0;
      for (const lead of leads) {
        let score = 0;
        if (buyerEmail && lead.email && lead.email.toLowerCase() === buyerEmail.toLowerCase()) score += 40;
        if (buyerPhone && lead.phone && lead.phone.replace(/\D/g, "").includes(buyerPhone.replace(/\D/g, ""))) score += 30;
        if (lead.fingerprint) score += 20;
        if (lead.utm_source) score += 10;
        if (score > bestScore) {
          bestScore = score;
          leadId = lead.id;
          if (lead.campaign_id && !campaignId) campaignId = lead.campaign_id;
        }
      }
    }

    // Get userId from campaign if needed
    if (campaignId && !userId) {
      const { data: camp } = await supabase
        .from("campaigns")
        .select("user_id")
        .eq("id", campaignId)
        .single();
      if (camp) userId = camp.user_id;
    }

    // Generate unique transaction_id if empty to avoid duplicate key issues
    const finalTransactionId = transactionId || `hotmart_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

    // Insert sale
    const { data: sale, error: saleErr } = await supabase.from("sales").insert({
      campaign_id: campaignId,
      lead_id: leadId,
      user_id: userId,
      buyer_name: buyerName,
      buyer_email: buyerEmail,
      buyer_phone: buyerPhone,
      product_name: productName,
      original_amount: originalAmount,
      original_currency: originalCurrency,
      amount_mzn: amountMzn,
      exchange_rate: exchangeRate,
      status,
      platform: "hotmart",
      transaction_id: finalTransactionId,
      hotmart_payload: payload,
    }).select("id").single();

    if (saleErr) throw saleErr;

    // Send push notification if sale is approved and we have a userId
    if (status === "approved" && userId) {
      await supabase.from("notifications_log").insert({
        user_id: userId,
        sale_id: sale.id,
        title: `💰 Nova venda!`,
        body: `${buyerName || "Alguém"} pagou ${amountMzn.toLocaleString("pt-MZ")} MT em Hotmart`,
      });

      try {
        const pushUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-push`;
        await fetch(pushUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({
            user_id: userId,
            title: "💰 Nova venda!",
            body: `${buyerName || "Alguém"} pagou ${amountMzn.toLocaleString("pt-MZ")} MT em Hotmart`,
          }),
        });
      } catch (pushErr) {
        console.error("Push notification error:", pushErr);
      }

      // Send Meta CAPI Purchase event
      const { data: profile } = await supabase
        .from("profiles")
        .select("meta_pixel_id, meta_access_token")
        .eq("user_id", userId)
        .single();

      const pixelId = (profile as any)?.meta_pixel_id;
      const accessToken = (profile as any)?.meta_access_token;

      if (pixelId && accessToken) {
        try {
          const matchedLead = leads?.find(l => l.id === leadId);
          const capiUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/meta-capi`;
          await fetch(capiUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({
              campaign_id: campaignId,
              pixel_id: pixelId,
              access_token: accessToken,
              event_name: "Purchase",
              event_data: {
                email: buyerEmail,
                phone: buyerPhone,
                name: buyerName,
                value: originalAmount,
                currency: originalCurrency,
                country: matchedLead?.country || "",
                city: matchedLead?.city || "",
                state: matchedLead?.state || "",
                zip_code: matchedLead?.zip_code || "",
                ip_address: matchedLead?.ip_address || "",
                user_agent: matchedLead?.user_agent || "",
                fbc: matchedLead?.fbc || "",
                fbp: matchedLead?.fbp || "",
              },
            }),
          });
        } catch (capiErr) {
          console.error("CAPI error:", capiErr);
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, sale_id: sale.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("Webhook error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
