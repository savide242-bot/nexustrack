import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/EmptyState";
import { InfoTooltip } from "@/components/InfoTooltip";
import { CURRENCIES, convert, fetchRates, formatCurrency, rateBetween, type Rates } from "@/lib/currency";
import {
  Loader2, Plus, RefreshCw, Target, TrendingUp, Wallet, DollarSign,
  PiggyBank, Pencil, Pause, Play, Settings2, Trash2,
} from "lucide-react";

interface Operation {
  id: string;
  name: string;
  currency: string;
  fb_ad_account_id: string | null;
  kind: string;
  is_active: boolean;
}

interface AdCampaign {
  campaign_id: string;
  campaign_name: string;
  status: string;
  effective_status: string;
  objective: string | null;
  daily_budget: number | null;
  lifetime_budget: number | null;
  spend: number;
  impressions: number;
  clicks: number;
  cpc: number;
  cpm: number;
  ctr: number;
  purchases: number;
  cost_per_purchase: number;
  roas: number;
  platform_revenue: number;
}

interface SaleRow {
  id: string;
  original_amount: number;
  original_currency: string;
  amount_mzn: number | null;
  status: string;
  sale_date: string | null;
  created_at: string;
  campaign_id: string | null;
  operation_id: string | null;
}

const PRESETS = [
  { value: "today", label: "Hoje" },
  { value: "yesterday", label: "Ontem" },
  { value: "last_7d", label: "Últimos 7 dias" },
  { value: "last_14d", label: "Últimos 14 dias" },
  { value: "last_30d", label: "Últimos 30 dias" },
  { value: "this_month", label: "Este mês" },
  { value: "last_month", label: "Mês passado" },
];

function presetRange(preset: string) {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);
  const s = (d: Date) => { d.setHours(0, 0, 0, 0); return d; };
  const e = (d: Date) => { d.setHours(23, 59, 59, 999); return d; };
  if (preset === "today") return { from: s(start), to: e(end) };
  if (preset === "yesterday") { start.setDate(start.getDate() - 1); end.setDate(end.getDate() - 1); return { from: s(start), to: e(end) }; }
  if (preset === "this_month") { start.setDate(1); return { from: s(start), to: e(end) }; }
  if (preset === "last_month") { start.setMonth(start.getMonth() - 1, 1); end.setDate(0); return { from: s(start), to: e(end) }; }
  const days = preset === "last_14d" ? 14 : preset === "last_30d" ? 30 : 7;
  start.setDate(start.getDate() - (days - 1));
  return { from: s(start), to: e(end) };
}

