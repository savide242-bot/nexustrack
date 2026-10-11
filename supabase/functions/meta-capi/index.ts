import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getSecret, rateLimit, clientIp } from "../_shared/security.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function hashSHA256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value.trim().toLowerCase());
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}
const normalizePhone = (raw: string) => raw.replace(/[^\d]/g, "");
const normalizeCountry = (raw: string) => raw.trim().toLowerCase().slice(0, 2);
const sanitize = (val: unknown, maxLen = 500) => typeof val === "string" ? val.trim().slice(0, maxLen) : "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const { campaign_id, event_name, event_data, user_id: bodyUserId, event_id: externalEventId } = body;
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let userId: string | null = bodyUserId || null;
    const auth = req.headers.get("Authorization") || "";
    const isServiceCall = auth === `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`;
    if (!isServiceCall) {
      if (auth.startsWith("Bearer ")) {
        const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
          global: { headers: { Authorization: auth } },
        });
        const { data: claims } = await userClient.auth.getClaims(auth.replace("Bearer ", ""));
        userId = (claims?.claims?.sub as string) || null;
      }
      if (!userId) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
      const allowed = await rateLimit(admin, `meta-capi:${userId}:${clientIp(req)}`, 60, 60);
      if (!allowed) return new Response(JSON.stringify({ error: "Rate limit" }), { status: 429, headers: corsHeaders });
    }
    if (!userId) return new Response(JSON.stringify({ error: "user_id required" }), { status: 400, headers: corsHeaders });

    const { data: profile } = await admin.from("profiles").select("meta_pixel_id").eq("user_id", userId).maybeSingle();
    const pixel_id = profile?.meta_pixel_id || "";
    const access_token = (await getSecret(admin, userId, "meta_access_token")) || "";

    if (!/^\d{10,20}$/.test(pixel_id)) return new Response(JSON.stringify({ error: "Invalid pixel_id" }), { status: 400, headers: corsHeaders });
    if (access_token.length < 10) return new Response(JSON.stringify({ error: "Missing Meta access token in vault" }), { status: 400, headers: corsHeaders });
    if (!event_name || typeof event_name !== "string") return new Response(JSON.stringify({ error: "event_name required" }), { status: 400, headers: corsHeaders });

    const sed = event_data || {};
    const eventId = typeof externalEventId === "string" && externalEventId.length >= 6 && externalEventId.length <= 120 ? externalEventId : crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    const userData: Record<string, any> = {};
    const emailNorm = sanitize(sed.email, 320).toLowerCase();
    if (emailNorm) userData.em = [await hashSHA256(emailNorm)];
    const phoneNorm = normalizePhone(sanitize(sed.phone, 30));
    if (phoneNorm) userData.ph = [await hashSHA256(phoneNorm)];
    if (sed.name) {
      const parts = String(sed.name).trim().split(" ");
      userData.fn = [await hashSHA256(parts[0])];
      if (parts.length > 1) userData.ln = [await hashSHA256(parts[parts.length - 1])];
    }
    if (sed.city) userData.ct = [await hashSHA256(sanitize(sed.city, 100).toLowerCase().replace(/\s+/g, ""))];
    if (sed.state) userData.st = [await hashSHA256(sanitize(sed.state, 100).toLowerCase().replace(/\s+/g, ""))];
    if (sed.zip_code) userData.zp = [await hashSHA256(sanitize(sed.zip_code, 20).toLowerCase())];
    if (sed.country) userData.country = [await hashSHA256(normalizeCountry(String(sed.country)))];
    if (sed.ip_address) userData.client_ip_address = sanitize(sed.ip_address, 45);
    if (sed.user_agent) userData.client_user_agent = sanitize(sed.user_agent, 500);
    if (sed.fbc) userData.fbc = sanitize(sed.fbc, 200);
    if (sed.fbp) userData.fbp = sanitize(sed.fbp, 200);
    userData.external_id = [await hashSHA256(String(emailNorm || phoneNorm || sed.fingerprint || eventId))];

    const eventPayload = {
      data: [{
        event_name, event_time: now, event_id: eventId, action_source: "website", user_data: userData,
        ...(sed.value ? { custom_data: { value: Number(sed.value) || 0, currency: sanitize(sed.currency || "USD", 3), content_name: sanitize(sed.product_name, 200) } } : {}),
      }],
    };

    const metaUrl = `https://graph.facebook.com/v21.0/${pixel_id}/events?access_token=${access_token}`;
    const metaRes = await fetch(metaUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(eventPayload) });
    const metaResponse = await metaRes.json();

    await admin.from("capi_events_log").insert({
      campaign_id: campaign_id || null, user_id: userId,
      event_name, event_id: eventId, payload: eventPayload,
      status: metaRes.ok ? "sent" : "error", response: metaResponse,
    });

    return new Response(JSON.stringify({ ok: metaRes.ok, event_id: eventId, response: metaResponse }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
