import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getSecret, rateLimit, clientIp } from "../_shared/security.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const GRAPH = "https://graph.facebook.com/v21.0";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: claims } = await userClient.auth.getClaims(auth.replace("Bearer ", ""));
    const userId = claims?.claims?.sub as string | undefined;
    if (!userId) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const allowed = await rateLimit(admin, `fb-list-accounts:${userId}:${clientIp(req)}`, 60, 60);
    if (!allowed) return json({ error: "Rate limit" }, 429);

    const token = await getSecret(admin, userId, "meta_access_token");
    if (!token) return json({ error: "Conta Facebook não conectada no Vault" }, 400);

    const res = await fetch(`${GRAPH}/me/adaccounts?fields=id,name,account_id,currency,account_status&limit=100&access_token=${token}`);
    const data = await res.json();
    if (data.error) return json({ error: data.error.message }, 400);

    const accounts = (data.data || []).map((acc: any) => ({
      id: acc.id.replace(/^act_/, ""),
      name: acc.name || `Conta ${acc.account_id}`,
      currency: acc.currency || "USD",
      status: acc.account_status,
    }));

    return json({ accounts });
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
});