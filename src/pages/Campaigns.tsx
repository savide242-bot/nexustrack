import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboard } from "@/contexts/DashboardContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  ComposableMap, Geographies, Geography, ZoomableGroup
} from "react-simple-maps";
import {
  Megaphone, Layers, Image, FolderKanban, RefreshCw, CheckCircle2,
  DollarSign, TrendingUp, ShoppingCart, Target, Globe, Edit2, Loader2,
  AlertCircle, ChevronRight, Zap
} from "lucide-react";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// Mapeamento ISO de países
const ISO_MAP: Record<string, string> = {
  "BR": "076", "MZ": "508", "ZA": "710", "PT": "620", "AO": "024",
  "US": "840", "GB": "826", "ES": "724", "FR": "250", "DE": "276",
  "IT": "380", "CA": "124", "AU": "036", "IN": "356", "ZW": "716",
};

const COUNTRY_NAMES: Record<string, string> = {
  "MZ": "Moçambique", "ZA": "África do Sul", "BR": "Brasil", "PT": "Portugal",
  "AO": "Angola", "US": "Estados Unidos", "GB": "Reino Unido", "ES": "Espanha",
};

interface CampaignItem {
  id: string;
  name: string;
  status: "ACTIVE" | "PAUSED" | string;
  daily_budget: number;
  spend: number;
  impressions: number;
  clicks: number;
  cpm: number;
  cpc: number;
  ctr: number;
  purchases: number;
  revenue: number;
  roas: number;
  cpa: number;
  profit: number;
  margin: number;
  updated_at?: string;
}

