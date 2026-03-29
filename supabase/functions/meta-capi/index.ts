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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { campaign_id, pixel_id, access_token, event_name, event_data } = await req.json();

    if (!pixel_id || !access_token || !event_name) {
      return new Response(JSON.stringify({ error: "pixel_id, access_token, event_name required" }), { status: 400, headers: corsHeaders });
    }

    const eventId = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    // Hash user data for Meta CAPI (required by Facebook)
    const userData: Record<string, any> = {};
    if (event_data.email) userData.em = [await hashSHA256(event_data.email)];
    if (event_data.phone) userData.ph = [await hashSHA256(event_data.phone)];
    if (event_data.name) {
      const parts = event_data.name.trim().split(" ");
      userData.fn = [await hashSHA256(parts[0])];
      if (parts.length > 1) userData.ln = [await hashSHA256(parts[parts.length - 1])];
    }
    if (event_data.city) userData.ct = [await hashSHA256(event_data.city)];
    if (event_data.state) userData.st = [await hashSHA256(event_data.state)];
    if (event_data.zip_code) userData.zp = [await hashSHA256(event_data.zip_code)];
    if (event_data.country) userData.country = [await hashSHA256(event_data.country)];
    if (event_data.ip_address) userData.client_ip_address = event_data.ip_address;
    if (event_data.user_agent) userData.client_user_agent = event_data.user_agent;
    if (event_data.fbc) userData.fbc = event_data.fbc;
    if (event_data.fbp) userData.fbp = event_data.fbp;
    userData.external_id = [await hashSHA256(event_data.email || event_data.phone || eventId)];

    const eventPayload = {
      data: [{
        event_name: event_name,
        event_time: now,
        event_id: eventId,
        action_source: "website",
        user_data: userData,
        ...(event_data.value ? {
          custom_data: {
            value: event_data.value,
            currency: event_data.currency || "USD",
            content_name: event_data.product_name || "",
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

    // Log the event
    if (campaign_id) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      await supabase.from("capi_events_log").insert({
        campaign_id,
        event_name,
        event_id: eventId,
        payload: eventPayload,
        status: metaRes.ok ? "sent" : "error",
        response: metaResponse,
      });
    }

    return new Response(JSON.stringify({ ok: metaRes.ok, event_id: eventId, response: metaResponse }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
