import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import webpush from "https://esm.sh/web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type PushKind = "sale" | "refund" | "milestone" | "summary";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { user_id, title, body, kind } = await req.json() as {
      user_id: string; title: string; body: string; kind?: PushKind;
    };

    if (!user_id || !title || !body) {
      return new Response(JSON.stringify({ error: "user_id, title, body required" }), { status: 400, headers: corsHeaders });
    }

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;

    webpush.setVapidDetails("mailto:admin@nexustrack.app", vapidPublicKey, vapidPrivateKey);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Honour user preferences (default = enabled if no row yet)
    if (kind) {
      const { data: prefs } = await supabase
        .from("notification_prefs")
        .select("push_sales, push_refunds, push_milestones, daily_summary")
        .eq("user_id", user_id)
        .maybeSingle();

      if (prefs) {
        const allowed =
          (kind === "sale" && prefs.push_sales) ||
          (kind === "refund" && prefs.push_refunds) ||
          (kind === "milestone" && prefs.push_milestones) ||
          (kind === "summary" && prefs.daily_summary);
        if (!allowed) {
          return new Response(JSON.stringify({ ok: true, skipped: "user opted out" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", user_id);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ ok: false, message: "No subscriptions found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.stringify({ title, body, icon: "/icon-192.png" });
    let sent = 0;
    const failed: string[] = [];

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification({
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth_key },
        }, payload);
        sent++;
      } catch (err: any) {
        console.error("Push send error for endpoint:", sub.endpoint, err.message);
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
          failed.push(sub.id);
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, sent, total: subscriptions.length, cleaned: failed.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("Send push error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
