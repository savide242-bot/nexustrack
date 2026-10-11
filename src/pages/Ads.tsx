import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/EmptyState";
import { CURRENCIES, convert, fetchRates, formatCurrency, rateBetween, type Rates } from "@/lib/currency";
import { Loader2, Plus, RefreshCw, Target, Settings2, Trash2, TrendingUp, ArrowRightLeft, Zap } from "lucide-react";
import { KpiGrid } from "@/components/ads/KpiGrid";
import { SpendChart } from "@/components/ads/SpendChart";
import { AlertsPanel, type Alert } from "@/components/ads/AlertsPanel";
import { CampaignRow, type Campaign, type AdSet } from "@/components/ads/CampaignRow";

interface Operation { id: string; name: string; currency: string; fb_ad_account_id: string | null; kind: string; is_active: boolean; }
interface SaleRow { id: string; original_amount: number; original_currency: string; amount_mzn: number | null; status: string; sale_date: string | null; created_at: string; campaign_id: string | null; operation_id: string | null; }

const PRESETS = [
  { value: "today", label: "Hoje" },
  { value: "yesterday", label: "Ontem" },
  { value: "last_7d", label: "Ultimos 7 dias" },
  { value: "last_14d", label: "Ultimos 14 dias" },
  { value: "last_30d", label: "Ultimos 30 dias" },
  { value: "this_month", label: "Este mes" },
  { value: "last_month", label: "Mes passado" },
];

function presetRange(preset: string) {
  const now = new Date(); const start = new Date(now); const end = new Date(now);
  const s = (d: Date) => { d.setHours(0,0,0,0); return d; };
  const e = (d: Date) => { d.setHours(23,59,59,999); return d; };
  if (preset === "today") return { from: s(start), to: e(end) };
  if (preset === "yesterday") { start.setDate(start.getDate()-1); end.setDate(end.getDate()-1); return { from: s(start), to: e(end) }; }
  if (preset === "this_month") { start.setDate(1); return { from: s(start), to: e(end) }; }
  if (preset === "last_month") { start.setMonth(start.getMonth()-1,1); end.setDate(0); return { from: s(start), to: e(end) }; }
  const days = preset === "last_14d" ? 14 : preset === "last_30d" ? 30 : 7;
  start.setDate(start.getDate()-(days-1));
  return { from: s(start), to: e(end) };
}

function buildDayBuckets(preset: string): string[] {
  const { from, to } = presetRange(preset);
  const days: string[] = [];
  const cur = new Date(from);
  while (cur <= to && days.length < 31) { days.push(cur.toISOString().split("T")[0]); cur.setDate(cur.getDate()+1); }
  return days;
}

function computeAlerts(roas: number, roi: number, spend: number, dailyBudget: number, salesCount: number, fmt: (n: number) => string): Alert[] {
  const alerts: Alert[] = [];
  if (roi < 0 && spend > 0) alerts.push({ id: "roi_negative", level: "danger", message: `ROI negativo: ${roi.toFixed(1)}%`, detail: `Operacao em prejuizo de ${fmt(Math.abs(roi/100*spend))}. Considera pausar.` });
  if (roas > 0 && roas < 1.5 && roi >= 0) alerts.push({ id: "roas_low", level: "warning", message: `ROAS baixo: ${roas.toFixed(2)}x`, detail: "Receita inferior a 1.5x o gasto. Meta recomendada >= 2x." });
  if (roas >= 3) alerts.push({ id: "roas_excellent", level: "success", message: `ROAS excelente: ${roas.toFixed(2)}x`, detail: "Os anuncios estao a performar muito bem. Considera escalar!" });
  else if (roas >= 2) alerts.push({ id: "roas_good", level: "success", message: `ROAS saudavel: ${roas.toFixed(2)}x`, detail: "Performance dentro do esperado." });
  if (salesCount === 0 && spend > 0) alerts.push({ id: "no_sales", level: "warning", message: "Nenhuma venda no periodo", detail: `Gasto de ${fmt(spend)} sem conversoes. Verifica o pixel.` });
  return alerts;
}

