const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const action = typeof body.action === "string" ? body.action : "";

    const appId = Deno.env.get("FB_APP_ID") || "";
    const appSecret = Deno.env.get("FB_APP_SECRET") || "";

    if (!appId || !appSecret) {
      return new Response(JSON.stringify({ error: "Facebook App not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: get app_id (public info for frontend)
    if (action === "get_app_id") {
      return new Response(JSON.stringify({ app_id: appId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: exchange short-lived token for long-lived
    if (action === "exchange") {
      const shortToken = typeof body.short_token === "string" ? body.short_token.trim() : "";
      if (!shortToken || shortToken.length < 10) {
        return new Response(JSON.stringify({ error: "Invalid short_token" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const url = `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${encodeURIComponent(shortToken)}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.error) {
        return new Response(JSON.stringify({ error: data.error.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const longToken = data.access_token;
      const accountsRes = await fetch(`https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name,account_status,currency,business_name&access_token=${longToken}`);
      const accountsData = await accountsRes.json();

      return new Response(JSON.stringify({
        access_token: longToken,
        expires_in: data.expires_in,
        ad_accounts: accountsData.data || [],
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("FB token exchange error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
