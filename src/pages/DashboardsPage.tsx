import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboard, type Dashboard } from "@/contexts/DashboardContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { CURRENCIES } from "@/lib/currency";
import { LayoutDashboard, Plus, Settings2, Trash2, CheckCircle2, AlertCircle, RefreshCw, Loader2, ArrowRight } from "lucide-react";

interface FbAccount {
  id: string;
  name: string;
  currency: string;
}

export default function DashboardsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { dashboards, current, selectDashboard, reloadDashboards, fmt } = useDashboard();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(false);

  // FB Accounts list from user FB connection
  const [fbAccounts, setFbAccounts] = useState<FbAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  // Form State
  const [form, setForm] = useState({
    name: "",
    language: "pt",
    currency: "MZN",
    timezone: "Africa/Maputo",
    kind: "paid",
    fb_ad_account_id: "",
    revenue_goal: "0",
    revenue_goal_period: "monthly",
    revenue_goal_metric: "net_revenue",
    product_cost: "0",
    payment_fee_pct: "0",
    other_costs: "0",
  });

  const loadFbAccounts = async () => {
    setLoadingAccounts(true);
    try {
      const { data, error } = await supabase.functions.invoke("fb-list-accounts");
      if (error || (data as any)?.error) {
        toast({
          title: "Atenção ao buscar contas FB",
          description: (data as any)?.error || error?.message || "Conecte sua conta do Facebook em Integrações",
          variant: "destructive",
        });
      } else if (data?.accounts) {
        setFbAccounts(data.accounts);
      }
    } catch (e: any) {
      console.error(e);
    }
    setLoadingAccounts(false);
  };

  useEffect(() => {
    loadFbAccounts();
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm({
      name: "",
      language: "pt",
      currency: "MZN",
      timezone: "Africa/Maputo",
      kind: "paid",
      fb_ad_account_id: "",
      revenue_goal: "50000",
      revenue_goal_period: "monthly",
      revenue_goal_metric: "net_revenue",
      product_cost: "0",
      payment_fee_pct: "0",
      other_costs: "0",
    });
    setDialogOpen(true);
  };

  const openEdit = (d: Dashboard) => {
    setEditing(d);
    setForm({
      name: d.name,
      language: d.language || "pt",
      currency: d.currency || "MZN",
      timezone: d.timezone || "Africa/Maputo",
      kind: d.kind || "paid",
      fb_ad_account_id: d.fb_ad_account_id || "",
      revenue_goal: String(d.revenue_goal || 0),
      revenue_goal_period: d.revenue_goal_period || "monthly",
      revenue_goal_metric: d.revenue_goal_metric || "net_revenue",
      product_cost: String(d.product_cost || 0),
      payment_fee_pct: String(d.payment_fee_pct || 0),
      other_costs: String(d.other_costs || 0),
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!user || !form.name.trim()) {
      toast({ title: "Informe o nome da dashboard", variant: "destructive" });
      return;
    }

    setLoading(true);
    const selectedAccount = fbAccounts.find((a) => a.id === form.fb_ad_account_id);

    const payload = {
      user_id: user.id,
      name: form.name.trim(),
      language: form.language,
      currency: form.currency,
      timezone: form.timezone,
      kind: form.kind,
      fb_ad_account_id: form.fb_ad_account_id.trim() || null,
      fb_ad_account_name: selectedAccount?.name || null,
      fb_account_currency: selectedAccount?.currency || null,
      revenue_goal: Number(form.revenue_goal) || 0,
      revenue_goal_period: form.revenue_goal_period,
      revenue_goal_metric: form.revenue_goal_metric,
      product_cost: Number(form.product_cost) || 0,
      payment_fee_pct: Number(form.payment_fee_pct) || 0,
      other_costs: Number(form.other_costs) || 0,
    };

    const { error } = editing
      ? await supabase.from("dashboards").update(payload).eq("id", editing.id)
      : await supabase.from("dashboards").insert(payload);

    setLoading(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: editing ? "Dashboard atualizada!" : "Dashboard criada com sucesso!" });
    setDialogOpen(false);
    await reloadDashboards();
  };

  const handleDelete = async (d: Dashboard) => {
    if (!confirm(`Tem certeza que deseja apagar a dashboard "${d.name}"?`)) return;
    const { error } = await supabase.from("dashboards").delete().eq("id", d.id);
    if (error) {
      toast({ title: "Erro ao apagar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Dashboard apagada com sucesso!" });
    await reloadDashboards();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <LayoutDashboard className="h-6 w-6 text-primary" />
            Gestão de Dashboards
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Crie e gerencie dashboards totalmente isoladas com moedas, metas e contas de anúncios próprias.
          </p>
        </div>
        <Button onClick={openNew} className="gradient-primary text-primary-foreground gap-2">
          <Plus className="h-4 w-4" /> Nova Dashboard
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {dashboards.map((d) => {
          const isSelected = current?.id === d.id;
          return (
            <Card
              key={d.id}
              className={`glass-card border-border transition-all relative ${
                isSelected ? "border-primary/50 shadow-lg shadow-primary/5" : ""
              }`}
            >
              <CardHeader className="pb-3 flex flex-row items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg font-bold">{d.name}</CardTitle>
                    {isSelected && (
                      <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px]">Ativa</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Moeda: <span className="font-mono font-bold text-foreground">{d.currency}</span> • Idioma: {d.language}
                  </p>
                </div>
                <Badge variant={d.kind === "paid" ? "default" : "secondary"} className="text-[10px]">
                  {d.kind === "paid" ? "⚡ Paga" : "🌱 Orgânica"}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="rounded-lg bg-muted/20 border border-border p-2.5 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Conta FB Ads:</span>
                    <span className="font-mono text-foreground font-semibold">
                      {d.fb_ad_account_name || (d.fb_ad_account_id ? `act_${d.fb_ad_account_id}` : "Nenhuma")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Meta de Faturamento:</span>
                    <span className="font-mono text-primary font-bold">
                      {fmt(d.revenue_goal || 0)} ({d.revenue_goal_period})
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <Button
                    variant={isSelected ? "outline" : "default"}
                    size="sm"
                    className="h-8 gap-1 text-xs"
                    onClick={() => selectDashboard(d.id)}
                  >
                    {isSelected ? "Selecionada" : "Abrir Dashboard"}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(d)} title="Editar">
                      <Settings2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(d)}
                      title="Apagar"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Dialog Criar/Editar Dashboard */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="glass-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Configurar Dashboard" : "Nova Dashboard Independente"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            <div className="space-y-1.5">
              <Label>Nome da Dashboard</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Mulher Magnética - Meta Ads"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Moeda Principal</Label>
                <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        <span className="font-mono font-bold mr-1">{c.code}</span> ({c.label})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Tipo de Tráfego</Label>
                <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">⚡ Tráfego Pago</SelectItem>
                    <SelectItem value="organic">🌱 Tráfego Orgânico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {form.kind === "paid" && (
              <div className="space-y-1.5 rounded-lg border border-border p-3 bg-muted/10">
                <div className="flex items-center justify-between">
                  <Label>Conta de Anúncios do Facebook</Label>
                  <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={loadFbAccounts} disabled={loadingAccounts}>
                    <RefreshCw className={`h-3 w-3 ${loadingAccounts ? "animate-spin" : ""}`} /> Atualizar
                  </Button>
                </div>
                {fbAccounts.length > 0 ? (
                  <Select value={form.fb_ad_account_id} onValueChange={(v) => setForm({ ...form, fb_ad_account_id: v })}>
                    <SelectTrigger className="font-mono text-xs">
                      <SelectValue placeholder="Selecione uma Conta do FB" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Nenhuma conta vinculada</SelectItem>
                      {fbAccounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.name} (act_{acc.id}) • {acc.currency}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={form.fb_ad_account_id}
                    onChange={(e) => setForm({ ...form, fb_ad_account_id: e.target.value })}
                    placeholder="Ou digite o ID numérico da conta de anúncios"
                    className="font-mono text-xs"
                  />
                )}
                <p className="text-[11px] text-muted-foreground">
                  Cada dashboard conecta-se a 1 conta específica de anúncios para isolamento total.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Meta de Faturamento</Label>
                <Input
                  type="number"
                  value={form.revenue_goal}
                  onChange={(e) => setForm({ ...form, revenue_goal: e.target.value })}
                  placeholder="50000"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Período da Meta</Label>
                <Select value={form.revenue_goal_period} onValueChange={(v) => setForm({ ...form, revenue_goal_period: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Diária</SelectItem>
                    <SelectItem value="weekly">Semanal</SelectItem>
                    <SelectItem value="monthly">Mensal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border">
              <div className="space-y-1">
                <Label className="text-xs">Custo Produto</Label>
                <Input
                  type="number"
                  value={form.product_cost}
                  onChange={(e) => setForm({ ...form, product_cost: e.target.value })}
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Taxa Checkout (%)</Label>
                <Input
                  type="number"
                  value={form.payment_fee_pct}
                  onChange={(e) => setForm({ ...form, payment_fee_pct: e.target.value })}
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Outros Custos</Label>
                <Input
                  type="number"
                  value={form.other_costs}
                  onChange={(e) => setForm({ ...form, other_costs: e.target.value })}
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2 border-t border-border">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={loading} className="gradient-primary text-primary-foreground">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar Dashboard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}