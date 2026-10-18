import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function sanitize(val: unknown, maxLen = 500): string {
  if (typeof val !== "string") return "";
  return val.trim().slice(0, maxLen);
}

function isValidUUID(val: unknown): boolean {
  if (typeof val !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
}

function classifySource(referrer: string, utmSource: string, utmMedium: string, utmContent: string): string {
  const ref = referrer.toLowerCase();
  const src = utmSource.toLowerCase();
  const med = utmMedium.toLowerCase();
  const cont = utmContent.toLowerCase();

  if (ref.includes("instagram.com") || ref.includes("l.instagram.com") || src === "instagram" || src === "ig") {
    if (cont.includes("story") || cont.includes("stories") || med === "story" || med === "stories") return "Instagram — Story";
    if (cont.includes("direct") || med === "direct") return "Instagram — Direct";
    if (cont.includes("bio") || cont.includes("link_bio") || med === "bio" || med === "linkinbio") return "Instagram — Bio Link";
    if (cont.includes("reel") || med === "reel" || med === "reels") return "Instagram — Reels";
    if (cont.includes("feed") || med === "feed") return "Instagram — Feed";
    return "Instagram";
  }

  if (ref.includes("facebook.com") || ref.includes("fb.com") || ref.includes("lm.facebook") || ref.includes("m.facebook") || src === "facebook" || src === "fb") {
    if (cont.includes("story") || med === "story" || med === "stories") return "Facebook — Story";
    if (cont.includes("feed") || med === "feed") return "Facebook — Feed";
    if (cont.includes("messenger") || med === "messenger") return "Facebook — Messenger";
    return "Facebook";
  }

  if (ref.includes("google.") || src === "google") {
    if (med === "cpc" || med === "ppc") return "Google — Ads";
    if (med === "organic") return "Google — Orgânico";
    return "Google";
  }

  if (ref.includes("tiktok.com") || src === "tiktok") return "TikTok";
  if (ref.includes("youtube.com") || ref.includes("youtu.be") || src === "youtube") return "YouTube";
  if (ref.includes("twitter.com") || ref.includes("t.co") || ref.includes("x.com") || src === "twitter") return "Twitter/X";
  if (ref.includes("whatsapp") || src === "whatsapp") return "WhatsApp";
  if (ref.includes("telegram") || ref.includes("t.me") || src === "telegram") return "Telegram";

  if (utmSource) return utmSource;
  if (!referrer) return "Direto";
  return referrer.replace(/^https?:\/\//, "").split("/")[0];
}

function extractIp(req: Request): string {
  const headers = ["x-forwarded-for", "x-real-ip", "cf-connecting-ip", "x-client-ip"];
  for (const h of headers) {
    const val = req.headers.get(h);
    if (val) {
      const ip = val.split(",")[0].trim();
      if (ip) return ip;
    }
  }
  return "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const dashboard_id = isValidUUID(body.nx_dash || body.dashboard_id) ? (body.nx_dash || body.dashboard_id) : null;
    const campaign_id = isValidUUID(body.campaign_id) ? body.campaign_id : null;
    const page_id = isValidUUID(body.page_id) ? body.page_id : null;

    const ip = extractIp(req) || sanitize(body.ip_address, 45);
    const referrer = sanitize(body.referrer, 2000);
    const utmSource = sanitize(body.utm_source, 200);
    const utmMedium = sanitize(body.utm_medium, 200);
    const utmCampaign = sanitize(body.utm_campaign, 200);
    const utmContent = sanitize(body.utm_content, 200);
    const utmTerm = sanitize(body.utm_term, 200);
    const fbc = sanitize(body.fbc, 200);
    const fbp = sanitize(body.fbp, 200);
    const fbclid = sanitize(body.fbclid, 200);
    const userAgent = sanitize(body.user_agent, 500);
    const eventType = sanitize(body.event_type || "PageView", 100);

    const detailedSource = classifySource(referrer, utmSource, utmMedium, utmContent);

    // Identificar user_id a partir do dashboard se fornecido
    let userId: string | null = null;
    if (dashboard_id) {
      const { data: op } = await supabase.from("operations").select("user_id").eq("id", dashboard_id).maybeSingle();
      if (op?.user_id) {
        userId = op.user_id;
      } else {
        const { data: dash } = await supabase.from("dashboards").select("user_id").eq("id", dashboard_id).maybeSingle();
        if (dash?.user_id) userId = dash.user_id;
      }
    }

    // Incrementar contagem no link de tracking se existir correspondência
    if (dashboard_id && utmCampaign) {
      try {
        const { data: linkRow } = await supabase
          .from("tracking_links")
          .select("id, clicks")
          .eq("dashboard_id", dashboard_id)
          .eq("utm_campaign", utmCampaign)
          .maybeSingle();

        if (linkRow) {
          await supabase
            .from("tracking_links")
            .update({ clicks: (linkRow.clicks || 0) + 1 })
            .eq("id", linkRow.id);
        }
      } catch (_) {}
    }

    // Inserir na tabela unificada events
    if (dashboard_id && userId) {
      try {
        await supabase.from("events").insert({
          dashboard_id,
          user_id: userId,
          event_type: eventType,
          page_url: sanitize(body.page_url, 2000),
          referrer,
          utm_source: detailedSource || utmSource,
          utm_medium: utmMedium,
          utm_campaign: utmCampaign,
          utm_content: utmContent,
          utm_term: utmTerm,
          source_classified: detailedSource,
          ip_address: ip,
          user_agent: userAgent,
          fbc,
          fbp,
          fbclid,
          email: sanitize(body.email, 320) || null,
          phone: sanitize(body.phone, 50) || null,
          name: sanitize(body.name, 200) || null,
          value: Number(body.value) || null,
          currency: sanitize(body.currency, 10) || null,
          order_id: sanitize(body.order_id, 100) || null,
          product_name: sanitize(body.product_name, 200) || null,
          is_test: Boolean(body.is_test),
        });
      } catch (err) {
        console.error("Events insert error:", err);
      }
    }

    // Inserir em leads_clicks para compatibilidade com o sistema antigo
    const { data: leadRow } = await supabase.from("leads_clicks").insert({
      dashboard_id,
      campaign_id,
      page_id,
      page_url: sanitize(body.page_url, 2000),
      ip_address: ip,
      user_agent: userAgent,
      referrer,
      utm_source: detailedSource || utmSource,
      utm_medium: utmMedium,
      utm_campaign: utmCampaign,
      utm_content: utmContent,
      utm_term: utmTerm,
      fbc,
      fbp,
      email: sanitize(body.email, 320) || null,
      phone: sanitize(body.phone, 50) || null,
      name: sanitize(body.name, 200) || null,
    }).select("id").maybeSingle();

    return new Response(JSON.stringify({ ok: true, lead_id: leadRow?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("Track error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});