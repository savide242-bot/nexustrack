import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboard, type Dashboard } from "@/contexts/DashboardContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import {
  MoreVertical, RefreshCw, Lock, AlertTriangle, X, Check, Info, Trash2, Edit3, ArrowRightLeft
} from "lucide-react";

export default function DashboardsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { dashboards, current, selectDashboard, reloadDashboards } = useDashboard();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [show2faBanner, setShow2faBanner] = useState(true);

  // Form idêntico à foto 1 da UTMify
  const [form, setForm] = useState({
    name: "",
    description: "",
    viewType: "Faturamento Normal",
    timezone: "GMT+2 | África Central (Maputo)",
    currency: "MZN",
    includeShipping: "Não habilitado",
    includeInterest: "Habilitado",
  });

  const timezones = [
    { label: "GMT+2 | África Central (Maputo)", value: "GMT+2 | África Central (Maputo)" },
    { label: "GMT+2 | Europa Oriental", value: "GMT+2 | Europa Oriental" },
    { label: "GMT+0 | Londres / UTC", value: "GMT+0 | Londres / UTC" },
    { label: "GMT+1 | Lisboa / Europa Central", value: "GMT+1 | Lisboa / Europa Central" },
    { label: "GMT-3 | Brasília / São Paulo", value: "GMT-3 | Brasília / São Paulo" },
    { label: "GMT-4 | Nova York / Manaus", value: "GMT-4 | Nova York / Manaus" },
  ];

  const currenciesList = [
    { label: "Metical Moçambicano (MZN)", value: "MZN" },
    { label: "Rand Sul-Africano (ZAR)", value: "ZAR" },
    { label: "Dólar Americano (US$)", value: "USD" },
    { label: "Euro (€)", value: "EUR" },
    { label: "Real Brasileiro (R$)", value: "BRL" },
  ];

  const openNew = () => {
    setEditing(null);
    setForm({
      name: "",
      description: "",
      viewType: "Faturamento Normal",
      timezone: "GMT+2 | África Central (Maputo)",
      currency: "MZN",
      includeShipping: "Não habilitado",
      includeInterest: "Habilitado",
    });
    setDialogOpen(true);
  };

  const openEdit = (d: Dashboard) => {
    setEditing(d);
    setForm({
      name: d.name,
      description: "",
      viewType: "Faturamento Normal",
      timezone: d.timezone || "GMT+2 | África Central (Maputo)",
      currency: d.currency || "MZN",
      includeShipping: "Não habilitado",
      includeInterest: "Habilitado",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!user || !form.name.trim()) {
      toast({ title: "Preencha o nome da dashboard", variant: "destructive" });
      return;
    }

    setLoading(true);
    const payload = {
      user_id: user.id,
      name: form.name.trim(),
      currency: form.currency,
      kind: "paid",
    };

    let res = editing
      ? await supabase.from("operations").update(payload).eq("id", editing.id)
      : await supabase.from("operations").insert(payload);

    if (res.error && res.error.message.includes("schema cache")) {
      res = editing
        ? await supabase.from("dashboards" as any).update(payload).eq("id", editing.id)
        : await supabase.from("dashboards" as any).insert(payload);
    }

    setLoading(false);
    if (res.error) {
      toast({ title: "Erro ao salvar", description: res.error.message, variant: "destructive" });
      return;
    }

    toast({ title: editing ? "Dashboard atualizada!" : "Dashboard criada com sucesso!" });
    setDialogOpen(false);
    await reloadDashboards();
  };

  const handleDelete = async (d: Dashboard) => {
    if (!confirm(`Tem certeza que deseja apagar a dashboard "${d.name}"?`)) return;
    let res = await supabase.from("operations").delete().eq("id", d.id);
    if (res.error && res.error.message.includes("schema cache")) {
      res = await supabase.from("dashboards" as any).delete().eq("id", d.id);
    }
    toast({ title: "Dashboard apagada" });
    await reloadDashboards();
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* 1. Banner de Autenticação em Dois Fatores (Foto 2 UTMify) */}
      {show2faBanner && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200 relative">
          <button
            onClick={() => setShow2faBanner(false)}
            className="absolute top-3 right-3 text-amber-400 hover:text-amber-200"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-start gap-3 pr-6">
            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-sm">
              <p className="font-semibold text-amber-300">Configurar a autenticação em dois fatores</p>
              <p className="text-xs text-amber-200/80 leading-relaxed">
                Para aumentar a segurança da sua conta, recomendamos a ativação da autenticação em dois fatores (2FA).
                Com essa opção, seu login estará mais protegido contra acessos não autorizados. Embora seja uma recomendação, a ativação não é obrigatória.
              </p>
              <button
                onClick={() => setShow2faBanner(false)}
                className="text-[11px] underline text-amber-400 hover:text-amber-300 pt-1 block"
              >
                Compreendo e não quero que essa mensagem volte a aparecer.
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Grid de Conteúdo Avançado (Foto 2 UTMify) */}
      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        {/* Card Principal: Dashboards */}
        <Card className="glass-card border-border">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              Dashboards
            </CardTitle>
            <button
              onClick={reloadDashboards}
              className="text-muted-foreground hover:text-foreground transition-colors p-1"
              title="Recarregar"
            >
              <ArrowRightLeft className="h-4 w-4" />
            </button>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">Gerencie seus dashboards:</p>

            {/* Lista de Dashboards (Cards estilo foto 2) */}
            <div className="space-y-3">
              {dashboards.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground">
                  Nenhum dashboard criado ainda. Clique no botão abaixo para criar o primeiro.
                </div>
              ) : (
                dashboards.map((d) => {
                  const isCurrent = current?.id === d.id;
                  return (
                    <div
                      key={d.id}
                      className={`rounded-xl border p-4 transition-all relative group cursor-pointer ${
                        isCurrent
                          ? "border-primary/60 bg-primary/5 shadow-md shadow-primary/5"
                          : "border-border bg-card/60 hover:border-border hover:bg-muted/10"
                      }`}
                      onClick={() => selectDashboard(d.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-foreground text-sm">{d.name}</span>
                            {isCurrent && (
                              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" title="Ativo" />
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-2 space-y-0.5">
                            <p>Faturamento Normal</p>
                            <p>{d.timezone || "GMT+2 | África Central"}</p>
                            <p>Moeda: <strong className="text-foreground font-mono">{d.currency}</strong></p>
                            <p>Contabilizar juros: habilitado</p>
                          </div>
                        </div>

                        {/* Menu de 3 pontinhos ⋮ */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <button className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted/20">
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="glass-card border-border">
                            <DropdownMenuItem onClick={() => openEdit(d)} className="gap-2 text-xs">
                              <Edit3 className="h-3.5 w-3.5" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(d)}
                              className="gap-2 text-xs text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Botão Novo Dashboard */}
            <Button
              onClick={openNew}
              className="gradient-primary text-primary-foreground font-semibold px-5 shadow-lg shadow-primary/20"
            >
              Novo Dashboard
            </Button>
          </CardContent>
        </Card>

        {/* Coluna Direita: Cards Bloqueados (Foto 2 UTMify) */}
        <div className="space-y-6">
          {/* Card: Integração MCP */}
          <Card className="glass-card border-border">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                Integração MCP <Lock className="h-4 w-4 text-muted-foreground" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Este recurso está disponível somente para usuários com uma assinatura paga.
              </p>
            </CardContent>
          </Card>

          {/* Card: Colaboradores */}
          <Card className="glass-card border-border">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                Colaboradores <Lock className="h-4 w-4 text-muted-foreground" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Este recurso está disponível somente para usuários com uma assinatura paga.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 3. Modal: Criar Dashboard (Foto 1 UTMify) */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="glass-card border-border max-w-md p-6">
          <DialogHeader className="pb-2 flex flex-row items-center justify-between">
            <DialogTitle className="text-xl font-bold font-display">
              {editing ? "Editar Dashboard" : "Criar Dashboard"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 text-left">
            {/* 1. Nome */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground/90">Nome</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Produto X"
                className="bg-muted/10 border-border h-10"
              />
            </div>

            {/* 2. Descrição (opcional) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground/90">Descrição (opcional)</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Contém apenas as vendas do Produto X"
                className="bg-muted/10 border-border h-10"
              />
            </div>

            {/* 3. Tipo de Visualização */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1">
                <Label className="text-xs font-medium text-foreground/90">Tipo de Visualização</Label>
                <Info className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <Select value={form.viewType} onValueChange={(v) => setForm({ ...form, viewType: v })}>
                <SelectTrigger className="bg-muted/10 border-border h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Faturamento Normal">Faturamento Normal</SelectItem>
                  <SelectItem value="Faturamento Líquido">Faturamento Líquido</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 4. Fuso horário */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground/90">Fuso horário</Label>
              <Select value={form.timezone} onValueChange={(v) => setForm({ ...form, timezone: v })}>
                <SelectTrigger className="bg-muted/10 border-border h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timezones.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 5. Moeda da Conta */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1">
                <Label className="text-xs font-medium text-foreground/90">Moeda da Conta</Label>
                <Info className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                <SelectTrigger className="bg-muted/10 border-border h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currenciesList.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 6. Contabilizar frete */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1">
                <Label className="text-xs font-medium text-foreground/90">Contabilizar frete</Label>
                <Info className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <Select value={form.includeShipping} onValueChange={(v) => setForm({ ...form, includeShipping: v })}>
                <SelectTrigger className="bg-muted/10 border-border h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Não habilitado">Não habilitado</SelectItem>
                  <SelectItem value="Habilitado">Habilitado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 7. Contabilizar juros */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1">
                <Label className="text-xs font-medium text-foreground/90">Contabilizar juros</Label>
                <Info className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <Select value={form.includeInterest} onValueChange={(v) => setForm({ ...form, includeInterest: v })}>
                <SelectTrigger className="bg-muted/10 border-border h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Habilitado">Habilitado</SelectItem>
                  <SelectItem value="Não habilitado">Não habilitado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Botão Submeter */}
            <div className="pt-2">
              <Button
                onClick={handleSave}
                disabled={loading}
                className="w-full gradient-primary text-primary-foreground font-semibold h-11 text-sm shadow-lg shadow-primary/20"
              >
                {loading ? "Salvando..." : (editing ? "Salvar Alterações" : "Criar Dashboard")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}