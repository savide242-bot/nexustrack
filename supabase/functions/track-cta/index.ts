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

    const buttonId = sanitize(body.button_id, 200);
    const buttonText = sanitize(body.button_text, 500);

    // Dedupe ViewContent per (lead_id, button) — avoid spamming pixel with repeat clicks
    if (lead_id) {
      const dedupeKey = (buttonId || buttonText || "cta").toLowerCase();
      const { data: existingClick } = await supabase
        .from("cta_clicks")
        .select("id")
        .eq("lead_id", lead_id)
        .or(`button_id.eq.${buttonId},button_text.eq.${buttonText}`)
        .limit(1)
        .maybeSingle();
      if (existingClick) {
        // Still record the click for analytics, but skip CAPI
        await supabase.from("cta_clicks").insert({
          campaign_id,
          page_id,
          lead_id,
          button_id: buttonId,
          button_text: buttonText,
          page_url: sanitize(body.page_url, 2000),
        });
        return new Response(JSON.stringify({ ok: true, deduped: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { error } = await supabase.from("cta_clicks").insert({
      campaign_id,
      page_id,
      lead_id,
      button_id: buttonId,
      button_text: buttonText,
      page_url: sanitize(body.page_url, 2000),
    });

    if (error) throw error;

    // --- Send ViewContent to Meta CAPI ---
    if (lead_id) {
      // Fetch lead data for matching identifiers
      const { data: lead } = await supabase.from("leads_clicks").select("*").eq("id", lead_id).single();

      if (lead) {
        const viewContentEventId = `vc_${lead_id}_${(buttonId || buttonText || "cta").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40)}`;
        let pixelId: string | null = null;
        let accessToken: string | null = null;
        let userId: string | null = null;

        if (page_id) {
          const { data: pageData } = await supabase.from("pages").select("user_id, campaign_id").eq("id", page_id).single();
          if (pageData) {
            userId = pageData.user_id;
            if (pageData.campaign_id) {
              const { data: camp } = await supabase.from("campaigns").select("meta_pixel_id, meta_access_token").eq("id", pageData.campaign_id).single();
              if (camp?.meta_pixel_id && camp?.meta_access_token) {
                pixelId = camp.meta_pixel_id;
                accessToken = camp.meta_access_token;
              }
            }
            if (!pixelId && userId) {
              const { data: prof } = await supabase.from("profiles").select("meta_pixel_id, meta_access_token").eq("user_id", userId).single();
              if (prof?.meta_pixel_id && prof?.meta_access_token) {
                pixelId = prof.meta_pixel_id;
                accessToken = prof.meta_access_token;
              }
            }
          }
        } else if (campaign_id) {
          const { data: camp } = await supabase.from("campaigns").select("user_id, meta_pixel_id, meta_access_token").eq("id", campaign_id).single();
          if (camp) {
            userId = camp.user_id;
            if (camp.meta_pixel_id && camp.meta_access_token) {
              pixelId = camp.meta_pixel_id;
              accessToken = camp.meta_access_token;
            } else {
              const { data: prof } = await supabase.from("profiles").select("meta_pixel_id, meta_access_token").eq("user_id", camp.user_id).single();
              if (prof?.meta_pixel_id && prof?.meta_access_token) {
                pixelId = prof.meta_pixel_id;
                accessToken = prof.meta_access_token;
              }
            }
          }
        }

        if (pixelId && accessToken) {
          try {
            const capiUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/meta-capi`;
            await fetch(capiUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              },
              body: JSON.stringify({
                campaign_id,
                pixel_id: pixelId,
                access_token: accessToken,
                event_name: "ViewContent",
                user_id: userId,
                event_id: viewContentEventId,
                event_data: {
                  email: lead.email || "",
                  phone: lead.phone || "",
                  name: lead.name || "",
                  country: lead.country || "",
                  city: lead.city || "",
                  state: lead.state || "",
                  zip_code: lead.zip_code || "",
                  ip_address: lead.ip_address || "",
                  user_agent: lead.user_agent || "",
                  fbc: lead.fbc || "",
                  fbp: lead.fbp || "",
                  content_name: buttonText.slice(0, 200),
                  fingerprint: lead.fingerprint || "",
                },
              }),
            });
          } catch (capiErr) {
            console.error("ViewContent CAPI error:", capiErr);
          }
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("Track CTA error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
