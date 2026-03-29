import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { campaign_id, page_id, page_url, fingerprint, ip_address, user_agent, referrer,
      utm_source, utm_medium, utm_campaign, utm_content, utm_term,
      fbc, fbp, email, phone, name, city, state, country, zip_code } = body;

    if (!campaign_id && !page_id) {
      return new Response(JSON.stringify({ error: "campaign_id or page_id required" }), { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await supabase.from("leads_clicks").insert({
      campaign_id: campaign_id || null,
      page_id: page_id || null,
      page_url, fingerprint, ip_address, user_agent, referrer,
      utm_source, utm_medium, utm_campaign, utm_content, utm_term,
      fbc, fbp, email, phone, name, city, state, country, zip_code,
    }).select("id").single();

    if (error) throw error;

    return new Response(JSON.stringify({ lead_id: data.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
