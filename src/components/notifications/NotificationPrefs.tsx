import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboard } from "@/contexts/DashboardContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  DollarSign, RotateCcw, Trophy, CalendarClock, Bell, Send,
  Trash2, User, Package, Sparkles, Smartphone, Layers, CheckCircle
} from "lucide-react";

interface Prefs {
  push_sales: boolean;
  push_refunds: boolean;
  push_milestones: boolean;
  daily_summary: boolean;
  timezone: string;
}

export interface NotificationTemplateSettings {
  include_client_name: boolean;
  include_product_name: boolean;
  include_amount: boolean;
  include_dashboard_name: boolean;
  include_channel: boolean;
  push_page_removed: boolean;
}

const TEMPLATE_STORAGE_KEY = "nx_notification_template_settings";

export const DEFAULT_TEMPLATE: NotificationTemplateSettings = {
  include_client_name: true,
  include_product_name: true,
  include_amount: true,
  include_dashboard_name: true,
  include_channel: true,
  push_page_removed: true,
};

export function getStoredTemplateSettings(): NotificationTemplateSettings {
  try {
    const raw = localStorage.getItem(TEMPLATE_STORAGE_KEY);
    if (raw) return { ...DEFAULT_TEMPLATE, ...JSON.parse(raw) };
  } catch (_) {}
  return DEFAULT_TEMPLATE;
}

const DEFAULT: Prefs = {
  push_sales: true,
  push_refunds: true,
  push_milestones: true,
  daily_summary: true,
  timezone: "Africa/Maputo",
};

const TIMEZONES = [
  "Africa/Maputo", "Africa/Johannesburg", "Africa/Luanda", "Africa/Lagos",
  "Europe/Lisbon", "Europe/London", "Europe/Madrid", "America/Sao_Paulo",
  "America/New_York", "UTC",
];

