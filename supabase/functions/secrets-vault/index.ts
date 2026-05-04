// Secure vault for third-party API tokens. Clients NEVER read raw values; they
// only call this function to set/delete/check. The service role bypasses RLS.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_KINDS = new Set([
  "meta_access_token",
  "hotmart_token",
  "tiktok_access_token",
  "fb_access_token",
]);

function isAllowedKind(kind: string): boolean {
  if (ALLOWED_KINDS.has(kind)) return true;
  // campaign-scoped kinds: campaign:<uuid>:<kind>
  const m = kind.match(/^campaign:[0-9a-f-]{36}:([a-z_]+)$/i);
  return !!(m && ALLOWED_KINDS.has(m[1]));
}

async function getUserId(req: Request): Promise<string | null> {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: auth } } }
  );
  const { data, error } = await supabase.auth.getClaims(auth.replace("Bearer ", ""));
  if (error || !data?.claims?.sub) return null;
  return data.claims.sub as string;
}

async function audit(admin: any, userId: string, action: string, target: string, req: Request, metadata: any = {}) {
  try {
    await admin.from("audit_log").insert({
      user_id: userId,
      action,
      target,
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      user_agent: req.headers.get("user-agent")?.slice(0, 1000) || null,
      metadata,
    });
  } catch (e) {
    console.error("Audit log error:", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const userId = await getUserId(req);
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const action = String(body.action || "");
    const kind = String(body.kind || "");

    if (!isAllowedKind(kind)) {
      return new Response(JSON.stringify({ error: "Invalid secret kind" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (action === "set") {
      const value = String(body.value || "").trim();
      if (value.length < 6 || value.length > 4096) {
        return new Response(JSON.stringify({ error: "Value must be 6-4096 chars" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      await admin.from("user_secrets").upsert(
        { user_id: userId, kind, value, updated_at: new Date().toISOString() },
        { onConflict: "user_id,kind" }
      );
      await audit(admin, userId, "secret.set", kind, req);
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "delete") {
      await admin.from("user_secrets").delete().eq("user_id", userId).eq("kind", kind);
      await audit(admin, userId, "secret.delete", kind, req);
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "preview") {
      // Return only first 4 + last 2 chars (mask). Never the full value.
      const { data } = await admin
        .from("user_secrets")
        .select("value, updated_at")
        .eq("user_id", userId)
        .eq("kind", kind)
        .maybeSingle();
      if (!data) return new Response(JSON.stringify({ exists: false }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const v = data.value as string;
      const masked = v.length <= 6 ? "••••••" : v.slice(0, 4) + "••••" + v.slice(-2);
      return new Response(JSON.stringify({ exists: true, masked, updated_at: data.updated_at }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("secrets-vault error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