export default function Ads() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rates, setRates] = useState<Rates>({ USD: 1 });
  const [operations, setOperations] = useState<Operation[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [loadingOps, setLoadingOps] = useState(true);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [accountCurrency, setAccountCurrency] = useState<string>("USD");
  const [loadingAds, setLoadingAds] = useState(false);
  const [adsError, setAdsError] = useState<string | null>(null);
  const [preset, setPreset] = useState("last_7d");
  const [adsetMap, setAdsetMap] = useState<Record<string, AdSet[]>>({});
  const [loadingAdsets, setLoadingAdsets] = useState<Record<string, boolean>>({});
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [manualSpend, setManualSpend] = useState<{ amount: number; currency: string; spend_date: string }[]>([]);
  const [opCampaignIds, setOpCampaignIds] = useState<Set<string>>(new Set());
  const [opDialogOpen, setOpDialogOpen] = useState(false);
  const [editingOp, setEditingOp] = useState<Operation | null>(null);
  const [form, setForm] = useState({ name: "", currency: "ZAR", fb_ad_account_id: "", kind: "paid" });
  const [saving, setSaving] = useState(false);
  const [budgetTarget, setBudgetTarget] = useState<{ id: string; name: string; isAdset: boolean } | null>(null);
  const [budgetInput, setBudgetInput] = useState("");
  const [budgetInputCurrency, setBudgetInputCurrency] = useState("USD");
  const [applying, setApplying] = useState(false);
  const [spendOpen, setSpendOpen] = useState(false);
  const [spendForm, setSpendForm] = useState({ amount: "", currency: "USD" });
  const [sendingAlertId, setSendingAlertId] = useState<string | null>(null);

  const operation = operations.find((o) => o.id === selectedId) || null;
  const opCurrency = operation?.currency || "USD";
  const fmt = (n: number) => formatCurrency(n, opCurrency);

  useEffect(() => { fetchRates().then(setRates); }, []);

  const loadOperations = useCallback(async () => {
    if (!user) return;
    setLoadingOps(true);
    const { data } = await supabase.from("operations").select("*").eq("user_id", user.id).order("created_at", { ascending: true });
    const ops = (data || []) as Operation[];
    setOperations(ops);
    setSelectedId((prev) => prev || ops[0]?.id || "");
    setLoadingOps(false);
  }, [user]);

  useEffect(() => { loadOperations(); }, [loadOperations]);

  const loadRevenue = useCallback(async () => {
    if (!user || !operation) return;
    const { from, to } = presetRange(preset);
    const { data: camps } = await supabase.from("campaigns").select("id").eq("user_id", user.id).eq("operation_id", operation.id);
    const ids = new Set((camps || []).map((c: any) => c.id as string));
    setOpCampaignIds(ids);
    const { data: salesData } = await supabase.from("sales")
      .select("id, original_amount, original_currency, amount_mzn, status, sale_date, created_at, campaign_id, operation_id")
      .eq("user_id", user.id).gte("sale_date", from.toISOString()).lte("sale_date", to.toISOString());
    const rows = ((salesData || []) as SaleRow[]).filter((s) => s.operation_id === operation.id || (s.campaign_id && ids.has(s.campaign_id)));
    setSales(rows);
    const { data: spend } = await supabase.from("ad_spend_manual").select("amount, currency, spend_date")
      .eq("operation_id", operation.id).gte("spend_date", from.toISOString().slice(0,10)).lte("spend_date", to.toISOString().slice(0,10));
    setManualSpend((spend || []) as { amount: number; currency: string; spend_date: string }[]);
  }, [user, operation, preset]);

  useEffect(() => { loadRevenue(); }, [loadRevenue]);

  const loadAds = useCallback(async () => {
    if (!operation?.fb_ad_account_id) { setCampaigns([]); setAdsError(null); return; }
    setLoadingAds(true); setAdsError(null); setAdsetMap({});
    const { data, error } = await supabase.functions.invoke("fb-ads-control", {
      body: { action: "campaigns", ad_account_id: operation.fb_ad_account_id, date_preset: preset },
    });
    setLoadingAds(false);
    if (error || (data as any)?.error) { setCampaigns([]); setAdsError((data as any)?.error || error?.message || "Nao foi possivel carregar"); return; }
    setCampaigns(((data as any).campaigns || []) as Campaign[]);
    const cur = (data as any).account?.currency;
    if (cur) setAccountCurrency(cur);
  }, [operation, preset]);

  useEffect(() => { loadAds(); }, [loadAds]);

  const fetchAdsets = useCallback(async (campaignId: string) => {
    if (adsetMap[campaignId]) return;
    setLoadingAdsets((prev) => ({ ...prev, [campaignId]: true }));
    const { data, error } = await supabase.functions.invoke("fb-ads-control", {
      body: { action: "adsets", campaign_id: campaignId, date_preset: preset },
    });
    setLoadingAdsets((prev) => ({ ...prev, [campaignId]: false }));
    if (error || (data as any)?.error) { toast({ title: "Erro ao carregar adsets", description: (data as any)?.error || error?.message, variant: "destructive" }); return; }
    setAdsetMap((prev) => ({ ...prev, [campaignId]: ((data as any).adsets || []) as AdSet[] }));
  }, [adsetMap, preset, toast]);

  const metrics = useMemo(() => {
    const validSales = sales.filter((s) => s.status === "realized" || s.status === "approved");
    const revenue = validSales.reduce((sum, s) => sum + convert(Number(s.original_amount || 0), s.original_currency || "USD", opCurrency, rates), 0);
    const fbSpend = campaigns.reduce((sum, c) => sum + convert(c.spend, accountCurrency, opCurrency, rates), 0);
    const extraSpend = manualSpend.reduce((sum, m) => sum + convert(Number(m.amount || 0), m.currency, opCurrency, rates), 0);
    const spend = fbSpend + extraSpend;
    const profit = revenue - spend;
    const roas = spend > 0 ? revenue / spend : 0;
    const roi = spend > 0 ? (profit / spend) * 100 : 0;
    const cpa = validSales.length > 0 && spend > 0 ? spend / validSales.length : 0;
    const dailyBudget = campaigns.filter((c) => c.status === "ACTIVE").reduce((sum, c) => sum + convert(c.daily_budget || 0, accountCurrency, opCurrency, rates), 0);
    return { revenue, spend, profit, roas, roi, cpa, count: validSales.length, dailyBudget };
  }, [sales, campaigns, manualSpend, accountCurrency, opCurrency, rates]);

  const chartData = useMemo(() => {
    const buckets = buildDayBuckets(preset);
    const bucketCount = buckets.length || 1;
    return buckets.map((date) => {
      const dayRevenue = sales.filter((s) => (s.sale_date || s.created_at).startsWith(date) && ["approved","realized"].includes(s.status))
        .reduce((sum, s) => sum + convert(Number(s.original_amount || 0), s.original_currency || "USD", opCurrency, rates), 0);
      const dayFbSpend = campaigns.reduce((sum, c) => sum + convert((c.spend || 0) / bucketCount, accountCurrency, opCurrency, rates), 0);
      const dayManual = manualSpend.filter((m) => m.spend_date === date).reduce((sum, m) => sum + convert(Number(m.amount || 0), m.currency, opCurrency, rates), 0);
      const daySpend = dayFbSpend + dayManual;
      return { date: date.slice(5), revenue: Math.round(dayRevenue*100)/100, spend: Math.round(daySpend*100)/100, profit: Math.round((dayRevenue-daySpend)*100)/100 };
    });
  }, [sales, campaigns, manualSpend, preset, opCurrency, accountCurrency, rates]);

  const alerts = useMemo(() => computeAlerts(metrics.roas, metrics.roi, metrics.spend, metrics.dailyBudget, metrics.count, fmt), [metrics]);

  const openNewOp = () => { setEditingOp(null); setForm({ name: "", currency: "ZAR", fb_ad_account_id: "", kind: "paid" }); setOpDialogOpen(true); };
  const openEditOp = (op: Operation) => { setEditingOp(op); setForm({ name: op.name, currency: op.currency, fb_ad_account_id: op.fb_ad_account_id || "", kind: op.kind }); setOpDialogOpen(true); };

  const saveOperation = async () => {
    if (!user) return;
    if (!form.name.trim()) { toast({ title: "Da um nome a operacao", variant: "destructive" }); return; }
    setSaving(true);
    const payload = { user_id: user.id, name: form.name.trim(), currency: form.currency, fb_ad_account_id: form.fb_ad_account_id.trim().replace(/^act_/, "") || null, kind: form.kind };
    const { error } = editingOp ? await supabase.from("operations").update(payload).eq("id", editingOp.id) : await supabase.from("operations").insert(payload);
    setSaving(false);
    if (error) { toast({ title: "Erro ao guardar", description: error.message, variant: "destructive" }); return; }
    toast({ title: editingOp ? "Operacao atualizada" : "Operacao criada" });
    setOpDialogOpen(false);
    await loadOperations();
  };

  const deleteOperation = async (op: Operation) => {
    if (!confirm(`Apagar operacao "${op.name}"?`)) return;
    const { error } = await supabase.from("operations").delete().eq("id", op.id);
    if (error) { toast({ title: "Erro ao apagar", description: error.message, variant: "destructive" }); return; }
    if (selectedId === op.id) setSelectedId("");
    toast({ title: "Operacao apagada" });
    loadOperations();
  };

  const openBudget = (id: string, name: string, isAdset: boolean, currentBudgetInAcc: number | null) => {
    setBudgetTarget({ id, name, isAdset });
    setBudgetInputCurrency(opCurrency);
    setBudgetInput(currentBudgetInAcc ? convert(currentBudgetInAcc, accountCurrency, opCurrency, rates).toFixed(2) : "");
  };

  const applyBudget = async () => {
    if (!budgetTarget) return;
    const typed = Number(budgetInput.replace(",","."));
    if (!isFinite(typed) || typed <= 0) { toast({ title: "Valor invalido", variant: "destructive" }); return; }
    const inAcc = convert(typed, budgetInputCurrency, accountCurrency, rates);
    setApplying(true);
    const { data, error } = await supabase.functions.invoke("fb-ads-control", {
      body: budgetTarget.isAdset
        ? { action: "set_adset_budget", adset_id: budgetTarget.id, daily_budget: Number(inAcc.toFixed(2)) }
        : { action: "set_budget", campaign_id: budgetTarget.id, daily_budget: Number(inAcc.toFixed(2)) },
    });
    setApplying(false);
    if (error || (data as any)?.error) { toast({ title: "Nao foi possivel alterar", description: (data as any)?.error || error?.message, variant: "destructive" }); return; }
    toast({ title: "Orcamento atualizado", description: `${formatCurrency(typed, budgetInputCurrency)} -> ${formatCurrency(inAcc, accountCurrency)} por dia` });
    setBudgetTarget(null); setAdsetMap({}); loadAds();
  };

  const toggleCampaign = async (c: Campaign) => {
    const next = c.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    setCampaigns((prev) => prev.map((x) => (x.campaign_id === c.campaign_id ? { ...x, status: next } : x)));
    const { data, error } = await supabase.functions.invoke("fb-ads-control", { body: { action: "set_status", campaign_id: c.campaign_id, status: next } });
    if (error || (data as any)?.error) {
      setCampaigns((prev) => prev.map((x) => (x.campaign_id === c.campaign_id ? { ...x, status: c.status } : x)));
      toast({ title: "Nao foi possivel alterar", description: (data as any)?.error || error?.message, variant: "destructive" }); return;
    }
    toast({ title: next === "ACTIVE" ? "Campanha ativada" : "Campanha pausada" });
  };

  const toggleAdset = async (a: AdSet, campaignId: string) => {
    const next = a.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    setAdsetMap((prev) => ({ ...prev, [campaignId]: (prev[campaignId]||[]).map((x) => (x.adset_id === a.adset_id ? { ...x, status: next } : x)) }));
    const { data, error } = await supabase.functions.invoke("fb-ads-control", { body: { action: "set_adset_status", adset_id: a.adset_id, status: next } });
    if (error || (data as any)?.error) {
      setAdsetMap((prev) => ({ ...prev, [campaignId]: (prev[campaignId]||[]).map((x) => (x.adset_id === a.adset_id ? { ...x, status: a.status } : x)) }));
      toast({ title: "Nao foi possivel alterar", description: (data as any)?.error || error?.message, variant: "destructive" }); return;
    }
    toast({ title: next === "ACTIVE" ? "Adset ativado" : "Adset pausado" });
  };

  const addManualSpend = async () => {
    if (!user || !operation) return;
    const amount = Number(spendForm.amount.replace(",","."));
    if (!isFinite(amount) || amount <= 0) { toast({ title: "Valor invalido", variant: "destructive" }); return; }
    const { error } = await supabase.from("ad_spend_manual").insert({ user_id: user.id, operation_id: operation.id, amount, currency: spendForm.currency });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setSpendOpen(false); setSpendForm({ amount: "", currency: opCurrency });
    toast({ title: "Gasto adicionado" }); loadRevenue();
  };

  const sendAlertPush = async (alert: Alert) => {
    setSendingAlertId(alert.id);
    try {
      await supabase.functions.invoke("send-push", { body: { title: `NexusTrack - ${operation?.name || "Anuncios"}`, body: alert.message, data: { url: "/ads" } } });
      toast({ title: "Notificacao enviada" });
    } catch { toast({ title: "Erro ao enviar notificacao", variant: "destructive" }); }
    setSendingAlertId(null);
  };

  const fxLine = accountCurrency !== opCurrency
    ? `1 ${accountCurrency} = ${rateBetween(accountCurrency, opCurrency, rates).toFixed(2)} ${opCurrency}`
    : `Conta em ${accountCurrency}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            Controlar Anuncios
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Cada operacao com a sua moeda, cambio ao vivo, ROI e ROAS reais.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={preset} onValueChange={setPreset}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>{PRESETS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => { loadAds(); loadRevenue(); }} disabled={loadingAds}>
            <RefreshCw className={`h-4 w-4 ${loadingAds ? "animate-spin" : ""}`} />
          </Button>
          <Button onClick={openNewOp} className="gap-2 gradient-primary text-primary-foreground">
            <Plus className="h-4 w-4" />Nova operacao
          </Button>
        </div>
      </div>

      {loadingOps ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : operations.length === 0 ? (
        <EmptyState icon={Target} title="Nenhuma operacao ainda" description="Cria uma operacao para separar resultados por mercado." actionLabel="Criar primeira operacao" onAction={openNewOp} />
      ) : (
        <>
          <Tabs value={selectedId} onValueChange={(v) => { setSelectedId(v); setAdsetMap({}); }}>
            <TabsList className="flex-wrap h-auto gap-1">
              {operations.map((op) => (
                <TabsTrigger key={op.id} value={op.id} className="gap-2">
                  {op.name}
                  <Badge variant="outline" className={`text-[10px] ${op.id === selectedId ? "border-primary/40 text-primary" : ""}`}>{op.currency}</Badge>
                  {op.kind === "organic" && <Badge variant="secondary" className="text-[9px]">Organica</Badge>}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {operation && (
            <>
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/20 px-4 py-2.5">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ArrowRightLeft className="h-3.5 w-3.5 text-primary" />
                  <span className="font-mono">{fxLine}</span>
                </div>
                <div className="ml-auto flex flex-wrap items-center gap-1.5">
                  <Badge variant={operation.kind === "paid" ? "default" : "secondary"} className="text-[10px]">
                    {operation.kind === "paid" ? "Trafego pago" : "Organica"}
                  </Badge>
                  <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => openEditOp(operation)}>
                    <Settings2 className="h-3.5 w-3.5" />Configurar
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => { setSpendForm({ amount: "", currency: operation.currency }); setSpendOpen(true); }}>
                    <Plus className="h-3.5 w-3.5" />Gasto manual
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-destructive hover:text-destructive" onClick={() => deleteOperation(operation)}>
                    <Trash2 className="h-3.5 w-3.5" />Apagar
                  </Button>
                </div>
              </div>

              <KpiGrid spend={metrics.spend} revenue={metrics.revenue} profit={metrics.profit} roas={metrics.roas} roi={metrics.roi} salesCount={metrics.count} cpa={metrics.cpa} dailyBudget={metrics.dailyBudget} currency={opCurrency} fmt={fmt} />

              <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
                <SpendChart data={chartData} currency={opCurrency} fmt={fmt} />
                <AlertsPanel alerts={alerts} onSendPush={sendAlertPush} sendingId={sendingAlertId} />
              </div>

              <Card className="glass-card border-border">
                <CardHeader className="flex-row items-center justify-between gap-2 pb-3">
                  <CardTitle className="font-display text-lg flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" />
                    Campanhas do Facebook
                    {loadingAds && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                  </CardTitle>
                  {operation.fb_ad_account_id && (
                    <span className="text-xs text-muted-foreground font-mono">act_{operation.fb_ad_account_id} - {accountCurrency}</span>
                  )}
                </CardHeader>
                <CardContent className="pt-0">
                  {!operation.fb_ad_account_id ? (
                    <div className="rounded-xl border border-dashed border-border p-8 text-center">
                      <p className="text-sm text-muted-foreground">Liga uma conta de anuncios em <button className="text-primary underline font-medium" onClick={() => openEditOp(operation)}>Configurar</button> para controlar campanhas aqui.</p>
                    </div>
                  ) : adsError ? (
                    <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4">
                      <p className="text-sm text-destructive">{adsError}</p>
                    </div>
                  ) : campaigns.length === 0 && !loadingAds ? (
                    <p className="text-sm text-muted-foreground text-center py-6">Nenhuma campanha encontrada neste periodo.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border text-left">
                            <th className="w-8 pb-2" />
                            <th className="pb-2 font-medium text-muted-foreground">Campanha</th>
                            <th className="pb-2 font-medium text-muted-foreground">Ativa</th>
                            <th className="pb-2 font-medium text-muted-foreground text-right">Orc./dia</th>
                            <th className="pb-2 font-medium text-muted-foreground text-right">Gasto</th>
                            <th className="pb-2 font-medium text-muted-foreground text-right">Cliques</th>
                            <th className="pb-2 font-medium text-muted-foreground text-right">CTR</th>
                            <th className="pb-2 font-medium text-muted-foreground text-right">Compras</th>
                            <th className="pb-2 font-medium text-muted-foreground text-right">ROAS</th>
                            <th className="pb-2 w-24" />
                          </tr>
                        </thead>
                        <tbody>
                          {campaigns.map((c) => (
                            <CampaignRow
                              key={c.campaign_id}
                              campaign={{ ...c, daily_budget: c.daily_budget ? convert(c.daily_budget, accountCurrency, opCurrency, rates) : null, spend: convert(c.spend, accountCurrency, opCurrency, rates) }}
                              adsets={(adsetMap[c.campaign_id] || []).map((a) => ({ ...a, daily_budget: a.daily_budget ? convert(a.daily_budget, accountCurrency, opCurrency, rates) : null, spend: convert(a.spend, accountCurrency, opCurrency, rates) }))}
                              loadingAdsets={!!loadingAdsets[c.campaign_id]}
                              accountCurrency={accountCurrency}
                              opCurrency={opCurrency}
                              fmt={fmt}
                              fmtAcc={(n) => formatCurrency(n, accountCurrency)}
                              onToggle={toggleCampaign}
                              onBudget={(cam) => openBudget(cam.campaign_id, cam.campaign_name, false, cam.daily_budget ? convert(cam.daily_budget, opCurrency, accountCurrency, rates) : null)}
                              onFetchAdsets={fetchAdsets}
                              onToggleAdset={(a) => toggleAdset(a, c.campaign_id)}
                              onAdsetBudget={(a) => openBudget(a.adset_id, a.adset_name, true, a.daily_budget ? convert(a.daily_budget, opCurrency, accountCurrency, rates) : null)}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}

      <Dialog open={opDialogOpen} onOpenChange={setOpDialogOpen}>
        <DialogContent className="glass-card border-border max-w-md">
          <DialogHeader><DialogTitle className="font-display">{editingOp ? "Configurar operacao" : "Nova operacao"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da operacao</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Africa do Sul, Brasil, Portugal..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Moeda da operacao</Label>
                <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c.code} value={c.code}><span className="font-mono font-bold mr-1">{c.code}</span><span className="text-muted-foreground text-xs">{c.label}</span></SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tipo de trafego</Label>
                <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="paid">Trafego pago</SelectItem><SelectItem value="organic">Organica</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>ID da Conta de Anuncios do Facebook</Label>
              <Input value={form.fb_ad_account_id} onChange={(e) => setForm({ ...form, fb_ad_account_id: e.target.value })} placeholder="Ex: 1234567890123456" className="font-mono" />
              <p className="text-xs text-muted-foreground">Vai ao Facebook Business Manager, Contas de Anuncios, copia o numero (sem "act_"). O token Meta e configurado em Integracoes.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveOperation} disabled={saving} className="gradient-primary text-primary-foreground">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!budgetTarget} onOpenChange={(o) => !o && setBudgetTarget(null)}>
        <DialogContent className="glass-card border-border max-w-sm">
          <DialogHeader><DialogTitle className="font-display">{budgetTarget?.isAdset ? "Orcamento do Adset" : "Orcamento da Campanha"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground truncate">{budgetTarget?.name}</p>
            <div className="grid grid-cols-[1fr_120px] gap-3">
              <div className="space-y-2">
                <Label>Valor por dia</Label>
                <Input value={budgetInput} onChange={(e) => setBudgetInput(e.target.value)} placeholder="5" inputMode="decimal" />
              </div>
              <div className="space-y-2">
                <Label>Moeda</Label>
                <Select value={budgetInputCurrency} onValueChange={setBudgetInputCurrency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            {budgetInput && isFinite(Number(budgetInput.replace(",","."))) && (
              <div className="rounded-xl border border-border bg-muted/20 p-3 text-xs space-y-1.5">
                <div className="flex justify-between"><span className="text-muted-foreground">Na conta ({accountCurrency})</span><span className="font-mono">{formatCurrency(convert(Number(budgetInput.replace(",",".")), budgetInputCurrency, accountCurrency, rates), accountCurrency)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Na operacao ({opCurrency})</span><span className="font-mono text-primary font-bold">{formatCurrency(convert(Number(budgetInput.replace(",",".")), budgetInputCurrency, opCurrency, rates), opCurrency)}</span></div>
                <div className="flex justify-between pt-1 border-t border-border"><span className="text-muted-foreground">Cambio do dia</span><span className="font-mono">1 {budgetInputCurrency} = {rateBetween(budgetInputCurrency, accountCurrency, rates).toFixed(3)} {accountCurrency}</span></div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBudgetTarget(null)}>Cancelar</Button>
            <Button onClick={applyBudget} disabled={applying} className="gradient-primary text-primary-foreground">
              {applying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Aplicar no Facebook
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={spendOpen} onOpenChange={setSpendOpen}>
        <DialogContent className="glass-card border-border max-w-sm">
          <DialogHeader><DialogTitle className="font-display">Adicionar gasto manual</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground -mt-1">Adiciona gastos de outras fontes para ter o custo total correcto.</p>
          <div className="grid grid-cols-[1fr_120px] gap-3">
            <div className="space-y-2"><Label>Valor</Label><Input value={spendForm.amount} onChange={(e) => setSpendForm({ ...spendForm, amount: e.target.value })} inputMode="decimal" placeholder="25" /></div>
            <div className="space-y-2"><Label>Moeda</Label><Select value={spendForm.currency} onValueChange={(v) => setSpendForm({ ...spendForm, currency: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CURRENCIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>)}</SelectContent></Select></div>
          </div>
          {spendForm.amount && spendForm.currency !== opCurrency && isFinite(Number(spendForm.amount.replace(",","."))) && (
            <div className="rounded-lg border border-border bg-muted/20 p-2 text-xs flex justify-between">
              <span className="text-muted-foreground">Em {opCurrency}</span>
              <span className="font-mono text-primary">{fmt(convert(Number(spendForm.amount.replace(",",".")), spendForm.currency, opCurrency, rates))}</span>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSpendOpen(false)}>Cancelar</Button>
            <Button onClick={addManualSpend} className="gradient-primary text-primary-foreground">Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}