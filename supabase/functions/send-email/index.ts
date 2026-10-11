// send-email — Resend integration for NexusTrack
// Sends transactional emails: sale alerts, daily summaries, ROI warnings
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getSecret } from "../_shared/security.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const { user_id, to, subject, html, kind, template_data } = body as {
      user_id: string;
      to?: string;
      subject?: string;
      html?: string;
      kind?: "sale_alert" | "roi_warning" | "daily_summary" | "custom";
      template_data?: Record<string, any>;
    };

    if (!user_id) return json({ error: "user_id required" }, 400);

    // Get user email if not provided
    let toEmail = to;
    if (!toEmail) {
      const { data: authUser } = await admin.auth.admin.getUserById(user_id);
      toEmail = authUser?.user?.email;
    }
    if (!toEmail) return json({ error: "No email address" }, 400);

    // Get Resend API key — first try user secret, then env
    const resendKey = await getSecret(admin, user_id, "resend_api_key").catch(() => null)
      || Deno.env.get("RESEND_API_KEY");
    if (!resendKey) return json({ error: "Resend API key not configured" }, 400);

    // Build email content from template
    let emailSubject = subject || "NexusTrack Notification";
    let emailHtml = html || "";

    if (kind === "sale_alert" && template_data) {
      const { buyer_name, amount, currency, platform, operation } = template_data;
      emailSubject = `💰 Nova Venda: ${amount} ${currency} — ${platform}`;
      emailHtml = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><style>
        body { font-family: 'Inter', Arial, sans-serif; background: #121212; color: #f0f0f0; margin: 0; padding: 0; }
        .container { max-width: 560px; margin: 32px auto; background: #1a1a1a; border-radius: 16px; overflow: hidden; border: 1px solid #2a2a2a; }
        .header { background: linear-gradient(135deg, #00FF7F, #00cc66); padding: 32px; text-align: center; }
        .header h1 { margin: 0; color: #0a0a0a; font-size: 28px; font-weight: 800; }
        .body { padding: 32px; }
        .amount-box { background: #0a1a0f; border: 2px solid #00FF7F; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0; }
        .amount { font-size: 42px; font-weight: 800; color: #00FF7F; letter-spacing: -1px; }
        .currency { font-size: 16px; color: #888; margin-top: 4px; }
        .details { background: #222; border-radius: 10px; padding: 16px; margin: 16px 0; }
        .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #333; }
        .detail-row:last-child { border-bottom: none; }
        .label { color: #888; font-size: 14px; }
        .value { color: #f0f0f0; font-size: 14px; font-weight: 600; }
        .footer { text-align: center; padding: 20px; color: #555; font-size: 12px; }
      </style></head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚡ NexusTrack</h1>
            <p style="margin:8px 0 0; color:#065; font-weight:600;">Nova venda confirmada!</p>
          </div>
          <div class="body">
            <div class="amount-box">
              <div class="amount">${amount}</div>
              <div class="currency">${currency}</div>
            </div>
            <div class="details">
              <div class="detail-row"><span class="label">Comprador</span><span class="value">${buyer_name || "—"}</span></div>
              <div class="detail-row"><span class="label">Plataforma</span><span class="value">${platform}</span></div>
              <div class="detail-row"><span class="label">Operação</span><span class="value">${operation || "—"}</span></div>
            </div>
          </div>
          <div class="footer">NexusTrack • nexustrack.lovable.app</div>
        </div>
      </body></html>`;
    }

    if (kind === "roi_warning" && template_data) {
      const { operation, roi, roas, spend, currency } = template_data;
      emailSubject = `⚠️ Alerta ROI: ${operation} em ${roi < 0 ? "prejuízo" : "atenção"}`;
      emailHtml = `
      <!DOCTYPE html><html><head><meta charset="utf-8"><style>
        body { font-family: Arial, sans-serif; background: #121212; color: #f0f0f0; }
        .container { max-width: 560px; margin: 32px auto; background: #1a1a1a; border-radius: 16px; border: 1px solid ${roi < 0 ? "#ff4444" : "#ffaa00"}; overflow: hidden; }
        .header { background: ${roi < 0 ? "#3a0000" : "#2a1a00"}; padding: 24px; text-align: center; }
        .header h1 { margin: 0; color: ${roi < 0 ? "#ff6666" : "#ffcc44"}; font-size: 24px; }
        .body { padding: 32px; }
        .metric { text-align: center; padding: 16px; background: #222; border-radius: 10px; margin: 12px 0; }
        .metric-value { font-size: 32px; font-weight: 800; color: ${roi < 0 ? "#ff4444" : "#ffaa00"}; }
        .footer { text-align: center; padding: 16px; color: #555; font-size: 12px; }
      </style></head>
      <body>
        <div class="container">
          <div class="header"><h1>${roi < 0 ? "❌ Operação em Prejuízo" : "⚠️ ROAS Baixo"}</h1></div>
          <div class="body">
            <p>A operação <strong>${operation}</strong> precisa de atenção:</p>
            <div class="metric"><div class="metric-value">${roi.toFixed(1)}%</div><div>ROI</div></div>
            <div class="metric"><div class="metric-value">${roas.toFixed(2)}x</div><div>ROAS</div></div>
            <div class="metric"><div class="metric-value">${spend} ${currency}</div><div>Gasto</div></div>
            <p style="color:#888; font-size:14px;">Acede ao NexusTrack para tomar acção.</p>
          </div>
          <div class="footer">NexusTrack • nexustrack.lovable.app</div>
        </div>
      </body></html>`;
    }

    if (kind === "daily_summary" && template_data) {
      const { revenue, spend, profit, roas, roi, sales_count, currency, date } = template_data;
      emailSubject = `📊 Resumo Diário — ${date}`;
      emailHtml = `
      <!DOCTYPE html><html><head><meta charset="utf-8"><style>
        body { font-family: Arial, sans-serif; background: #121212; color: #f0f0f0; }
        .container { max-width: 560px; margin: 32px auto; background: #1a1a1a; border-radius: 16px; border: 1px solid #2a2a2a; overflow: hidden; }
        .header { background: linear-gradient(135deg, #00FF7F, #00cc66); padding: 24px; text-align: center; }
        .header h1 { margin: 0; color: #0a0a0a; font-size: 22px; font-weight: 800; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 24px; }
        .card { background: #222; border-radius: 10px; padding: 16px; text-align: center; }
        .card-value { font-size: 22px; font-weight: 800; color: #00FF7F; }
        .card-label { font-size: 12px; color: #888; margin-top: 4px; }
        .footer { text-align: center; padding: 16px; color: #555; font-size: 12px; }
      </style></head>
      <body>
        <div class="container">
          <div class="header"><h1>📊 Resumo — ${date}</h1></div>
          <div class="grid">
            <div class="card"><div class="card-value">${revenue} ${currency}</div><div class="card-label">Receita</div></div>
            <div class="card"><div class="card-value">${spend} ${currency}</div><div class="card-label">Gasto</div></div>
            <div class="card"><div class="card-value" style="color:${profit >= 0 ? "#00FF7F" : "#ff4444"}">${profit} ${currency}</div><div class="card-label">Lucro</div></div>
            <div class="card"><div class="card-value">${roas.toFixed(2)}x</div><div class="card-label">ROAS</div></div>
            <div class="card"><div class="card-value">${roi.toFixed(1)}%</div><div class="card-label">ROI</div></div>
            <div class="card"><div class="card-value">${sales_count}</div><div class="card-label">Vendas</div></div>
          </div>
          <div class="footer">NexusTrack • nexustrack.lovable.app</div>
        </div>
      </body></html>`;
    }

    // Send via Resend
    const fromDomain = Deno.env.get("RESEND_FROM_DOMAIN") || "onboarding@resend.dev";
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `NexusTrack <${fromDomain}>`,
        to: [toEmail],
        subject: emailSubject,
        html: emailHtml,
      }),
    });

    const result = await res.json();
    if (!res.ok) return json({ error: result.message || "Resend error" }, 400);

    return json({ ok: true, id: result.id });
  } catch (e: any) {
    console.error("send-email error:", e);
    return json({ error: e.message }, 500);
  }
});