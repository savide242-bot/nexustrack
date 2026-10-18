import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getSecret, rateLimit, clientIp } from "../_shared/security.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function hashSHA256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value.trim().toLowerCase());
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Formatação E.164 com código do país para Match Score 10/10 na Meta
function normalizePhone(raw: string, defaultCountry = "mz"): string {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return "";

  // Se já tem código de Moçambique (258) e tamanho 12
  if (digits.startsWith("258") && digits.length === 12) return digits;

  // Número moçambicano sem código de país (ex: 841234567, 82, 85, 86, 87)
  if (digits.length === 9 && digits.startsWith("8")) {
    return "258" + digits;
  }

  // Se já tem código do Brasil (55) e tamanho 12 ou 13
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) return digits;

  // Número brasileiro sem código (10 ou 11 dígitos)
  if (defaultCountry === "br" && (digits.length === 10 || digits.length === 11)) {
    return "55" + digits;
  }

  return digits;
}

// Normalização de país em formato ISO de 2 letras
function normalizeCountry(raw: string): string {
  const c = raw.trim().toLowerCase();
  if (!c || c === "mz" || c.includes("moç") || c.includes("moz") || c === "mzn") return "mz";
  if (c === "br" || c.includes("bras") || c.includes("braz") || c === "brl") return "br";
  if (c === "pt" || c.includes("port")) return "pt";
  if (c === "ao" || c.includes("angol")) return "ao";
  if (c === "us" || c.includes("unit") || c === "usa") return "us";
  return c.slice(0, 2);
}

// Conversão inteligente de Moedas para USD (Meta NÃO aceita MZN!)
// Evita inflacionar o ROAS (ex: 197 MZN = 3.09 USD)
function convertToUsd(amount: number, currency: string): number {
  const num = Number(amount) || 0;
  if (num <= 0) return 0;

  const curr = (currency || "USD").toUpperCase().trim();
  if (curr === "USD") return Number(num.toFixed(2));

  // Câmbio MZN -> USD (1 USD ≈ 63.85 MZN)
  if (curr === "MZN" || curr === "MT") {
    return Number((num / 63.85).toFixed(2));
  }

  // Câmbio BRL -> USD (1 USD ≈ 5.65 BRL)
  if (curr === "BRL") {
    return Number((num / 5.65).toFixed(2));
  }

  // Câmbio EUR -> USD (1 EUR ≈ 1.08 USD)
  if (curr === "EUR") {
    return Number((num * 1.08).toFixed(2));
  }

  // Câmbio ZAR -> USD (1 USD ≈ 17.80 ZAR)
  if (curr === "ZAR") {
    return Number((num / 17.80).toFixed(2));
  }

  return Number(num.toFixed(2));
}