export function NotificationPrefs() {
  const { user } = useAuth();
  const { current } = useDashboard();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT);
  const [template, setTemplate] = useState<NotificationTemplateSettings>(getStoredTemplateSettings);
  const [loading, setLoading] = useState(true);
  const [sendingTest, setSendingTest] = useState(false);
  const [todaySummary, setTodaySummary] = useState<{ sent_at: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("notification_prefs")
        .select("push_sales, push_refunds, push_milestones, daily_summary, timezone")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) setPrefs(data as Prefs);
      setLoading(false);

      const tz = (data as any)?.timezone || "Africa/Maputo";
      const todayLocal = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
      const startUtc = new Date(`${todayLocal}T00:00:00Z`);
      const offsetMin = (new Date().getTime() - new Date(new Date().toLocaleString("en-US", { timeZone: tz })).getTime()) / 60000;
      startUtc.setMinutes(startUtc.getMinutes() + offsetMin);
      const { data: log } = await supabase
        .from("notifications_log")
        .select("sent_at")
        .eq("user_id", user.id)
        .eq("title", "📊 Resumo do dia")
        .gte("sent_at", startUtc.toISOString())
        .order("sent_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (log) setTodaySummary(log as any);
    })();
  }, [user]);

  const update = async (patch: Partial<Prefs>) => {
    if (!user) return;
    const next = { ...prefs, ...patch };
    setPrefs(next);
    const { error } = await supabase
      .from("notification_prefs")
      .upsert({ user_id: user.id, ...next }, { onConflict: "user_id" });
    if (error) {
      toast.error("Falha ao guardar preferências");
      setPrefs(prefs);
    } else {
      toast.success("Preferências atualizadas");
    }
  };

  const updateTemplate = (patch: Partial<NotificationTemplateSettings>) => {
    const next = { ...template, ...patch };
    setTemplate(next);
    try {
      localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(next));
    } catch (_) {}
    toast.success("Modelo de notificação salvo");
  };

  // Montagem do texto baseado nas preferências escolhidas
  const buildNotificationText = (
    clientName = "Nome Teste",
    productName = "Produto Teste",
    amount = "1.500 MT",
    channel = "@conta1 — Stories",
    dashName = current?.name || "Operação Principal"
  ) => {
    const parts: string[] = [];

    if (template.include_client_name) {
      parts.push(clientName);
    } else {
      parts.push("Cliente");
    }

    if (template.include_product_name) {
      parts.push(`comprou "${productName}"`);
    } else {
      parts.push("realizou uma compra");
    }

    if (template.include_amount) {
      parts.push(`por ${amount}`);
    }

    if (template.include_channel) {
      parts.push(`via ${channel}`);
    }

    if (template.include_dashboard_name) {
      parts.push(`(Operação: ${dashName})`);
    }

    return parts.join(" ");
  };

  const handleSendTestPush = async () => {
    if (!user) return;
    setSendingTest(true);

    const title = "🎉 Venda Aprovada!";
    const body = buildNotificationText(
      "Nome Teste",
      "Produto Teste",
      "1.500 MT",
      "@conta1 — Stories",
      current?.name || "Operação Principal"
    );

    try {
      // 1. Invocar a Edge Function do Web Push oficial
      const { data, error } = await supabase.functions.invoke("send-push", {
        body: { user_id: user.id, title, body, kind: "sale" }
      });

      // 2. Disparar notificação nativa do browser em paralelo para resposta instantânea
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        try {
          new Notification(title, { body, icon: "/icon-192.png" });
        } catch (_) {}
      }

      // 3. Gravar no log de notificações
      await supabase.from("notifications_log").insert({
        user_id: user.id,
        title,
        body,
      });

      toast.success("Push de teste enviado com todos os parâmetros selecionados!");
    } catch (e: any) {
      toast.error(e.message || "Erro ao disparar teste de push");
    } finally {
      setSendingTest(false);
    }
  };

  if (loading) return null;

  const Row = ({ icon: Icon, title, desc, value, onChange }: any) => (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-border last:border-0">
      <div className="flex items-start gap-3 min-w-0">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="font-medium text-foreground text-sm">{title}</p>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* SEÇÃO 1: PERSONALIZAÇÃO DOS DETALHES DA NOTIFICAÇÃO (COMO VOCÊ PREFERE RECEBER) */}
      <Card className="glass-card border-border border-primary/30">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Campos e Detalhes da Notificação (Configurável)
            </CardTitle>
            <Badge variant="outline" className="text-xs border-primary/40 text-primary">
              Personalização de Texto
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Escolha exatamente quais informações você deseja receber no texto do Push Notification a cada venda ou evento.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border">
              <div className="flex items-center gap-2.5">
                <User className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-xs font-semibold text-foreground">Nome do Cliente</p>
                  <p className="text-[11px] text-muted-foreground">Ex: "Nome Teste comprou..."</p>
                </div>
              </div>
              <Switch
                checked={template.include_client_name}
                onCheckedChange={(v) => updateTemplate({ include_client_name: v })}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border">
              <div className="flex items-center gap-2.5">
                <Package className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-xs font-semibold text-foreground">Nome do Produto</p>
                  <p className="text-[11px] text-muted-foreground">Ex: "...comprou Produto Teste"</p>
                </div>
              </div>
              <Switch
                checked={template.include_product_name}
                onCheckedChange={(v) => updateTemplate({ include_product_name: v })}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border">
              <div className="flex items-center gap-2.5">
                <DollarSign className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-xs font-semibold text-foreground">Valor em Meticais (MT)</p>
                  <p className="text-[11px] text-muted-foreground">Ex: "...por 1.500 MT"</p>
                </div>
              </div>
              <Switch
                checked={template.include_amount}
                onCheckedChange={(v) => updateTemplate({ include_amount: v })}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border">
              <div className="flex items-center gap-2.5">
                <Layers className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-xs font-semibold text-foreground">Nome da Dashboard / Operação</p>
                  <p className="text-[11px] text-muted-foreground">Ex: "(Operação: {current?.name || "Principal"})"</p>
                </div>
              </div>
              <Switch
                checked={template.include_dashboard_name}
                onCheckedChange={(v) => updateTemplate({ include_dashboard_name: v })}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border">
              <div className="flex items-center gap-2.5">
                <Smartphone className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-xs font-semibold text-foreground">Conta & Canal de Origem</p>
                  <p className="text-[11px] text-muted-foreground">Ex: "...via @conta1 — Stories"</p>
                </div>
              </div>
              <Switch
                checked={template.include_channel}
                onCheckedChange={(v) => updateTemplate({ include_channel: v })}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border">
              <div className="flex items-center gap-2.5">
                <Trash2 className="h-4 w-4 text-destructive" />
                <div>
                  <p className="text-xs font-semibold text-foreground">Alerta ao Remover Página</p>
                  <p className="text-[11px] text-muted-foreground">Dispara push imediato ao excluir página</p>
                </div>
              </div>
              <Switch
                checked={template.push_page_removed}
                onCheckedChange={(v) => updateTemplate({ push_page_removed: v })}
              />
            </div>
          </div>

          {/* PREVIEW DO PUSH EM TEMPO REAL */}
          <div className="rounded-xl border border-primary/40 bg-secondary/20 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-primary flex items-center gap-1.5">
                <Smartphone className="h-3.5 w-3.5" /> Prévia da Notificação em Tempo Real:
              </span>
              <span className="text-[10px] text-muted-foreground">Formato que você receberá</span>
            </div>
            <div className="rounded-lg bg-card/90 border border-border p-3 shadow-md">
              <div className="flex items-start gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20">
                  <Bell className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-foreground">🎉 Venda Aprovada!</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    {buildNotificationText()}
                  </p>
                  <span className="text-[10px] text-muted-foreground/60 mt-1 block">Agora • NexusTrack</span>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                onClick={handleSendTestPush}
                disabled={sendingTest}
                className="gradient-primary text-primary-foreground text-xs gap-1.5 h-8 px-3"
              >
                <Send className="h-3.5 w-3.5" />
                {sendingTest ? "Enviando Push..." : "Confirmar Seleção & Enviar Push de Teste"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SEÇÃO 2: GATILHOS DE EVENTOS */}
      <Card className="glass-card border-border">
        <CardHeader>
          <CardTitle className="font-display text-base">Gatilhos de Notificação Automática</CardTitle>
          <p className="text-xs text-muted-foreground">Ative ou desative os tipos de eventos que disparam alertas</p>
        </CardHeader>
        <CardContent className="space-y-1">
          <Row icon={DollarSign} title="Novas vendas" desc="Push imediato a cada venda aprovada" value={prefs.push_sales} onChange={(v: boolean) => update({ push_sales: v })} />
          <Row icon={RotateCcw} title="Cancelamentos e reembolsos" desc="Avisa quando uma venda é cancelada ou reembolsada" value={prefs.push_refunds} onChange={(v: boolean) => update({ push_refunds: v })} />
          <Row icon={Trophy} title="Metas atingidas" desc="Quando atinges marcos de receita (50k, 100k, 500k MZN)" value={prefs.push_milestones} onChange={(v: boolean) => update({ push_milestones: v })} />
          <Row icon={CalendarClock} title="Resumo diário às 22h" desc="Total de vendas do dia vs dia anterior" value={prefs.daily_summary} onChange={(v: boolean) => update({ daily_summary: v })} />

          {prefs.daily_summary && (
            <div className="mt-2 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs">
              {todaySummary ? (
                <span className="text-primary">✓ Resumo de hoje enviado às {new Date(todaySummary.sent_at).toLocaleTimeString("pt-MZ", { hour: "2-digit", minute: "2-digit", timeZone: prefs.timezone })}</span>
              ) : (
                <span className="text-muted-foreground">⏳ Aguardando 22:00 ({prefs.timezone}) para enviar o resumo de hoje</span>
              )}
            </div>
          )}

          <div className="pt-4 space-y-2">
            <Label className="text-xs text-muted-foreground">Fuso horário (afecta o resumo diário)</Label>
            <Select value={prefs.timezone} onValueChange={(v) => update({ timezone: v })}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
