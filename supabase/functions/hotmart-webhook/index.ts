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
  if (e.includes("APPROVED")) return "approved";
  if (e.includes("COMPLETE") || e.includes("PURCHASE")) return "realized";
  return "pending";
}

function parseHotmartDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const raw = String(value).trim();
  const numeric = Number(raw);
  const date = /^\d{13}$/.test(raw)
    ? new Date(numeric)
    : /^\d{10}$/.test(raw)
      ? new Date(numeric * 1000)
      : new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function extractSaleDate(payload: any, purchase: any): string {
  return parseHotmartDate(purchase.order_date) ||
    parseHotmartDate(purchase.purchase_date) ||
    parseHotmartDate(purchase.date) ||
    parseHotmartDate(payload.data?.purchase?.order_date) ||
    parseHotmartDate(payload.data?.purchase?.purchase_date) ||
    parseHotmartDate(payload.data?.purchase?.date) ||
    parseHotmartDate(payload.creation_date) ||
    parseHotmartDate(payload.data?.creation_date) ||
    new Date().toISOString();
}

function extractApprovedAt(payload: any, purchase: any, event: string): string | null {
  const explicit = parseHotmartDate(purchase.approved_date) ||
    parseHotmartDate(purchase.approval_date) ||
    parseHotmartDate(payload.data?.purchase?.approved_date) ||
    parseHotmartDate(payload.data?.purchase?.approval_date);
  if (explicit) return explicit;
  return event.toUpperCase().includes("APPROVED") ? (parseHotmartDate(payload.event_date) || new Date().toISOString()) : null;
}

function shouldUpdateStatus(currentStatus: string, nextStatus: string): boolean {
  if (currentStatus === nextStatus) return false;
  if (currentStatus === "refunded") return false;
  if (currentStatus === "cancelled" && nextStatus !== "refunded") return false;
  if (nextStatus === "refunded" || nextStatus === "cancelled") return true;
  if (currentStatus === "approved" && nextStatus === "realized") return false;
  if (currentStatus === "realized" && nextStatus === "approved") return true;
  if (currentStatus === "pending" && (nextStatus === "realized" || nextStatus === "approved")) return true;
  return true;
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
    const saleDate = extractSaleDate(payload, purchase);
    const approvedAt = extractApprovedAt(payload, purchase, event);
    const nowIso = new Date().toISOString();

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
      .select("id, status, sale_date")
      .eq("transaction_id", finalTransactionId)
      .maybeSingle();

    if (existingSale) {
      if (shouldUpdateStatus(existingSale.status, status)) {
        await supabase
          .from("sales")
          .update({
            status,
            ...(approvedAt ? { approved_at: approvedAt } : {}),
            status_updated_at: nowIso,
            hotmart_event: event,
            last_webhook_at: nowIso,
            hotmart_payload: payload,
          })
          .eq("id", existingSale.id);
      } else {
        await supabase
          .from("sales")
          .update({ hotmart_event: event, last_webhook_at: nowIso, hotmart_payload: payload })
          .eq("id", existingSale.id);
      }
      return new Response(JSON.stringify({ ok: true, updated: true, sale_id: existingSale.id, sale_date: existingSale.sale_date }), {
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
      sale_date: saleDate,
      approved_at: approvedAt,
      status_updated_at: nowIso,
      hotmart_event: event,
      first_seen_at: nowIso,
      last_webhook_at: nowIso,
      platform: "hotmart",
      transaction_id: finalTransactionId,
      hotmart_payload: payload,
    }).select("id").single();

    if (saleErr) throw saleErr;

    // Only notify/CAPI for genuinely new, recent sales. Late approvals update status only.
    const saleAgeMs = Date.now() - new Date(saleDate).getTime();
    const isRecentSale = saleAgeMs >= 0 && saleAgeMs <= 24 * 60 * 60 * 1000;
    if ((status === "realized" || status === "approved") && userId && isRecentSale) {
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
              kind: "sale",
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
          // Deterministic event_id so Meta dedupes if the same purchase fires again later
          const purchaseEventId = `purchase_${finalTransactionId}`;
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
              event_id: purchaseEventId,
              event_data: {
                email: buyerEmail,
                phone: buyerPhone,
                name: buyerName,
                value: originalAmount,
                currency: originalCurrency,
                product_name: productName || "",
                country: matchedLead?.country || "",
                city: matchedLead?.city || "",
                state: matchedLead?.state || "",
                zip_code: matchedLead?.zip_code || "",
                ip_address: matchedLead?.ip_address || "",
                user_agent: matchedLead?.user_agent || "",
                fbc: matchedLead?.fbc || "",
                fbp: matchedLead?.fbp || "",
                fingerprint: matchedLead?.fingerprint || "",
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