const sanitize = (val: unknown, maxLen = 500) =>
  typeof val === "string" ? val.trim().slice(0, maxLen) : "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      campaign_id,
      event_name,
      event_data,
      user_id: bodyUserId,
      event_id: externalEventId,
      pixel_id: explicitPixelId,
      access_token: explicitAccessToken,
    } = body;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let userId: string | null = bodyUserId || null;
    const auth = req.headers.get("Authorization") || "";
    const isServiceCall = auth === `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`;

    if (!isServiceCall) {
      if (auth.startsWith("Bearer ")) {
        const userClient = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { global: { headers: { Authorization: auth } } }
        );
        const { data: claims } = await userClient.auth.getClaims(auth.replace("Bearer ", ""));
        userId = (claims?.claims?.sub as string) || null;
      }
      if (!userId) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
      }
      const allowed = await rateLimit(admin, `meta-capi:${userId}:${clientIp(req)}`, 120, 60);
      if (!allowed) {
        return new Response(JSON.stringify({ error: "Rate limit" }), { status: 429, headers: corsHeaders });
      }
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: "user_id required" }), { status: 400, headers: corsHeaders });
    }

    // 1. Obter Pixel ID e Access Token (do payload ou do Vault do usuário)
    let pixel_id = explicitPixelId || "";
    let access_token = explicitAccessToken || "";

    if (!pixel_id) {
      const { data: profile } = await admin
        .from("profiles")
        .select("meta_pixel_id")
        .eq("user_id", userId)
        .maybeSingle();
      pixel_id = profile?.meta_pixel_id || "";
    }

    if (!access_token) {
      access_token = (await getSecret(admin, userId, "meta_access_token")) || "";
    }

    if (!/^\d{10,20}$/.test(pixel_id)) {
      return new Response(
        JSON.stringify({ error: "Invalid or missing Meta pixel_id" }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (access_token.length < 10) {
      return new Response(
        JSON.stringify({ error: "Missing Meta Conversions API access token in vault" }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (!event_name || typeof event_name !== "string") {
      return new Response(
        JSON.stringify({ error: "event_name required" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const sed = event_data || {};

    // 2. FILTRO DE QUALIDADE CRÍTICO: NÃO ENVIAR PURCHASE PARA VENDAS FALHADAS OU ABANDONADAS
    if (event_name === "Purchase") {
      const status = String(sed.status || "approved").toLowerCase();
      const isApproved =
        status === "approved" ||
        status === "realized" ||
        status === "completed" ||
        status === "pago" ||
        sed.is_approved === true;

      if (!isApproved) {
        console.log(`[CAPI] Purchase ignorado - status não aprovado (${status})`);
        return new Response(
          JSON.stringify({
            ok: true,
            skipped: `Purchase not sent because status is ${status}`,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 3. IDENTIFICADORES DO CLIENTE PARA EVENT QUALITY MATCH SCORE 10/10 NA META
    const eventId =
      typeof externalEventId === "string" && externalEventId.length >= 6 && externalEventId.length <= 120
        ? externalEventId
        : `evt_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

    const now = Math.floor(Date.now() / 1000);
    const userData: Record<string, any> = {};

    // E-mail (SHA-256)
    const emailNorm = sanitize(sed.email, 320).toLowerCase();
    if (emailNorm) userData.em = [await hashSHA256(emailNorm)];

    // País
    const countryCode = normalizeCountry(String(sed.country || "mz"));
    userData.country = [await hashSHA256(countryCode)];

    // Telefone (E.164 + SHA-256)
    const phoneNorm = normalizePhone(sanitize(sed.phone, 30), countryCode);
    if (phoneNorm) userData.ph = [await hashSHA256(phoneNorm)];

    // Nome e Sobrenome
    if (sed.name) {
      const parts = String(sed.name).trim().split(" ");
      userData.fn = [await hashSHA256(parts[0].toLowerCase())];
      if (parts.length > 1) {
        userData.ln = [await hashSHA256(parts[parts.length - 1].toLowerCase())];
      }
    }

    // Cidade, Estado, CEP
    if (sed.city) userData.ct = [await hashSHA256(sanitize(sed.city, 100).toLowerCase().replace(/\s+/g, ""))];
    if (sed.state) userData.st = [await hashSHA256(sanitize(sed.state, 100).toLowerCase().replace(/\s+/g, ""))];
    if (sed.zip_code) userData.zp = [await hashSHA256(sanitize(sed.zip_code, 20).toLowerCase().replace(/[^\d]/g, ""))];

    // IP e User Agent reais
    if (sed.ip_address) userData.client_ip_address = sanitize(sed.ip_address, 45);
    if (sed.user_agent) userData.client_user_agent = sanitize(sed.user_agent, 500);

    // Cookies oficiais da Meta (_fbc e _fbp)
    if (sed.fbc) userData.fbc = sanitize(sed.fbc, 200);
    if (sed.fbp) userData.fbp = sanitize(sed.fbp, 200);

    // External ID único
    userData.external_id = [
      await hashSHA256(String(emailNorm || phoneNorm || sed.fingerprint || sed.order_id || eventId)),
    ];

    // 4. CONVERSÃO INTELIGENTE DE VALOR PARA USD (Meta não aceita Metical MZN)
    let finalValueUsd = 0;
    if (sed.value !== undefined && sed.value !== null) {
      finalValueUsd = convertToUsd(Number(sed.value), String(sed.currency || "USD"));
    }

    const orderId = sanitize(sed.order_id || sed.transaction_id || (event_name === "Purchase" ? eventId : ""), 100);

    const customData: Record<string, any> = {};
    if (finalValueUsd > 0) {
      customData.value = finalValueUsd;
      customData.currency = "USD"; // SEMPRE USD para a Meta!
    }
    if (sed.product_name) {
      customData.content_name = sanitize(sed.product_name, 200);
      customData.content_type = "product";
    }
    if (orderId) {
      customData.order_id = orderId; // Garante deduplicação 100% no Gerenciador de Anúncios
    }

    const eventPayload = {
      data: [
        {
          event_name,
          event_time: now,
          event_id: eventId,
          action_source: "website",
          event_source_url: sanitize(sed.page_url, 1000) || undefined,
          user_data: userData,
          ...(Object.keys(customData).length > 0 ? { custom_data: customData } : {}),
        },
      ],
    };

    // 5. ENVIO OFICIAL PARA A META GRAPH API v21.0
    const metaUrl = `https://graph.facebook.com/v21.0/${pixel_id}/events?access_token=${access_token}`;
    const metaRes = await fetch(metaUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(eventPayload),
    });
    const metaResponse = await metaRes.json();

    // 6. REGISTRO DE AUDITORIA NO BANCO
    await admin.from("capi_events_log").insert({
      campaign_id: campaign_id || null,
      user_id: userId,
      event_name,
      event_id: eventId,
      payload: eventPayload,
      status: metaRes.ok ? "sent" : "error",
      response: metaResponse,
    });

    console.log(`[CAPI] Evento ${event_name} enviado para Pixel ${pixel_id}:`, {
      ok: metaRes.ok,
      eventId,
      valueUsd: finalValueUsd,
      currency: "USD",
      metaResponse,
    });

    return new Response(
      JSON.stringify({
        ok: metaRes.ok,
        event_id: eventId,
        value_usd: finalValueUsd,
        currency: "USD",
        response: metaResponse,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("[CAPI] Erro interno:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