function Kpi({ icon: Icon, label, value, hint, accent, negative }: { icon: any; label: string; value: string; hint?: string; accent?: boolean; negative?: boolean }) {
  return (
    <Card className="glass-card border-border">
      <CardContent className="p-4 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            {label}{hint && <InfoTooltip text={hint} />}
          </p>
          <p className={`font-display text-xl font-bold truncate ${negative ? "text-destructive" : accent ? "text-primary" : "text-foreground"}`}>{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Ads() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [rates, setRates] = useState<Rates>({ USD: 1 });
  const [operations, setOperations] = useState<Operation[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [loadingOps, setLoadingOps] = useState(true);

  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [accountCurrency, setAccountCurrency] = useState<string>("USD");
  const [loadingAds, setLoadingAds] = useState(false);
  const [adsError, setAdsError] = useState<string | null>(null);
  const [preset, setPreset] = useState("last_7d");

  const [sales, setSales] = useState<SaleRow[]>([]);
  const [manualSpend, setManualSpend] = useState<{ amount: number; currency: string }[]>([]);
  const [opCampaignIds, setOpCampaignIds] = useState<Set<string>>(new Set());

  // dialogs
  const [opDialogOpen, setOpDialogOpen] = useState(false);
  const [editingOp, setEditingOp] = useState<Operation | null>(null);
  const [form, setForm] = useState({ name: "", currency: "ZAR", fb_ad_account_id: "", kind: "paid" });
  const [saving, setSaving] = useState(false);

  const [budgetTarget, setBudgetTarget] = useState<AdCampaign | null>(null);
  const [budgetInput, setBudgetInput] = useState("");
  const [budgetInputCurrency, setBudgetInputCurrency] = useState("USD");
  const [applying, setApplying] = useState(false);

  const [spendOpen, setSpendOpen] = useState(false);
  const [spendForm, setSpendForm] = useState({ amount: "", currency: "USD" });

  const operation = operations.find((o) => o.id === selectedId) || null;
  const opCurrency = operation?.currency || "USD";

  useEffect(() => { fetchRates().then(setRates); }, []);

  const loadOperations = useCallback(async () => {
    if (!user) return;
    setLoadingOps(true);
    const { data } = await supabase
      .from("operations").select("*").eq("user_id", user.id).order("created_at", { ascending: true });
    const ops = (data || []) as Operation[];
    setOperations(ops);
    setSelectedId((prev) => prev || ops[0]?.id || "");
    setLoadingOps(false);
  }, [user]);

  useEffect(() => { loadOperations(); }, [loadOperations]);

  // Load sales + campaign ids + manual spend for the selected operation & period
  const loadRevenue = useCallback(async () => {
    if (!user || !operation) return;
    const { from, to } = presetRange(preset);

    const { data: camps } = await supabase
      .from("campaigns").select("id").eq("user_id", user.id).eq("operation_id", operation.id);
    const ids = new Set((camps || []).map((c: any) => c.id as string));
    setOpCampaignIds(ids);

    const { data: salesData } = await supabase
      .from("sales")
      .select("id, original_amount, original_currency, amount_mzn, status, sale_date, created_at, campaign_id, operation_id")
      .eq("user_id", user.id)
      .gte("sale_date", from.toISOString())
      .lte("sale_date", to.toISOString());

    const rows = ((salesData || []) as SaleRow[]).filter(
      (s) => s.operation_id === operation.id || (s.campaign_id && ids.has(s.campaign_id)),
    );
    setSales(rows);

    const { data: spend } = await supabase
      .from("ad_spend_manual")
      .select("amount, currency")
      .eq("operation_id", operation.id)
      .gte("spend_date", from.toISOString().slice(0, 10))
      .lte("spend_date", to.toISOString().slice(0, 10));
    setManualSpend((spend || []) as { amount: number; currency: string }[]);
  }, [user, operation, preset]);

  useEffect(() => { loadRevenue(); }, [loadRevenue]);

  const loadAds = useCallback(async () => {
    if (!operation?.fb_ad_account_id) { setCampaigns([]); setAdsError(null); return; }
    setLoadingAds(true);
    setAdsError(null);
    const { data, error } = await supabase.functions.invoke("fb-ads-control", {
      body: { action: "campaigns", ad_account_id: operation.fb_ad_account_id, date_preset: preset },
    });
    setLoadingAds(false);
    if (error || (data as any)?.error) {
      setCampaigns([]);
      setAdsError((data as any)?.error || error?.message || "Não foi possível carregar as campanhas");
      return;
    }
    setCampaigns(((data as any).campaigns || []) as AdCampaign[]);
    const cur = (data as any).account?.currency;
    if (cur) setAccountCurrency(cur);
  }, [operation, preset]);

  useEffect(() => { loadAds(); }, [loadAds]);

  const metrics = useMemo(() => {
    const validSales = sales.filter((s) => s.status === "realized" || s.status === "approved");
    const revenue = validSales.reduce(
      (sum, s) => sum + convert(Number(s.original_amount || 0), s.original_currency || "USD", opCurrency, rates), 0,
    );
    const fbSpend = campaigns.reduce((sum, c) => sum + convert(c.spend, accountCurrency, opCurrency, rates), 0);
    const extraSpend = manualSpend.reduce((sum, m) => sum + convert(Number(m.amount || 0), m.currency, opCurrency, rates), 0);
    const spend = fbSpend + extraSpend;
    const profit = revenue - spend;
    const roas = spend > 0 ? revenue / spend : 0;
    const roi = spend > 0 ? (profit / spend) * 100 : 0;
    const cpa = validSales.length > 0 && spend > 0 ? spend / validSales.length : 0;
    const dailyBudget = campaigns
      .filter((c) => c.status === "ACTIVE")
      .reduce((sum, c) => sum + convert(c.daily_budget || 0, accountCurrency, opCurrency, rates), 0);
    return { revenue, spend, profit, roas, roi, cpa, count: validSales.length, dailyBudget };
  }, [sales, campaigns, manualSpend, accountCurrency, opCurrency, rates]);

  const openNewOp = () => {
    setEditingOp(null);
    setForm({ name: "", currency: "ZAR", fb_ad_account_id: "", kind: "paid" });
    setOpDialogOpen(true);
  };

  const openEditOp = (op: Operation) => {
    setEditingOp(op);
    setForm({ name: op.name, currency: op.currency, fb_ad_account_id: op.fb_ad_account_id || "", kind: op.kind });
    setOpDialogOpen(true);
  };

  const saveOperation = async () => {
    if (!user) return;
    if (!form.name.trim()) { toast({ title: "Dá um nome à operação", variant: "destructive" }); return; }
    setSaving(true);
    const payload = {
      user_id: user.id,
      name: form.name.trim(),
      currency: form.currency,
      fb_ad_account_id: form.fb_ad_account_id.trim().replace(/^act_/, "") || null,
      kind: form.kind,
    };
    const { error } = editingOp
      ? await supabase.from("operations").update(payload).eq("id", editingOp.id)
      : await supabase.from("operations").insert(payload);
    setSaving(false);
    if (error) { toast({ title: "Erro ao guardar", description: error.message, variant: "destructive" }); return; }
    toast({ title: editingOp ? "Operação atualizada" : "Operação criada" });
    setOpDialogOpen(false);
    await loadOperations();
  };

  const deleteOperation = async (op: Operation) => {
    const { error } = await supabase.from("operations").delete().eq("id", op.id);
    if (error) { toast({ title: "Erro ao apagar", description: error.message, variant: "destructive" }); return; }
    if (selectedId === op.id) setSelectedId("");
    toast({ title: "Operação apagada" });
    loadOperations();
  };

  const openBudget = (c: AdCampaign) => {
    setBudgetTarget(c);
    setBudgetInputCurrency(opCurrency);
    setBudgetInput(c.daily_budget ? convert(c.daily_budget, accountCurrency, opCurrency, rates).toFixed(2) : "");
  };

  const applyBudget = async () => {
    if (!budgetTarget) return;
    const typed = Number(budgetInput.replace(",", "."));
    if (!isFinite(typed) || typed <= 0) { toast({ title: "Valor inválido", variant: "destructive" }); return; }
    const inAccountCurrency = convert(typed, budgetInputCurrency, accountCurrency, rates);
    setApplying(true);
    const { data, error } = await supabase.functions.invoke("fb-ads-control", {
      body: { action: "set_budget", campaign_id: budgetTarget.campaign_id, daily_budget: Number(inAccountCurrency.toFixed(2)) },
    });
    setApplying(false);
    if (error || (data as any)?.error) {
      toast({ title: "Não foi possível alterar", description: (data as any)?.error || error?.message, variant: "destructive" });
      return;
    }
    toast({
      title: "Orçamento atualizado",
      description: `${formatCurrency(typed, budgetInputCurrency)} → ${formatCurrency(inAccountCurrency, accountCurrency)} por dia`,
    });
    setBudgetTarget(null);
    loadAds();
  };

  const toggleStatus = async (c: AdCampaign) => {
    const next = c.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    setCampaigns((prev) => prev.map((x) => (x.campaign_id === c.campaign_id ? { ...x, status: next } : x)));
    const { data, error } = await supabase.functions.invoke("fb-ads-control", {
      body: { action: "set_status", campaign_id: c.campaign_id, status: next },
    });
    if (error || (data as any)?.error) {
      setCampaigns((prev) => prev.map((x) => (x.campaign_id === c.campaign_id ? { ...x, status: c.status } : x)));
      toast({ title: "Não foi possível alterar", description: (data as any)?.error || error?.message, variant: "destructive" });
      return;
    }
    toast({ title: next === "ACTIVE" ? "Campanha ativada" : "Campanha pausada" });
  };

  const addManualSpend = async () => {
    if (!user || !operation) return;
    const amount = Number(spendForm.amount.replace(",", "."));
    if (!isFinite(amount) || amount <= 0) { toast({ title: "Valor inválido", variant: "destructive" }); return; }
    const { error } = await supabase.from("ad_spend_manual").insert({
      user_id: user.id, operation_id: operation.id, amount, currency: spendForm.currency,
    });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setSpendOpen(false);
    setSpendForm({ amount: "", currency: opCurrency });
    toast({ title: "Gasto adicionado" });
    loadRevenue();
  };

  const fxLine = accountCurrency !== opCurrency
    ? `Câmbio do dia: 1 ${accountCurrency} = ${rateBetween(accountCurrency, opCurrency, rates).toFixed(2)} ${opCurrency}`
    : `Conta de anúncios em ${accountCurrency}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Controlar Anúncios</h1>
          <p className="text-sm text-muted-foreground">Cada operação com a sua moeda, gasto, ROI e ROAS reais.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={preset} onValueChange={setPreset}>
            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PRESETS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => { loadAds(); loadRevenue(); }} disabled={loadingAds}>
            <RefreshCw className={`h-4 w-4 ${loadingAds ? "animate-spin" : ""}`} />
          </Button>
          <Button onClick={openNewOp} className="gap-2"><Plus className="h-4 w-4" />Nova operação</Button>
        </div>
      </div>

      {loadingOps ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : operations.length === 0 ? (
        <EmptyState
          icon={Target}
          title="Nenhuma operação ainda"
          description="Cria uma operação (por exemplo África do Sul em ZAR) para separares os resultados de cada mercado e acompanhares o lucro real."
          ctaLabel="Criar primeira operação"
          onCta={openNewOp}
        />
      ) : (
        <>
          <Tabs value={selectedId} onValueChange={setSelectedId}>
            <TabsList className="flex-wrap h-auto">
              {operations.map((op) => (
                <TabsTrigger key={op.id} value={op.id} className="gap-2">
                  {op.name}
                  <Badge variant="outline" className="text-[10px]">{op.currency}</Badge>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {operation && (
            <>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant={operation.kind === "paid" ? "default" : "secondary"}>
                  {operation.kind === "paid" ? "Tráfego pago" : "Orgânica"}
                </Badge>
                <span>{fxLine}</span>
                <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={() => openEditOp(operation)}>
                  <Settings2 className="h-3.5 w-3.5" />Configurar
                </Button>
                <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={() => { setSpendForm({ amount: "", currency: operation.currency }); setSpendOpen(true); }}>
                  <Plus className="h-3.5 w-3.5" />Gasto manual
                </Button>
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-destructive" onClick={() => deleteOperation(operation)}>
                  <Trash2 className="h-3.5 w-3.5" />Apagar
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Kpi icon={Wallet} label="Gasto em anúncios" value={formatCurrency(metrics.spend, opCurrency)} hint="Gasto do Facebook + gastos manuais, convertidos ao câmbio do dia." />
                <Kpi icon={DollarSign} label="Receita" value={formatCurrency(metrics.revenue, opCurrency)} accent hint="Vendas confirmadas desta operação, convertidas para a moeda da operação." />
                <Kpi icon={PiggyBank} label="Lucro" value={formatCurrency(metrics.profit, opCurrency)} accent={metrics.profit >= 0} negative={metrics.profit < 0} hint="Receita menos gasto em anúncios." />
                <Kpi icon={TrendingUp} label="ROAS" value={`${metrics.roas.toFixed(2)}x`} accent hint="Receita dividida pelo gasto." />
                <Kpi icon={TrendingUp} label="ROI" value={`${metrics.roi.toFixed(1)}%`} accent={metrics.roi >= 0} negative={metrics.roi < 0} hint="Lucro sobre o gasto, em percentagem." />
                <Kpi icon={Target} label="Vendas" value={String(metrics.count)} />
                <Kpi icon={Target} label="CPA real" value={metrics.cpa > 0 ? formatCurrency(metrics.cpa, opCurrency) : "—"} hint="Custo por venda confirmada." />
                <Kpi icon={Wallet} label="Orçamento/dia ativo" value={formatCurrency(metrics.dailyBudget, opCurrency)} hint="Soma do orçamento diário das campanhas ativas." />
              </div>

              <Card className="glass-card border-border">
                <CardHeader className="flex-row items-center justify-between gap-2">
                  <CardTitle className="font-display text-lg">Campanhas do Facebook</CardTitle>
                  {loadingAds && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                </CardHeader>
                <CardContent>
                  {!operation.fb_ad_account_id ? (
                    <p className="text-sm text-muted-foreground">
                      Liga uma conta de anúncios a esta operação em <button className="text-primary underline" onClick={() => openEditOp(operation)}>Configurar</button> para controlares as campanhas aqui.
                    </p>
                  ) : adsError ? (
                    <p className="text-sm text-destructive">{adsError}</p>
                  ) : campaigns.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhuma campanha encontrada neste período.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Campanha</TableHead>
                            <TableHead>Ativa</TableHead>
                            <TableHead className="text-right">Orçamento/dia</TableHead>
                            <TableHead className="text-right">Gasto</TableHead>
                            <TableHead className="text-right">Cliques</TableHead>
                            <TableHead className="text-right">CTR</TableHead>
                            <TableHead className="text-right">Compras</TableHead>
                            <TableHead className="text-right">ROAS</TableHead>
                            <TableHead />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {campaigns.map((c) => (
                            <TableRow key={c.campaign_id}>
                              <TableCell className="max-w-[220px]">
                                <p className="truncate font-medium">{c.campaign_name}</p>
                                <p className="text-[11px] text-muted-foreground">{c.effective_status}</p>
                              </TableCell>
                              <TableCell>
                                <Switch checked={c.status === "ACTIVE"} onCheckedChange={() => toggleStatus(c)} />
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs">
                                {c.daily_budget ? formatCurrency(convert(c.daily_budget, accountCurrency, opCurrency, rates), opCurrency) : "—"}
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs">
                                {formatCurrency(convert(c.spend, accountCurrency, opCurrency, rates), opCurrency)}
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs">{c.clicks.toLocaleString()}</TableCell>
                              <TableCell className="text-right font-mono text-xs">{c.ctr.toFixed(2)}%</TableCell>
                              <TableCell className="text-right font-mono text-xs">{c.purchases}</TableCell>
                              <TableCell className="text-right font-mono text-xs text-primary">{c.roas.toFixed(2)}x</TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openBudget(c)} title="Editar orçamento">
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleStatus(c)} title={c.status === "ACTIVE" ? "Pausar" : "Ativar"}>
                                    {c.status === "ACTIVE" ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}

      {/* Operation dialog */}
      <Dialog open={opDialogOpen} onOpenChange={setOpDialogOpen}>
        <DialogContent className="glass-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display">{editingOp ? "Configurar operação" : "Nova operação"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: África do Sul" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Moeda da operação</Label>
                <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.code} — {c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">Tráfego pago</SelectItem>
                    <SelectItem value="organic">Orgânica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Conta de anúncios do Facebook</Label>
              <Input
                value={form.fb_ad_account_id}
                onChange={(e) => setForm({ ...form, fb_ad_account_id: e.target.value })}
                placeholder="Ex: 1234567890123456"
              />
              <p className="text-xs text-muted-foreground">
                Liga a tua conta do Facebook em <strong>Campanhas</strong> e cola aqui o número da conta de anúncios desta operação.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveOperation} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Budget dialog */}
      <Dialog open={!!budgetTarget} onOpenChange={(o) => !o && setBudgetTarget(null)}>
        <DialogContent className="glass-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display">Orçamento diário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground truncate">{budgetTarget?.campaign_name}</p>
            <div className="grid grid-cols-[1fr_130px] gap-3">
              <div className="space-y-2">
                <Label>Valor por dia</Label>
                <Input value={budgetInput} onChange={(e) => setBudgetInput(e.target.value)} placeholder="5" inputMode="decimal" />
              </div>
              <div className="space-y-2">
                <Label>Moeda</Label>
                <Select value={budgetInputCurrency} onValueChange={setBudgetInputCurrency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {budgetInput && isFinite(Number(budgetInput.replace(",", "."))) && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs space-y-1">
                <p>
                  Na conta ({accountCurrency}):{" "}
                  <span className="font-mono text-foreground">
                    {formatCurrency(convert(Number(budgetInput.replace(",", ".")), budgetInputCurrency, accountCurrency, rates), accountCurrency)}
                  </span>
                </p>
                <p>
                  Na operação ({opCurrency}):{" "}
                  <span className="font-mono text-primary">
                    {formatCurrency(convert(Number(budgetInput.replace(",", ".")), budgetInputCurrency, opCurrency, rates), opCurrency)}
                  </span>
                </p>
                <p className="text-muted-foreground">Câmbio do dia: 1 {budgetInputCurrency} = {rateBetween(budgetInputCurrency, accountCurrency, rates).toFixed(2)} {accountCurrency}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBudgetTarget(null)}>Cancelar</Button>
            <Button onClick={applyBudget} disabled={applying}>
              {applying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Aplicar no Facebook
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual spend dialog */}
      <Dialog open={spendOpen} onOpenChange={setSpendOpen}>
        <DialogContent className="glass-card border-border">
          <DialogHeader><DialogTitle className="font-display">Adicionar gasto manual</DialogTitle></DialogHeader>
          <div className="grid grid-cols-[1fr_130px] gap-3">
            <div className="space-y-2">
              <Label>Valor</Label>
              <Input value={spendForm.amount} onChange={(e) => setSpendForm({ ...spendForm, amount: e.target.value })} inputMode="decimal" placeholder="25" />
            </div>
            <div className="space-y-2">
              <Label>Moeda</Label>
              <Select value={spendForm.currency} onValueChange={(v) => setSpendForm({ ...spendForm, currency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSpendOpen(false)}>Cancelar</Button>
            <Button onClick={addManualSpend}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