export default function Campaigns() {
  const { user } = useAuth();
  const { current, fmt, cv } = useDashboard();
  const { toast } = useToast();

  const [activeMetaTab, setActiveMetaTab] = useState<"contas" | "campanhas" | "conjuntos" | "anuncios">("campanhas");
  const [loading, setLoading] = useState(false);
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [adsets, setAdsets] = useState<any[]>([]);

  // Filtros idênticos à Foto 2 da UTMify
  const [searchName, setSearchName] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("last_7d");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Modal de edição de orçamento
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignItem | null>(null);
  const [newBudget, setNewBudget] = useState("");

  // Mapa de Vendas
  const [salesByCountry, setSalesByCountry] = useState<Record<string, { count: number; total: number }>>({});
  const [tooltipCountry, setTooltipCountry] = useState<{ name: string; count: number; total: number } | null>(null);

  // 1. Carregar Campanhas do Facebook Ads
  const loadFacebookData = useCallback(async () => {
    if (!user || !current) return;
    setLoading(true);

    const accountId = current.fb_ad_account_id;

    // Buscar Vendas por País para o Mapa
    const { data: salesData } = await supabase
      .from("sales")
      .select("amount_mzn, original_amount, original_currency, status, lead_id, leads_clicks(country)");

    const countryMap: Record<string, { count: number; total: number }> = {};
    (salesData || []).forEach((s: any) => {
      if (s.status === "approved" || s.status === "realized") {
        const countryCode = s.leads_clicks?.country?.toUpperCase() || "MZ";
        const val = cv(Number(s.original_amount || 0), s.original_currency || "USD");
        if (!countryMap[countryCode]) countryMap[countryCode] = { count: 0, total: 0 };
        countryMap[countryCode].count += 1;
        countryMap[countryCode].total += val;
      }
    });
    setSalesByCountry(countryMap);

    // Buscar Campanhas da Meta Marketing API
    if (accountId) {
      try {
        const { data: resData, error } = await supabase.functions.invoke("fb-ads-control", {
          body: {
            action: "campaigns",
            ad_account_id: accountId,
            date_preset: dateFilter,
          },
        });

        if (resData?.campaigns) {
          const list: CampaignItem[] = resData.campaigns.map((c: any) => {
            const spend = cv(c.spend || 0, resData.account?.currency || "USD");
            const purchases = c.purchases || 0;
            // Usa o faturamento real reportado pelo Facebook ou o valor exato registrado
            const realPlatformRevenue = Number(c.platform_revenue ?? c.revenue ?? 0);
            const revenue = cv(realPlatformRevenue, resData.account?.currency || "USD");
            const profit = revenue - spend;
            const roas = spend > 0 ? revenue / spend : 0;
            const cpa = purchases > 0 ? spend / purchases : 0;
            const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

            return {
              id: c.id || c.campaign_id,
              name: c.name || c.campaign_name || `Campanha ${c.id || c.campaign_id}`,
              status: c.status || "PAUSED",
              daily_budget: cv((c.daily_budget || 0), resData.account?.currency || "USD"),
              spend,
              impressions: c.impressions || 0,
              clicks: c.clicks || 0,
              cpm: c.cpm || 0,
              cpc: c.cpc || 0,
              ctr: c.ctr || 0,
              purchases,
              revenue,
              roas,
              cpa,
              profit,
              margin,
              updated_at: c.updated_time ? new Date(c.updated_time).toLocaleDateString() : "Hoje",
            };
          });
          setCampaigns(list);
        }

        // Buscar Conjuntos se aba selecionada
        const { data: adsetData } = await supabase.functions.invoke("fb-ads-control", {
          body: { action: "adsets", ad_account_id: accountId, date_preset: dateFilter },
        });
        if (adsetData?.adsets) {
          setAdsets(adsetData.adsets);
        }
      } catch (err) {
        console.error("Erro FB Ads:", err);
      }
    } else {
      setCampaigns([]);
    }

    setLoading(false);
  }, [user, current, dateFilter, cv]);

  useEffect(() => {
    loadFacebookData();
  }, [loadFacebookData]);

  // 2. Alternar Status (Pausar / Ativar Campanha)
  const handleToggleStatus = async (item: CampaignItem) => {
    if (!current?.fb_ad_account_id) return;
    const nextStatus = item.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    setUpdatingId(item.id);

    try {
      const { data, error } = await supabase.functions.invoke("fb-ads-control", {
        body: {
          action: "set_campaign_status",
          campaign_id: item.id,
          status: nextStatus,
        },
      });

      if (error || (data as any)?.error) {
        toast({ title: "Erro ao alterar no Facebook", description: error?.message || (data as any)?.error, variant: "destructive" });
      } else {
        toast({ title: `Campanha ${nextStatus === "ACTIVE" ? "ativada" : "pausada"} com sucesso!` });
        setCampaigns((prev) =>
          prev.map((c) => (c.id === item.id ? { ...c, status: nextStatus } : c))
        );
      }
    } catch (e: any) {
      toast({ title: "Falha na comunicação", description: e.message, variant: "destructive" });
    }
    setUpdatingId(null);
  };

  // 3. Atualizar Orçamento
  const handleSaveBudget = async () => {
    if (!selectedCampaign || !current?.fb_ad_account_id) return;
    const budgetVal = Number(newBudget);
    if (isNaN(budgetVal) || budgetVal <= 0) {
      toast({ title: "Informe um valor válido", variant: "destructive" });
      return;
    }

    setUpdatingId(selectedCampaign.id);
    try {
      const { data, error } = await supabase.functions.invoke("fb-ads-control", {
        body: {
          action: "set_campaign_budget",
          campaign_id: selectedCampaign.id,
          daily_budget: budgetVal,
        },
      });

      if (error || (data as any)?.error) {
        toast({ title: "Erro ao atualizar orçamento", description: error?.message, variant: "destructive" });
      } else {
        toast({ title: "Orçamento atualizado no Facebook!" });
        setCampaigns((prev) =>
          prev.map((c) => (c.id === selectedCampaign.id ? { ...c, daily_budget: budgetVal } : c))
        );
        setBudgetModalOpen(false);
      }
    } catch (e: any) {
      toast({ title: "Falha ao aplicar", description: e.message, variant: "destructive" });
    }
    setUpdatingId(null);
  };

  // Filtragem das Campanhas
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((c) => {
      const matchesName = !searchName || c.name.toLowerCase().includes(searchName.toLowerCase());
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && c.status === "ACTIVE") ||
        (statusFilter === "paused" && c.status === "PAUSED");
      return matchesName && matchesStatus;
    });
  }, [campaigns, searchName, statusFilter]);

  // Totais
  const totals = useMemo(() => {
    return filteredCampaigns.reduce(
      (acc, c) => ({
        spend: acc.spend + c.spend,
        revenue: acc.revenue + c.revenue,
        profit: acc.profit + c.profit,
        purchases: acc.purchases + c.purchases,
      }),
      { spend: 0, revenue: 0, profit: 0, purchases: 0 }
    );
  }, [filteredCampaigns]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 1. Header com Abas Superiores Idênticas à Foto 2 da UTMify */}
      <div className="flex flex-wrap items-center justify-between border-b border-border/60 pb-2 gap-4">
        {/* Abas: Contas, Campanhas, Conjuntos, Anúncios */}
        <div className="flex items-center gap-1 overflow-x-auto">
          <button
            onClick={() => setActiveMetaTab("contas")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
              activeMetaTab === "contas"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <FolderKanban className="h-4 w-4" /> Contas
          </button>
          <button
            onClick={() => setActiveMetaTab("campanhas")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
              activeMetaTab === "campanhas"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Megaphone className="h-4 w-4" /> Campanhas
          </button>
          <button
            onClick={() => setActiveMetaTab("conjuntos")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
              activeMetaTab === "conjuntos"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Layers className="h-4 w-4" /> Conjuntos
          </button>
          <button
            onClick={() => setActiveMetaTab("anuncios")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
              activeMetaTab === "anuncios"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Image className="h-4 w-4" /> Anúncios
          </button>
        </div>

        {/* Lado Direito: Status + Atualizar */}
        <div className="flex items-center gap-3">
          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs gap-1 hidden sm:flex">
            <CheckCircle2 className="h-3 w-3" /> Todas as vendas trackeadas
          </Badge>
          <span className="text-xs text-muted-foreground font-mono hidden md:inline">Atualizado agora mesmo</span>
          <Button
            onClick={loadFacebookData}
            disabled={loading}
            className="gradient-primary text-primary-foreground text-xs gap-1.5 h-8 px-4 font-semibold shadow-md shadow-primary/20"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>
      </div>

      {/* 2. Barra de Filtros Idêntica à Foto 2 da UTMify */}
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 bg-card/40 p-3.5 rounded-xl border border-border">
        {/* Nome da Campanha */}
        <div className="space-y-1">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase font-mono">Nome da Campanha</span>
          <Input
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            placeholder="Filtrar por nome"
            className="h-9 text-xs bg-muted/20 border-border"
          />
        </div>

        {/* Status da Campanha */}
        <div className="space-y-1">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase font-mono">Status da Campanha</span>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 text-xs bg-muted/20 border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Qualquer</SelectItem>
              <SelectItem value="active">Ativa</SelectItem>
              <SelectItem value="paused">Pausada</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Período de Visualização */}
        <div className="space-y-1">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase font-mono">Período de Visualização</span>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="h-9 text-xs bg-muted/20 border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="yesterday">Ontem</SelectItem>
              <SelectItem value="last_7d">Últimos 7 dias</SelectItem>
              <SelectItem value="last_30d">Últimos 30 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Conta de Anúncio */}
        <div className="space-y-1">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase font-mono">Conta de Anúncio</span>
          <div className="h-9 px-3 rounded-md border border-border bg-muted/20 flex items-center justify-between text-xs font-mono truncate">
            <span className="truncate">{current?.fb_ad_account_id ? `act_${current.fb_ad_account_id}` : "Todas"}</span>
          </div>
        </div>
      </div>

      {/* 3. Tabela Profissional com Switches Ativo/Pausado e Edição de Orçamento */}
      {activeMetaTab === "campanhas" && (
        <Card className="glass-card border-border overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="border-border text-xs uppercase font-mono">
                  <TableHead className="w-12 text-center">Status</TableHead>
                  <TableHead className="min-w-[200px]">Campanha</TableHead>
                  <TableHead className="text-right">Orçamento</TableHead>
                  <TableHead className="text-right">Vendas</TableHead>
                  <TableHead className="text-right">CPA</TableHead>
                  <TableHead className="text-right">Gastos</TableHead>
                  <TableHead className="text-right">Faturamento</TableHead>
                  <TableHead className="text-right">Lucro</TableHead>
                  <TableHead className="text-right">ROAS</TableHead>
                  <TableHead className="text-right">Margem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="py-12 text-center text-xs text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
                      Carregando campanhas do Facebook Ads...
                    </TableCell>
                  </TableRow>
                ) : filteredCampaigns.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="py-12 text-center text-xs text-muted-foreground">
                      Nenhuma campanha encontrada no período selecionado ou conta não conectada.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCampaigns.map((c) => {
                    const isUpdating = updatingId === c.id;
                    const isRunning = c.status === "ACTIVE";
                    return (
                      <TableRow key={c.id} className="border-border hover:bg-muted/10 text-xs">
                        {/* Switch de Status que Pausa/Ativa no Facebook */}
                        <TableCell className="text-center">
                          {isUpdating ? (
                            <Loader2 className="h-4 w-4 animate-spin mx-auto text-primary" />
                          ) : (
                            <Switch
                              checked={isRunning}
                              onCheckedChange={() => handleToggleStatus(c)}
                              title={isRunning ? "Clique para pausar" : "Clique para ativar"}
                            />
                          )}
                        </TableCell>

                        {/* Nome da Campanha */}
                        <TableCell className="font-semibold text-foreground">
                          <p className="truncate max-w-[240px]">{c.name}</p>
                          <span className="text-[10px] text-muted-foreground font-mono">ID: {c.id}</span>
                        </TableCell>

                        {/* Orçamento Diário Editável */}
                        <TableCell className="text-right">
                          <button
                            onClick={() => {
                              setSelectedCampaign(c);
                              setNewBudget(String(c.daily_budget));
                              setBudgetModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 font-mono font-medium hover:text-primary transition-colors p-1 rounded hover:bg-muted/20"
                            title="Editar orçamento"
                          >
                            <span>{fmt(c.daily_budget)}/dia</span>
                            <Edit2 className="h-3 w-3 opacity-60" />
                          </button>
                        </TableCell>

                        {/* Vendas */}
                        <TableCell className="text-right font-mono font-bold text-primary">
                          {c.purchases}
                        </TableCell>

                        {/* CPA */}
                        <TableCell className="text-right font-mono">
                          {c.cpa > 0 ? fmt(c.cpa) : "N/A"}
                        </TableCell>

                        {/* Gastos */}
                        <TableCell className="text-right font-mono text-foreground">
                          {fmt(c.spend)}
                        </TableCell>

                        {/* Faturamento */}
                        <TableCell className="text-right font-mono font-bold text-foreground">
                          {fmt(c.revenue)}
                        </TableCell>

                        {/* Lucro */}
                        <TableCell className={`text-right font-mono font-bold ${c.profit >= 0 ? "text-emerald-400" : "text-destructive"}`}>
                          {fmt(c.profit)}
                        </TableCell>

                        {/* ROAS */}
                        <TableCell className="text-right font-mono font-bold text-primary">
                          {c.roas > 0 ? `${c.roas.toFixed(2)}x` : "N/A"}
                        </TableCell>

                        {/* Margem */}
                        <TableCell className="text-right font-mono">
                          {c.revenue > 0 ? `${c.margin.toFixed(1)}%` : "N/A"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* 4. MAPA MUNDI SURREAL DE VENDAS (A Funcionalidade Pedida) */}
      <Card className="glass-card border-border overflow-hidden">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary animate-pulse" />
              Mapa Global de Vendas em Tempo Real
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Visualize de onde vêm suas vendas no mundo. Os países com vendas ativas acendem com brilho neon!
            </p>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
            {/* O Mapa Mundi Estilizado */}
            <div className="relative rounded-2xl border border-border bg-[#090a0f] p-2 overflow-hidden shadow-2xl">
              {tooltipCountry && (
                <div className="absolute top-4 left-4 z-10 bg-black/80 border border-primary/40 backdrop-blur-md rounded-xl p-3 shadow-xl pointer-events-none">
                  <p className="font-bold text-sm text-foreground flex items-center gap-1.5">
                    🌍 {tooltipCountry.name}
                  </p>
                  <p className="text-xs text-primary font-mono mt-1 font-bold">
                    {tooltipCountry.count} venda(s) registrada(s)
                  </p>
                  <p className="text-xs text-muted-foreground font-mono">
                    Total: <strong className="text-foreground">{fmt(tooltipCountry.total)}</strong>
                  </p>
                </div>
              )}

              <ComposableMap
                projectionConfig={{ scale: 140, center: [0, 20] }}
                className="w-full h-[320px] sm:h-[400px]"
              >
                <ZoomableGroup>
                  <Geographies geography={GEO_URL}>
                    {({ geographies }) =>
                      geographies.map((geo) => {
                        // Descobrir se este país tem vendas
                        const numericId = geo.id;
                        let matchedSales = { count: 0, total: 0 };
                        let countryCodeFound = "";

                        Object.entries(ISO_MAP).forEach(([code, isoId]) => {
                          if (isoId === numericId && salesByCountry[code]) {
                            matchedSales = salesByCountry[code];
                            countryCodeFound = code;
                          }
                        });

                        const hasSales = matchedSales.count > 0;

                        return (
                          <Geography
                            key={geo.rsmKey}
                            geography={geo}
                            onMouseEnter={() => {
                              if (hasSales) {
                                setTooltipCountry({
                                  name: COUNTRY_NAMES[countryCodeFound] || geo.properties.name,
                                  count: matchedSales.count,
                                  total: matchedSales.total,
                                });
                              }
                            }}
                            onMouseLeave={() => setTooltipCountry(null)}
                            style={{
                              default: {
                                fill: hasSales ? "#00FF7F" : "#171923",
                                stroke: hasSales ? "#00FF7F" : "#2d3748",
                                strokeWidth: hasSales ? 1 : 0.5,
                                outline: "none",
                                filter: hasSales ? "drop-shadow(0 0 6px rgba(0,255,127,0.7))" : "none",
                                transition: "all 0.3s ease",
                              },
                              hover: {
                                fill: hasSales ? "#39FF14" : "#2d3748",
                                stroke: "#00FF7F",
                                strokeWidth: 1.5,
                                outline: "none",
                                cursor: hasSales ? "pointer" : "default",
                              },
                            }}
                          />
                        );
                      })
                    }
                  </Geographies>
                </ZoomableGroup>
              </ComposableMap>
            </div>

            {/* Ranking dos Países que Mais Vendem */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
                Ranking de Vendas por País
              </p>

              {Object.keys(salesByCountry).length === 0 ? (
                <div className="p-6 rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground">
                  Nenhuma venda internacional registrada ainda. Conecte webhooks para acender o mapa!
                </div>
              ) : (
                <div className="space-y-2">
                  {Object.entries(salesByCountry)
                    .sort(([, a], [, b]) => b.count - a.count)
                    .map(([code, data]) => (
                      <div
                        key={code}
                        className="p-3 rounded-xl border border-border bg-card/60 flex items-center justify-between shadow-sm"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold font-mono text-primary">
                            {code}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-foreground">
                              {COUNTRY_NAMES[code] || code}
                            </p>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {data.count} compra(s)
                            </span>
                          </div>
                        </div>
                        <span className="font-mono text-xs font-bold text-primary">
                          {fmt(data.total)}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal: Editar Orçamento */}
      <Dialog open={budgetModalOpen} onOpenChange={setBudgetModalOpen}>
        <DialogContent className="glass-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar Orçamento Diário</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-left">
            <p className="text-xs text-muted-foreground">
              Campanha: <strong className="text-foreground">{selectedCampaign?.name}</strong>
            </p>
            <div className="space-y-1">
              <span className="text-xs font-semibold">Novo Orçamento Diário ({current?.currency}):</span>
              <Input
                type="number"
                value={newBudget}
                onChange={(e) => setNewBudget(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setBudgetModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveBudget} className="gradient-primary text-primary-foreground font-semibold">
              Salvar no Facebook
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}