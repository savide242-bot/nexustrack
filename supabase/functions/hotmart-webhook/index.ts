import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hotmart-hottok",
};

function mapStatus(event: string, amount: number): string {
  if (amount <= 0) return "cancelled";
  const e = event.toUpperCase();
  if (e.includes("REFUND") || e.includes("CHARGEBACK")) return "refunded";
  if (e.includes("CANCEL") || e.includes("PROTEST")) return "cancelled";
  if (e.includes("PURCHASE") || e.includes("APPROVED") || e.includes("COMPLETE")) return "approved";
  return "pending";
}

function isApprovalOnlyEvent(event: string): boolean {
  const e = event.toUpperCase();
  return e.includes("APPROVED") && !e.includes("COMPLETE");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const payload = await req.json();
    const headerHottok = req.headers.get("x-hotmart-hottok")?.trim() || req.headers.get("X-HOTMART-HOTTOK")?.trim() || "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Filter test webhooks
    const isTest = payload.test === true || 
      payload.data?.test === true ||
      (payload.data?.buyer?.email || payload.buyer?.email || "").toLowerCase().includes("@example.com") ||
      (payload.data?.buyer?.email || payload.buyer?.email || "").toLowerCase().includes("postman") ||
      (payload.data?.buyer?.name || payload.buyer?.name || "").toLowerCase().startsWith("teste");

    if (isTest) {
      return new Response(JSON.stringify({ ok: true, skipped: "test webhook" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const event = payload.event || payload.data?.event || "";
    const purchase = payload.data?.purchase || payload.purchase || {};
    const buyer = payload.data?.buyer || payload.buyer || {};
    const product = payload.data?.product || payload.product || {};

    const buyerEmail = buyer.email || "";
    const buyerName = buyer.name || "";
    const buyerPhone = buyer.checkout_phone || buyer.phone || "";
    const originalAmount = purchase.price?.value || purchase.original_offer_price?.value || 0;
    const originalCurrency = purchase.price?.currency_value || purchase.price?.currency_code || "USD";
    const transactionId = purchase.transaction || "";
    const productName = product.name || "";
    const status = mapStatus(event, originalAmount);
    const approvalOnlyEvent = isApprovalOnlyEvent(event);

    console.log("Hotmart webhook received", {
      event,
      transactionId,
      status,
      hasHeaderHottok: Boolean(headerHottok),
      hasBodyHottok: Boolean(payload.hottok || payload.data?.hottok),
    });

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

    // ONLY Strategy 1: strict match via hottok → profiles.hotmart_token
    const hottok = headerHottok || payload.hottok || payload.data?.hottok || "";
    let campaignId: string | null = null;
    let userId: string | null = null;
    let leadId: string | null = null;

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

    // No user found — skip (multi-tenant isolation)
    if (!userId) {
      console.warn("Hotmart webhook skipped: no matching user", {
        event,
        transactionId,
        hottokPresent: Boolean(hottok),
      });
      return new Response(JSON.stringify({ ok: true, skipped: "no matching user" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Lead attribution — filter only this user's leads
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: leads } = await supabase
      .from("leads_clicks")
      .select("*")
      .gte("created_at", sevenDaysAgo)
      .order("created_at", { ascending: false })
      .limit(500);

    // Filter leads to only those belonging to this user's campaigns/pages
    const { data: userCampaigns } = await supabase
      .from("campaigns")
      .select("id")
      .eq("user_id", userId);
    const { data: userPages } = await supabase
      .from("pages")
      .select("id")
      .eq("user_id", userId);

    const userCampaignIds = new Set((userCampaigns || []).map(c => c.id));
    const userPageIds = new Set((userPages || []).map(p => p.id));

    const userLeads = (leads || []).filter(l =>
      (l.campaign_id && userCampaignIds.has(l.campaign_id)) ||
      (l.page_id && userPageIds.has(l.page_id))
    );

    if (userLeads.length > 0) {
      let bestScore = 0;
      for (const lead of userLeads) {
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

    const finalTransactionId = transactionId || `hotmart_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

    // IDEMPOTENCY: Check if sale already exists
    const { data: existingSale } = await supabase
      .from("sales")
      .select("id, status")
      .eq("transaction_id", finalTransactionId)
      .maybeSingle();

    if (existingSale) {
      // Update status only (e.g. approved → refunded)
      if (existingSale.status !== status) {
        await supabase
          .from("sales")
          .update({ status, hotmart_payload: payload })
          .eq("id", existingSale.id);
      }
      return new Response(JSON.stringify({ ok: true, updated: true, sale_id: existingSale.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (approvalOnlyEvent) {
      console.warn("Hotmart approval skipped: missing original sale", {
        event,
        transactionId: finalTransactionId,
        userId,
      });
      return new Response(JSON.stringify({ ok: true, skipped: "approval_without_existing_sale" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert new sale
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

    // Only send notifications + CAPI for NEW approved sales
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
          const matchedLead = userLeads.find(l => l.id === leadId);
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
              user_id: userId,
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
