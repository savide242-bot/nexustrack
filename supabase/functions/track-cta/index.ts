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
    const lead_id = body.lead_id && isValidUUID(body.lead_id) ? body.lead_id : null;

    if (!campaign_id && !page_id) {
      return new Response(JSON.stringify({ error: "campaign_id or page_id required" }), { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error } = await supabase.from("cta_clicks").insert({
      campaign_id,
      page_id,
      lead_id,
      button_id: sanitize(body.button_id, 200),
      button_text: sanitize(body.button_text, 500),
      page_url: sanitize(body.page_url, 2000),
    });

    if (error) throw error;

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("Track CTA error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
