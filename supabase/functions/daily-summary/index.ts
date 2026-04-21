// Daily summary push: runs hourly via cron, fires for each user whose local time is 22:00.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function localHour(tz: string): number {
  try {
    const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hour12: false });
    return parseInt(fmt.format(new Date()), 10);
  } catch {
    return new Date().getUTCHours();
  }
}

function startOfLocalDayUtc(tz: string): { todayStart: Date; yesterdayStart: Date } {
  // Build "YYYY-MM-DD 00:00" in tz, then resolve to UTC instant
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
  const today = fmt.format(new Date()); // YYYY-MM-DD
  const todayStart = new Date(`${today}T00:00:00Z`);
  // approximate offset
  const offsetMin = (new Date().getTime() - new Date(new Date().toLocaleString("en-US", { timeZone: tz })).getTime()) / 60000;
  todayStart.setMinutes(todayStart.getMinutes() + offsetMin);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  return { todayStart, yesterdayStart };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: prefs } = await supabase
    .from("notification_prefs")
    .select("user_id, timezone, daily_summary")
    .eq("daily_summary", true);

  if (!prefs || prefs.length === 0) {
    return new Response(JSON.stringify({ ok: true, processed: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let triggered = 0;
  let skipped = 0;
  for (const p of prefs) {
    const tz = p.timezone || "Africa/Maputo";
    if (localHour(tz) !== 22) continue;

    const { todayStart, yesterdayStart } = startOfLocalDayUtc(tz);

    // Dedupe: skip if a summary was already logged today (local day) for this user
    const { data: existing } = await supabase
      .from("notifications_log")
      .select("id")
      .eq("user_id", p.user_id)
      .eq("title", "📊 Resumo do dia")
      .gte("sent_at", todayStart.toISOString())
      .limit(1);
    if (existing && existing.length > 0) {
      skipped++;
      continue;
    }

    const [{ data: today }, { data: yest }] = await Promise.all([
      supabase.from("sales").select("amount_mzn, status")
        .eq("user_id", p.user_id)
        .gte("created_at", todayStart.toISOString()),
      supabase.from("sales").select("amount_mzn, status")
        .eq("user_id", p.user_id)
        .gte("created_at", yesterdayStart.toISOString())
        .lt("created_at", todayStart.toISOString()),
    ]);

    const sumValid = (rows: any[] | null) =>
      (rows || [])
        .filter((s) => s.status !== "refunded" && Number(s.amount_mzn) > 0)
        .reduce((acc, s) => acc + Number(s.amount_mzn), 0);
    const countValid = (rows: any[] | null) =>
      (rows || []).filter((s) => s.status !== "refunded" && Number(s.amount_mzn) > 0).length;

    const todayTotal = sumValid(today);
    const yestTotal = sumValid(yest);
    const todayCount = countValid(today);
    const delta = yestTotal === 0 ? (todayTotal === 0 ? 0 : 100) : ((todayTotal - yestTotal) / yestTotal) * 100;
    const sign = delta >= 0 ? "+" : "";

    const title = "📊 Resumo do dia";
    const body = `${todayCount} vendas · ${Math.round(todayTotal).toLocaleString("pt-MZ")} MT (${sign}${delta.toFixed(0)}% vs ontem)`;

    await supabase.from("notifications_log").insert({
      user_id: p.user_id,
      title,
      body,
    });

    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-push`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ user_id: p.user_id, title, body, kind: "summary" }),
    });

    triggered++;
  }

  return new Response(JSON.stringify({ ok: true, processed: prefs.length, triggered }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
