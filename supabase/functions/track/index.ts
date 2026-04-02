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

  // Instagram
  if (ref.includes("instagram.com") || ref.includes("l.instagram.com") || src === "instagram" || src === "ig") {
    if (cont.includes("story") || cont.includes("stories") || med === "story" || med === "stories") return "Instagram — Story";
    if (cont.includes("direct") || med === "direct") return "Instagram — Direct";
    if (cont.includes("bio") || cont.includes("link_bio") || med === "bio" || med === "linkinbio") return "Instagram — Bio Link";
    if (cont.includes("reel") || med === "reel" || med === "reels") return "Instagram — Reels";
    if (cont.includes("feed") || med === "feed") return "Instagram — Feed";
    // Check for igshid parameter in referrer (Instagram-specific)
    if (ref.includes("igshid=") || ref.includes("igsh=")) return "Instagram";
    return "Instagram";
  }

  // Facebook
  if (ref.includes("facebook.com") || ref.includes("fb.com") || ref.includes("lm.facebook") || ref.includes("m.facebook") || src === "facebook" || src === "fb") {
    if (cont.includes("story") || med === "story" || med === "stories") return "Facebook — Story";
    if (cont.includes("feed") || med === "feed") return "Facebook — Feed";
    if (cont.includes("messenger") || med === "messenger") return "Facebook — Messenger";
    return "Facebook";
  }

  // Google
  if (ref.includes("google.") || src === "google") {
    if (med === "cpc" || med === "ppc") return "Google — Ads";
    if (med === "organic") return "Google — Orgânico";
    return "Google";
  }

  // TikTok
  if (ref.includes("tiktok.com") || src === "tiktok") return "TikTok";

  // YouTube
  if (ref.includes("youtube.com") || ref.includes("youtu.be") || src === "youtube") return "YouTube";

  // Twitter/X
  if (ref.includes("twitter.com") || ref.includes("t.co") || ref.includes("x.com") || src === "twitter") return "Twitter/X";

  // WhatsApp
  if (ref.includes("whatsapp") || src === "whatsapp") return "WhatsApp";

  // Telegram
  if (ref.includes("telegram") || ref.includes("t.me") || src === "telegram") return "Telegram";

  // If utm_source is set but not matched above
  if (utmSource) return utmSource;

  // Direct (no referrer)
  if (!referrer) return "Direto";

  return referrer.replace(/^https?:\/\//, "").split("/")[0];
}

async function resolveGeo(ip: string): Promise<{ country: string; city: string; state: string }> {
  const fallback = { country: "", city: "", state: "" };
  if (!ip || ip === "127.0.0.1" || ip === "::1") return fallback;
  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,countryCode,regionName,city`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return fallback;
    const data = await res.json();
    if (data.status !== "success") return fallback;
    return {
      country: data.countryCode || "",
      city: data.city || "",
      state: data.regionName || "",
    };
  } catch {
    return fallback;
  }
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
    const body = await req.json();
    const campaign_id = body.campaign_id && isValidUUID(body.campaign_id) ? body.campaign_id : null;
    const page_id = body.page_id && isValidUUID(body.page_id) ? body.page_id : null;

    if (!campaign_id && !page_id) {
      return new Response(JSON.stringify({ error: "campaign_id or page_id required" }), { status: 400, headers: corsHeaders });
    }

    const ip = extractIp(req) || sanitize(body.ip_address, 45);
    const geo = await resolveGeo(ip);

    const referrer = sanitize(body.referrer, 2000);
    const utmSource = sanitize(body.utm_source, 200);
    const utmMedium = sanitize(body.utm_medium, 200);
    const utmContent = sanitize(body.utm_content, 200);

    const detailedSource = classifySource(referrer, utmSource, utmMedium, utmContent);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await supabase.from("leads_clicks").insert({
      campaign_id,
      page_id,
      page_url: sanitize(body.page_url, 2000),
      fingerprint: sanitize(body.fingerprint, 100),
      ip_address: ip,
      user_agent: sanitize(body.user_agent, 500),
      referrer,
      utm_source: detailedSource || utmSource,
      utm_medium: utmMedium,
      utm_campaign: sanitize(body.utm_campaign, 200),
      utm_content: utmContent,
      utm_term: sanitize(body.utm_term, 200),
      fbc: sanitize(body.fbc, 200),
      fbp: sanitize(body.fbp, 200),
      email: sanitize(body.email, 320),
      phone: sanitize(body.phone, 30),
      name: sanitize(body.name, 200),
      city: geo.city || sanitize(body.city, 100),
      state: geo.state || sanitize(body.state, 100),
      country: geo.country || sanitize(body.country, 5),
      zip_code: sanitize(body.zip_code, 20),
    }).select("id").single();

    if (error) throw error;

    return new Response(JSON.stringify({ lead_id: data.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("Track error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
