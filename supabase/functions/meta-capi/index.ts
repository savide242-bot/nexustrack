import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function hashSHA256(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value.trim().toLowerCase());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function sanitize(val: unknown, maxLen = 500): string {
  if (typeof val !== "string") return "";
  return val.trim().slice(0, maxLen);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { campaign_id, pixel_id, access_token, event_name, event_data, user_id } = body;

    if (!pixel_id || typeof pixel_id !== "string" || !/^\d{10,20}$/.test(pixel_id)) {
      return new Response(JSON.stringify({ error: "Invalid pixel_id" }), { status: 400, headers: corsHeaders });
    }
    if (!access_token || typeof access_token !== "string" || access_token.length < 10) {
      return new Response(JSON.stringify({ error: "Invalid access_token" }), { status: 400, headers: corsHeaders });
    }
    if (!event_name || typeof event_name !== "string") {
      return new Response(JSON.stringify({ error: "event_name required" }), { status: 400, headers: corsHeaders });
    }

    const safeEventData = event_data || {};
    const eventId = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    // Hash user data for Meta CAPI
    const userData: Record<string, any> = {};
    if (safeEventData.email) userData.em = [await hashSHA256(sanitize(safeEventData.email, 320))];
    if (safeEventData.phone) userData.ph = [await hashSHA256(sanitize(safeEventData.phone, 30))];
    if (safeEventData.name) {
      const parts = String(safeEventData.name).trim().split(" ");
      userData.fn = [await hashSHA256(parts[0])];
      if (parts.length > 1) userData.ln = [await hashSHA256(parts[parts.length - 1])];
    }
    if (safeEventData.city) userData.ct = [await hashSHA256(sanitize(safeEventData.city, 100))];
    if (safeEventData.state) userData.st = [await hashSHA256(sanitize(safeEventData.state, 100))];
    if (safeEventData.zip_code) userData.zp = [await hashSHA256(sanitize(safeEventData.zip_code, 20))];
    if (safeEventData.country) userData.country = [await hashSHA256(sanitize(safeEventData.country, 5))];
    if (safeEventData.ip_address) userData.client_ip_address = sanitize(safeEventData.ip_address, 45);
    if (safeEventData.user_agent) userData.client_user_agent = sanitize(safeEventData.user_agent, 500);
    if (safeEventData.fbc) userData.fbc = sanitize(safeEventData.fbc, 200);
    if (safeEventData.fbp) userData.fbp = sanitize(safeEventData.fbp, 200);
    userData.external_id = [await hashSHA256(safeEventData.email || safeEventData.phone || eventId)];

    const eventPayload = {
      data: [{
        event_name,
        event_time: now,
        event_id: eventId,
        action_source: "website",
        user_data: userData,
        ...(safeEventData.value ? {
          custom_data: {
            value: Number(safeEventData.value) || 0,
            currency: sanitize(safeEventData.currency || "USD", 3),
            content_name: sanitize(safeEventData.product_name, 200),
          }
        } : {}),
      }],
    };

    // Send to Meta Conversions API
    const metaUrl = `https://graph.facebook.com/v21.0/${pixel_id}/events?access_token=${access_token}`;
    const metaRes = await fetch(metaUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(eventPayload),
    });
    const metaResponse = await metaRes.json();

    // Always log the event (not just when campaign_id exists)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    await supabase.from("capi_events_log").insert({
      campaign_id: campaign_id || null,
      user_id: user_id || null,
      event_name,
      event_id: eventId,
      payload: eventPayload,
      status: metaRes.ok ? "sent" : "error",
      response: metaResponse,
    });

    return new Response(JSON.stringify({ ok: metaRes.ok, event_id: eventId, response: metaResponse }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("CAPI error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
