import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/EmptyState";
import { CURRENCIES, formatCurrency } from "@/lib/currency";
import { Copy, LayoutDashboard, Pencil, Plus } from "lucide-react";

const LANGS = [{ v: "pt", l: "Português" }, { v: "en", l: "English" }, { v: "es", l: "Español" }];
const TZS = ["Africa/Maputo", "Africa/Johannesburg", "Africa/Luanda", "Africa/Lagos", "Europe/Lisbon", "America/Sao_Paulo", "America/New_York", "UTC"];
const SOURCES = ["meta", "google", "tiktok", "organic", "email", "whatsapp"];
const PERIODS = [{ v: "daily", l: "Diária" }, { v: "weekly", l: "Semanal" }, { v: "monthly", l: "Mensal" }];

type Dash = any;
const empty = {
  name: "", currency: "MZN", language: "pt", timezone: "Africa/Maputo", kind: "paid",
  fb_ad_account_id: "", revenue_goal: "", goal_period: "monthly", traffic_sources: [] as string[],
  attribution_window_days: 7, color: "#00FF7F",
};

export default function Dashboards() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<Dash[]>([]);
  const [revenue, setRevenue] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Dash | null>(null);
  const [form, setForm] = useState<any>(empty);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from("operations").select("*").eq("user_id", user.id).order("created_at");
    setItems(data || []);
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const { data: sales } = await supabase.from("sales").select("operation_id, amount_mzn, status")
      .eq("user_id", user.id).gte("sale_date", monthStart.toISOString()).in("status", ["approved", "realized"]);
    const r: Record<string, number> = {};
    (sales || []).forEach((s: any) => { if (s.operation_id) r[s.operation_id] = (r[s.operation_id] || 0) + Number(s.amount_mzn || 0); });
    setRevenue(r);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const startNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const startEdit = (d: Dash) => {
    setEditing(d);
    setForm({ ...empty, ...d, fb_ad_account_id: d.fb_ad_account_id || "", revenue_goal: d.revenue_goal ?? "" });
    setOpen(true);
  };

  const save = async () => {
    if (!user || !form.name.trim()) return toast({ title: "Dá um nome à dashboard", variant: "destructive" });
    const payload = {
      user_id: user.id, name: form.name.trim().slice(0, 80), currency: form.currency, language: form.language,
      timezone: form.timezone, kind: form.kind, color: form.color,
      fb_ad_account_id: form.fb_ad_account_id.trim() || null,
      revenue_goal: form.revenue_goal === "" ? null : Math.max(0, Number(form.revenue_goal)),
      goal_period: form.goal_period, traffic_sources: form.traffic_sources,
      attribution_window_days: Math.min(90, Math.max(1, Number(form.attribution_window_days) || 7)),
    };
    const { error } = editing
      ? await supabase.from("operations").update(payload as any).eq("id", editing.id)
      : await supabase.from("operations").insert(payload as any);
    if (error) return toast({ title: "Erro ao guardar", description: error.message, variant: "destructive" });
    toast({ title: editing ? "Dashboard actualizada" : "Dashboard criada" });
    setOpen(false); load();
  };

  const webhookUrl = (d: Dash) =>
    `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/hotmart-webhook?op=${d.webhook_key}`;
  const copy = (t: string) => { navigator.clipboard.writeText(t); toast({ title: "Copiado" }); };
  const toggleSource = (s: string) => setForm((f: any) => ({
    ...f, traffic_sources: f.traffic_sources.includes(s) ? f.traffic_sources.filter((x: string) => x !== s) : [...f.traffic_sources, s],
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold">Dashboards</h1>
          <p className="text-sm text-muted-foreground">Cada dashboard tem os seus dados, moeda, idioma, fuso e webhook — nada se mistura.</p>
        </div>
        <Button onClick={startNew}><Plus className="h-4 w-4 mr-1" />Nova dashboard</Button>
      </div>

      {loading ? <p className="text-muted-foreground">A carregar…</p> : items.length === 0 ? (
        <EmptyState icon={LayoutDashboard} title="Ainda sem dashboards" description="Cria uma por negócio ou fonte de tráfego (ex.: Mulher Magnética — Meta — MZN)." ctaLabel="Criar dashboard" onCta={startNew} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((d) => {
            const goal = Number(d.revenue_goal || 0);
            const rev = revenue[d.id] || 0;
            const pct = goal > 0 ? Math.min(100, (rev / goal) * 100) : 0;
            return (
              <Card key={d.id} className="border-border">
                <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="text-base truncate flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: d.color }} />{d.name}
                    </CardTitle>
                    <div className="flex flex-wrap gap-1 mt-2">
                      <Badge variant="secondary">{d.currency}</Badge>
                      <Badge variant="secondary">{(d.language || "pt").toUpperCase()}</Badge>
                      <Badge variant="outline">{d.kind === "organic" ? "Orgânico" : "Pago"}</Badge>
                      <Badge variant="outline">{d.timezone}</Badge>
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => startEdit(d)}><Pencil className="h-4 w-4" /></Button>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Faturado este mês (MZN)</span>
                      <span>{goal > 0 ? `${pct.toFixed(0)}% da meta` : "sem meta"}</span>
                    </div>
                    <p className="font-semibold">{formatCurrency(rev, "MZN")}</p>
                    {goal > 0 && <div className="h-1.5 bg-muted rounded mt-1"><div className="h-full bg-primary rounded" style={{ width: `${pct}%` }} /></div>}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Webhook exclusivo desta dashboard</p>
                    <div className="flex gap-1">
                      <Input readOnly value={webhookUrl(d)} className="text-xs h-8" />
                      <Button size="icon" variant="outline" className="h-8 w-8 shrink-0" onClick={() => copy(webhookUrl(d))}><Copy className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Conta de anúncios: {d.fb_ad_account_id || "nenhuma"} · Atribuição: {d.attribution_window_days} dias</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar dashboard" : "Nova dashboard"}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Nome</Label><Input value={form.name} maxLength={80} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Moeda</Label>
                <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CURRENCIES.map((c: any) => <SelectItem key={c.code ?? c} value={c.code ?? c}>{c.code ?? c}</SelectItem>)}</SelectContent>
                </Select></div>
              <div><Label>Idioma</Label>
                <Select value={form.language} onValueChange={(v) => setForm({ ...form, language: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LANGS.map((l) => <SelectItem key={l.v} value={l.v}>{l.l}</SelectItem>)}</SelectContent>
                </Select></div>
              <div><Label>Fuso horário</Label>
                <Select value={form.timezone} onValueChange={(v) => setForm({ ...form, timezone: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TZS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select></div>
              <div><Label>Tipo</Label>
                <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="paid">Tráfego pago</SelectItem><SelectItem value="organic">Orgânico</SelectItem></SelectContent>
                </Select></div>
            </div>
            <div><Label>Conta de anúncios (act_...)</Label><Input value={form.fb_ad_account_id} onChange={(e) => setForm({ ...form, fb_ad_account_id: e.target.value })} placeholder="act_123456789" /></div>
            <div><Label>Fontes de tráfego</Label>
              <div className="flex flex-wrap gap-1 mt-1">{SOURCES.map((s) => (
                <Badge key={s} onClick={() => toggleSource(s)} variant={form.traffic_sources.includes(s) ? "default" : "outline"} className="cursor-pointer">{s}</Badge>
              ))}</div></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Meta de faturamento ({form.currency})</Label><Input type="number" min={0} value={form.revenue_goal} onChange={(e) => setForm({ ...form, revenue_goal: e.target.value })} /></div>
              <div><Label>Período da meta</Label>
                <Select value={form.goal_period} onValueChange={(v) => setForm({ ...form, goal_period: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PERIODS.map((p) => <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>)}</SelectContent>
                </Select></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Janela de atribuição (dias)</Label><Input type="number" min={1} max={90} value={form.attribution_window_days} onChange={(e) => setForm({ ...form, attribution_window_days: e.target.value })} /></div>
              <div><Label>Cor</Label><Input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter><Button onClick={save}>Guardar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
