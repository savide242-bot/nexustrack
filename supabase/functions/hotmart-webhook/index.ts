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
    const subscription = payload.data?.subscription || {};

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
        exchangeRate = rateData.rates?.MZN || 63.5; // fallback
        amountMzn = originalAmount * exchangeRate;
      } catch {
        exchangeRate = originalCurrency === "USD" ? 63.5 : originalCurrency === "BRL" ? 12.5 : 63.5;
        amountMzn = originalAmount * exchangeRate;
      }
    }

    // Hybrid attribution: find best matching lead
    let leadId: string | null = null;
    let campaignId: string | null = null;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Score leads
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
        if (lead.fingerprint) score += 20; // fingerprint present means engagement
        if (lead.utm_source) score += 10;
        if (score > bestScore) {
          bestScore = score;
          leadId = lead.id;
          campaignId = lead.campaign_id;
        }
      }
    }

    // If no lead found, try to find campaign by hotmart_token
    if (!campaignId) {
      const hottok = payload.hottok || payload.data?.hottok || "";
      if (hottok) {
        const { data: camp } = await supabase
          .from("campaigns")
          .select("id, user_id")
          .eq("hotmart_token", hottok)
          .single();
        if (camp) campaignId = camp.id;
      }
    }

    // Insert sale
    const { data: sale, error: saleErr } = await supabase.from("sales").insert({
      campaign_id: campaignId,
      lead_id: leadId,
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
      transaction_id: transactionId,
      hotmart_payload: payload,
    }).select("id").single();

    if (saleErr) throw saleErr;

    // Send push notification if sale is approved
    if (status === "approved" && campaignId) {
      // Get campaign owner
      const { data: campaign } = await supabase
        .from("campaigns")
        .select("user_id")
        .eq("id", campaignId)
        .single();

      if (campaign) {
        const userId = campaign.user_id;

        // Log notification
        await supabase.from("notifications_log").insert({
          user_id: userId,
          sale_id: sale.id,
          title: `💰 Nova venda!`,
          body: `${buyerName || "Alguém"} pagou ${amountMzn.toLocaleString("pt-MZ")} MT em Hotmart`,
        });

        // Send push via send-push function
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

        // Send Meta CAPI Purchase event if campaign has pixel
        const { data: campData } = await supabase
          .from("campaigns")
          .select("meta_pixel_id, meta_access_token")
          .eq("id", campaignId)
          .single();

        if (campData?.meta_pixel_id && campData?.meta_access_token) {
          try {
            const capiUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/meta-capi`;
            await fetch(capiUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              },
              body: JSON.stringify({
                campaign_id: campaignId,
                pixel_id: campData.meta_pixel_id,
                access_token: campData.meta_access_token,
                event_name: "Purchase",
                event_data: {
                  email: buyerEmail,
                  phone: buyerPhone,
                  name: buyerName,
                  value: originalAmount,
                  currency: originalCurrency,
                  country: leads?.find(l => l.id === leadId)?.country || "",
                  city: leads?.find(l => l.id === leadId)?.city || "",
                  state: leads?.find(l => l.id === leadId)?.state || "",
                  zip_code: leads?.find(l => l.id === leadId)?.zip_code || "",
                  ip_address: leads?.find(l => l.id === leadId)?.ip_address || "",
                  user_agent: leads?.find(l => l.id === leadId)?.user_agent || "",
                  fbc: leads?.find(l => l.id === leadId)?.fbc || "",
                  fbp: leads?.find(l => l.id === leadId)?.fbp || "",
                },
              }),
            });
          } catch (capiErr) {
            console.error("CAPI error:", capiErr);
          }
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, sale_id: sale.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Webhook error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
