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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const campaign_id = body.campaign_id && isValidUUID(body.campaign_id) ? body.campaign_id : null;
    const page_id = body.page_id && isValidUUID(body.page_id) ? body.page_id : null;

    if (!campaign_id && !page_id) {
      return new Response(JSON.stringify({ error: "campaign_id or page_id required" }), { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await supabase.from("leads_clicks").insert({
      campaign_id,
      page_id,
      page_url: sanitize(body.page_url, 2000),
      fingerprint: sanitize(body.fingerprint, 100),
      ip_address: sanitize(body.ip_address, 45),
      user_agent: sanitize(body.user_agent, 500),
      referrer: sanitize(body.referrer, 2000),
      utm_source: sanitize(body.utm_source, 200),
      utm_medium: sanitize(body.utm_medium, 200),
      utm_campaign: sanitize(body.utm_campaign, 200),
      utm_content: sanitize(body.utm_content, 200),
      utm_term: sanitize(body.utm_term, 200),
      fbc: sanitize(body.fbc, 200),
      fbp: sanitize(body.fbp, 200),
      email: sanitize(body.email, 320),
      phone: sanitize(body.phone, 30),
      name: sanitize(body.name, 200),
      city: sanitize(body.city, 100),
      state: sanitize(body.state, 100),
      country: sanitize(body.country, 5),
      zip_code: sanitize(body.zip_code, 20),
    }).select("id").single();

    if (error) throw error;

    return new Response(JSON.stringify({ lead_id: data.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("Track error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
