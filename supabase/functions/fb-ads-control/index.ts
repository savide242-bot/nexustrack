// Facebook Ads control: read campaign metrics (with status + budget) and
// apply changes (daily budget, pause/activate) straight from the app.
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
    const allowed = await rateLimit(admin, `fb-ads-control:${userId}:${clientIp(req)}`, 60, 60);
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

    // ---- Read: campaigns with insights, status and budget ----
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
        const cpp = Number(i.cost_per_action_type?.find((a: any) => a.action_type === "purchase")?.value || 0);
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
          cost_per_purchase: cpp,
          roas,
          platform_revenue: revenue,
        };
      });

      return json({
        campaigns,
        account: { currency: acc?.currency || null, name: acc?.name || null, status: acc?.account_status ?? null },
      });
    }

    // ---- Write: daily budget ----
    if (action === "set_budget") {
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

    // ---- Write: pause / activate ----
    if (action === "set_status") {
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

    return json({ error: "Unknown action" }, 400);
  } catch (e: any) {
    console.error("fb-ads-control error:", e);
    return json({ error: e.message }, 500);
  }
});
