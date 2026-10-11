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

function zonedStartOfDayUtc(date: Date, tz: string): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value || 0);
  const utcGuess = new Date(Date.UTC(get("year"), get("month") - 1, get("day"), 0, 0, 0));
  const localAtGuess = new Date(utcGuess.toLocaleString("en-US", { timeZone: tz }));
  return new Date(utcGuess.getTime() - (localAtGuess.getTime() - utcGuess.getTime()));
}

function startOfLocalDayUtc(tz: string): { todayStart: Date; yesterdayStart: Date; tomorrowStart: Date } {
  const todayStart = zonedStartOfDayUtc(new Date(), tz);
  const yesterdayStart = zonedStartOfDayUtc(new Date(todayStart.getTime() - 12 * 60 * 60 * 1000), tz);
  const tomorrowStart = zonedStartOfDayUtc(new Date(todayStart.getTime() + 36 * 60 * 60 * 1000), tz);
  return { todayStart, yesterdayStart, tomorrowStart };
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

    const { todayStart, yesterdayStart, tomorrowStart } = startOfLocalDayUtc(tz);

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
      supabase.from("sales").select("amount_mzn, status, sale_date")
        .eq("user_id", p.user_id)
        .gte("sale_date", todayStart.toISOString())
        .lt("sale_date", tomorrowStart.toISOString()),
      supabase.from("sales").select("amount_mzn, status, sale_date")
        .eq("user_id", p.user_id)
        .gte("sale_date", yesterdayStart.toISOString())
        .lt("sale_date", todayStart.toISOString()),
    ]);

    const sumValid = (rows: any[] | null) =>
      (rows || [])
        .filter((s) => ["approved", "realized"].includes(s.status) && Number(s.amount_mzn) > 0)
        .reduce((acc, s) => acc + Number(s.amount_mzn), 0);
    const countValid = (rows: any[] | null) =>
      (rows || []).filter((s) => ["approved", "realized"].includes(s.status) && Number(s.amount_mzn) > 0).length;

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

  return new Response(JSON.stringify({ ok: true, processed: prefs.length, triggered, skipped }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
