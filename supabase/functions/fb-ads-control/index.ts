// Facebook Ads control: read campaign/adset metrics and apply changes.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getSecret, rateLimit, clientIp } from "../_shared/security.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const GRAPH = "https://graph.facebook.com/v21.0";

function normalizeAccount(id: string) {
  return id.replace(/^act_/, "").replace(/[^0-9]/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: claims } = await userClient.auth.getClaims(auth.replace("Bearer ", ""));
    const userId = claims?.claims?.sub as string | undefined;
    if (!userId) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const allowed = await rateLimit(admin, `fb-ads-control:${userId}:${clientIp(req)}`, 120, 60);
    if (!allowed) return json({ error: "Rate limit" }, 429);

    const token = await getSecret(admin, userId, "meta_access_token");
    if (!token) return json({ error: "Conta do Facebook não conectada" }, 400);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    const audit = async (target: string, metadata: Record<string, unknown>) => {
      try {
        await admin.from("audit_log").insert({
          user_id: userId,
          action: `fb_ads.${action}`,
          target,
          ip: clientIp(req),
          user_agent: req.headers.get("user-agent")?.slice(0, 1000) || null,
          metadata,
        });
      } catch (_) { /* best effort */ }
    };

    // ---- Read: campaigns ----
    if (action === "campaigns") {
      const accountId = normalizeAccount(String(body.ad_account_id || ""));
      if (!accountId) return json({ error: "ad_account_id required" }, 400);
      const preset = /^[a-z0-9_]{2,30}$/.test(String(body.date_preset || "")) ? String(body.date_preset) : "last_7d";

      const listUrl = `${GRAPH}/act_${accountId}/campaigns?fields=id,name,status,effective_status,daily_budget,lifetime_budget,objective&limit=200&access_token=${token}`;
      const insightsFields = "campaign_id,campaign_name,spend,impressions,clicks,cpc,cpm,ctr,actions,cost_per_action_type,purchase_roas,action_values";
      const insightsUrl = `${GRAPH}/act_${accountId}/insights?fields=${insightsFields}&date_preset=${preset}&level=campaign&limit=200&access_token=${token}`;
      const accountUrl = `${GRAPH}/act_${accountId}?fields=currency,name,account_status&access_token=${token}`;

      const [listRes, insRes, accRes] = await Promise.all([fetch(listUrl), fetch(insightsUrl), fetch(accountUrl)]);
      const [list, ins, acc] = await Promise.all([listRes.json(), insRes.json(), accRes.json()]);
      if (list.error) return json({ error: list.error.message }, 400);
      if (ins.error) return json({ error: ins.error.message }, 400);

      const byId = new Map<string, any>();
      for (const row of ins.data || []) byId.set(row.campaign_id, row);

      const campaigns = (list.data || []).map((c: any) => {
        const i = byId.get(c.id) || {};
        const purchases = Number(i.actions?.find((a: any) => a.action_type === "purchase")?.value || 0);
        const checkouts = Number(
          i.actions?.find((a: any) => a.action_type === "initiate_checkout" || a.action_type === "omni_initiated_checkout")?.value || 0
        );
        const cpp = Number(i.cost_per_action_type?.find((a: any) => a.action_type === "purchase")?.value || 0);
        const cpic = Number(
          i.cost_per_action_type?.find((a: any) => a.action_type === "initiate_checkout" || a.action_type === "omni_initiated_checkout")?.value || 0
        );
        const roas = Number(i.purchase_roas?.[0]?.value || 0);
        const revenue = Number(i.action_values?.find((a: any) => a.action_type === "purchase")?.value || 0);
        return {
          campaign_id: c.id,
          campaign_name: c.name,
          status: c.status,
          effective_status: c.effective_status,
          objective: c.objective || null,
          daily_budget: c.daily_budget ? Number(c.daily_budget) / 100 : null,
          lifetime_budget: c.lifetime_budget ? Number(c.lifetime_budget) / 100 : null,
          spend: Number(i.spend || 0),
          impressions: Number(i.impressions || 0),
          clicks: Number(i.clicks || 0),
          cpc: Number(i.cpc || 0),
          cpm: Number(i.cpm || 0),
          ctr: Number(i.ctr || 0),
          purchases,
          checkouts,
          cost_per_purchase: cpp,
          cost_per_checkout: cpic,
          roas,
          platform_revenue: revenue,
        };
      });

      return json({
        campaigns,
        account: { currency: acc?.currency || null, name: acc?.name || null, status: acc?.account_status ?? null },
      });
    }

    // ---- Read: adsets for a campaign ----
    if (action === "adsets") {
      const campaignId = String(body.campaign_id || "").replace(/[^0-9]/g, "");
      if (!campaignId) return json({ error: "campaign_id required" }, 400);
      const preset = /^[a-z0-9_]{2,30}$/.test(String(body.date_preset || "")) ? String(body.date_preset) : "last_7d";

      const listUrl = `${GRAPH}/${campaignId}/adsets?fields=id,name,status,effective_status,daily_budget&limit=100&access_token=${token}`;
      const insightsFields = "adset_id,adset_name,spend,impressions,clicks,ctr,actions,purchase_roas,action_values";
      const insightsUrl = `${GRAPH}/${campaignId}/insights?fields=${insightsFields}&date_preset=${preset}&level=adset&limit=100&access_token=${token}`;

      const [listRes, insRes] = await Promise.all([fetch(listUrl), fetch(insightsUrl)]);
      const [list, ins] = await Promise.all([listRes.json(), insRes.json()]);
      if (list.error) return json({ error: list.error.message }, 400);
      if (ins.error) return json({ error: ins.error.message }, 400);

      const byId = new Map<string, any>();
      for (const row of ins.data || []) byId.set(row.adset_id, row);

      const adsets = (list.data || []).map((a: any) => {
        const i = byId.get(a.id) || {};
        const purchases = Number(i.actions?.find((ac: any) => ac.action_type === "purchase")?.value || 0);
        const roas = Number(i.purchase_roas?.[0]?.value || 0);
        return {
          adset_id: a.id,
          adset_name: a.name,
          status: a.status,
          effective_status: a.effective_status,
          daily_budget: a.daily_budget ? Number(a.daily_budget) / 100 : null,
          spend: Number(i.spend || 0),
          impressions: Number(i.impressions || 0),
          clicks: Number(i.clicks || 0),
          ctr: Number(i.ctr || 0),
          purchases,
          roas,
        };
      });

      return json({ adsets });
    }

    // ---- Read: ads for a campaign / adset / account ----
    if (action === "ads") {
      const accountId = normalizeAccount(String(body.ad_account_id || ""));
      const campaignId = String(body.campaign_id || "").replace(/[^0-9]/g, "");
      const adsetId = String(body.adset_id || "").replace(/[^0-9]/g, "");
      const targetId = adsetId || campaignId || (accountId ? `act_${accountId}` : "");
      if (!targetId) return json({ error: "ad_account_id, campaign_id or adset_id required" }, 400);

      const preset = /^[a-z0-9_]{2,30}$/.test(String(body.date_preset || "")) ? String(body.date_preset) : "last_7d";
      const listUrl = `${GRAPH}/${targetId}/ads?fields=id,name,status,effective_status,creative{name,title,body,image_url,thumbnail_url},campaign_id,adset_id&limit=150&access_token=${token}`;
      const insightsFields = "ad_id,ad_name,spend,impressions,clicks,cpc,cpm,ctr,actions,cost_per_action_type,purchase_roas,action_values";
      const insightsUrl = `${GRAPH}/${targetId}/insights?fields=${insightsFields}&date_preset=${preset}&level=ad&limit=150&access_token=${token}`;

      const [listRes, insRes] = await Promise.all([fetch(listUrl), fetch(insightsUrl)]);
      const [list, ins] = await Promise.all([listRes.json(), insRes.json()]);
      if (list.error) return json({ error: list.error.message }, 400);
      if (ins.error) return json({ error: ins.error.message }, 400);

      const byId = new Map<string, any>();
      for (const row of ins.data || []) byId.set(row.ad_id, row);

      const ads = (list.data || []).map((ad: any) => {
        const i = byId.get(ad.id) || {};
        const purchases = Number(i.actions?.find((a: any) => a.action_type === "purchase")?.value || 0);
        const cpp = Number(i.cost_per_action_type?.find((a: any) => a.action_type === "purchase")?.value || 0);
        const roas = Number(i.purchase_roas?.[0]?.value || 0);
        const revenue = Number(i.action_values?.find((a: any) => a.action_type === "purchase")?.value || 0);
        return {
          ad_id: ad.id,
          ad_name: ad.name,
          campaign_id: ad.campaign_id,
          adset_id: ad.adset_id,
          status: ad.status,
          effective_status: ad.effective_status,
          creative: ad.creative || null,
          spend: Number(i.spend || 0),
          impressions: Number(i.impressions || 0),
          clicks: Number(i.clicks || 0),
          cpc: Number(i.cpc || 0),
          cpm: Number(i.cpm || 0),
          ctr: Number(i.ctr || 0),
          purchases,
          cost_per_purchase: cpp,
          roas,
          revenue,
        };
      });

      return json({ ads });
    }

    // ---- Write: campaign daily budget ----
    if (action === "set_budget" || action === "set_campaign_budget") {
      const campaignId = String(body.campaign_id || "").replace(/[^0-9]/g, "");
      const amount = Number(body.daily_budget);
      if (!campaignId) return json({ error: "campaign_id required" }, 400);
      if (!isFinite(amount) || amount <= 0 || amount > 100000) return json({ error: "Orçamento inválido" }, 400);

      const res = await fetch(`${GRAPH}/${campaignId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ daily_budget: Math.round(amount * 100), access_token: token }),
      });
      const data = await res.json();
      if (data.error) return json({ error: data.error.message }, 400);
      await audit(campaignId, { daily_budget: amount });
      return json({ ok: true });
    }

    // ---- Write: adset daily budget ----
    if (action === "set_adset_budget") {
      const adsetId = String(body.adset_id || "").replace(/[^0-9]/g, "");
      const amount = Number(body.daily_budget);
      if (!adsetId) return json({ error: "adset_id required" }, 400);
      if (!isFinite(amount) || amount <= 0 || amount > 100000) return json({ error: "Orçamento inválido" }, 400);

      const res = await fetch(`${GRAPH}/${adsetId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ daily_budget: Math.round(amount * 100), access_token: token }),
      });
      const data = await res.json();
      if (data.error) return json({ error: data.error.message }, 400);
      await audit(adsetId, { adset_daily_budget: amount });
      return json({ ok: true });
    }

    // ---- Write: campaign pause / activate ----
    if (action === "set_status" || action === "set_campaign_status") {
      const campaignId = String(body.campaign_id || "").replace(/[^0-9]/g, "");
      const status = String(body.status || "").toUpperCase();
      if (!campaignId) return json({ error: "campaign_id required" }, 400);
      if (!["ACTIVE", "PAUSED"].includes(status)) return json({ error: "Status inválido" }, 400);

      const res = await fetch(`${GRAPH}/${campaignId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, access_token: token }),
      });
      const data = await res.json();
      if (data.error) return json({ error: data.error.message }, 400);
      await audit(campaignId, { status });
      return json({ ok: true });
    }

    // ---- Write: adset pause / activate ----
    if (action === "set_adset_status") {
      const adsetId = String(body.adset_id || "").replace(/[^0-9]/g, "");
      const status = String(body.status || "").toUpperCase();
      if (!adsetId) return json({ error: "adset_id required" }, 400);
      if (!["ACTIVE", "PAUSED"].includes(status)) return json({ error: "Status inválido" }, 400);

      const res = await fetch(`${GRAPH}/${adsetId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, access_token: token }),
      });
      const data = await res.json();
      if (data.error) return json({ error: data.error.message }, 400);
      await audit(adsetId, { adset_status: status });
      return json({ ok: true });
    }

    // ---- Write: ad pause / activate ----
    if (action === "set_ad_status") {
      const adId = String(body.ad_id || "").replace(/[^0-9]/g, "");
      const status = String(body.status || "").toUpperCase();
      if (!adId) return json({ error: "ad_id required" }, 400);
      if (!["ACTIVE", "PAUSED"].includes(status)) return json({ error: "Status inválido" }, 400);

      const res = await fetch(`${GRAPH}/${adId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, access_token: token }),
      });
      const data = await res.json();
      if (data.error) return json({ error: data.error.message }, 400);
      await audit(adId, { ad_status: status });
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e: any) {
    console.error("fb-ads-control error:", e);
    return json({ error: e.message }, 500);
  }
});
