// Shared helper to read user secrets from the vault.
// Only callable from edge functions using the service role.
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export async function getSecret(
  admin: SupabaseClient,
  userId: string,
  kind: string,
): Promise<string | null> {
  const { data } = await admin
    .from("user_secrets")
    .select("value")
    .eq("user_id", userId)
    .eq("kind", kind)
    .maybeSingle();
  return (data?.value as string | undefined) ?? null;
}

// Find user_id whose vault contains a given hottok value (used by webhooks)
export async function findUserByHottok(
  admin: SupabaseClient,
  hottok: string,
): Promise<string | null> {
  const { data } = await admin
    .from("user_secrets")
    .select("user_id")
    .eq("kind", "hotmart_token")
    .eq("value", hottok)
    .maybeSingle();
  return (data?.user_id as string | undefined) ?? null;
}

// Simple sliding-window rate limiter using rate_limits table.
// Returns true if allowed, false if blocked.
export async function rateLimit(
  admin: SupabaseClient,
  key: string,
  windowSeconds: number,
  maxHits: number,
): Promise<boolean> {
  const now = Date.now();
  const windowStart = new Date(Math.floor(now / (windowSeconds * 1000)) * windowSeconds * 1000).toISOString();
  // Cleanup old windows occasionally (best-effort)
  if (Math.random() < 0.02) {
    const cutoff = new Date(now - windowSeconds * 1000 * 10).toISOString();
    await admin.from("rate_limits").delete().lt("window_start", cutoff);
  }
  const { data: existing } = await admin
    .from("rate_limits")
    .select("count")
    .eq("key", key)
    .eq("window_start", windowStart)
    .maybeSingle();
  const current = (existing?.count as number) || 0;
  if (current >= maxHits) return false;
  await admin
    .from("rate_limits")
    .upsert({ key, window_start: windowStart, count: current + 1 }, { onConflict: "key,window_start" });
  return true;
}

export function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}
