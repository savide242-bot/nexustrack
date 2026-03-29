const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { access_token, ad_account_id, date_preset } = await req.json();

    if (!access_token || !ad_account_id) {
      return new Response(JSON.stringify({ error: "access_token and ad_account_id required" }), { status: 400, headers: corsHeaders });
    }

    const preset = date_preset || "last_7d";
    const fields = "campaign_name,campaign_id,adset_name,ad_name,spend,impressions,clicks,cpc,cpm,ctr,actions,cost_per_action_type,purchase_roas";

    const url = `https://graph.facebook.com/v21.0/act_${ad_account_id.replace("act_", "")}/insights?fields=${fields}&date_preset=${preset}&level=campaign&limit=100&access_token=${access_token}`;

    const fbRes = await fetch(url);
    const fbData = await fbRes.json();

    if (fbData.error) {
      return new Response(JSON.stringify({ error: fbData.error.message }), { status: 400, headers: corsHeaders });
    }

    // Process data to extract key metrics
    const campaigns = (fbData.data || []).map((row: any) => {
      const purchases = row.actions?.find((a: any) => a.action_type === "purchase")?.value || 0;
      const costPerPurchase = row.cost_per_action_type?.find((a: any) => a.action_type === "purchase")?.value || 0;
      const roas = row.purchase_roas?.[0]?.value || 0;

      return {
        campaign_name: row.campaign_name,
        campaign_id: row.campaign_id,
        spend: parseFloat(row.spend || "0"),
        impressions: parseInt(row.impressions || "0"),
        clicks: parseInt(row.clicks || "0"),
        cpc: parseFloat(row.cpc || "0"),
        cpm: parseFloat(row.cpm || "0"),
        ctr: parseFloat(row.ctr || "0"),
        purchases: parseInt(purchases),
        cost_per_purchase: parseFloat(costPerPurchase),
        roas: parseFloat(roas),
      };
    });

    return new Response(JSON.stringify({ campaigns }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
