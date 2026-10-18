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
  campaign_id?: string;
  adset_id?: string;
  status: "ACTIVE" | "PAUSED" | string;
  daily_budget: number;
  spend: number;
  impressions: number;
  clicks: number;
  cpm: number;
  cpc: number;
  ctr: number;
  purchases: number;
  checkouts: number;
  cost_per_checkout: number;
  revenue: number;
  roas: number;
  roi: number;
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
  const [adsets, setAdsets] = useState<CampaignItem[]>([]);
  const [ads, setAds] = useState<CampaignItem[]>([]);

  // Filtros de Campanha Ativa e Data padrão HOJE
  const [selectedParentCampaignId, setSelectedParentCampaignId] = useState<string>("all");
  const [selectedParentAdsetId, setSelectedParentAdsetId] = useState<string>("all");
  const [searchName, setSearchName] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("today");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Modal de edição de orçamento
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignItem | null>(null);
  const [newBudget, setNewBudget] = useState("");

  // Mapa de Vendas
  const [salesByCountry, setSalesByCountry] = useState<Record<string, { count: number; total: number }>>({});
  const [tooltipCountry, setTooltipCountry] = useState<{ name: string; count: number; total: number } | null>(null);

  const mapItem = (raw: any, accCurrency: string): CampaignItem => {
    const spend = cv(raw.spend || 0, accCurrency || "USD");
    const purchases = raw.purchases || 0;
    const checkouts = raw.checkouts || 0;
    const impressions = raw.impressions || 0;
    const clicks = raw.clicks || 0;
    const cpm = cv(raw.cpm || 0, accCurrency || "USD");
    const cpc = cv(raw.cpc || 0, accCurrency || "USD");
    const ctr = raw.ctr || (impressions > 0 ? (clicks / impressions) * 100 : 0);

    const realPlatformRevenue = Number(raw.platform_revenue ?? raw.revenue ?? 0);
    const revenue = cv(realPlatformRevenue, accCurrency || "USD");
    const profit = revenue - spend;
    const roas = spend > 0 ? revenue / spend : 0;
    const roi = spend > 0 ? (profit / spend) * 100 : 0;
    const cpa = purchases > 0 ? spend / purchases : 0;
    const costPerCheckout = cv(raw.cost_per_checkout || (checkouts > 0 ? spend / checkouts : 0), accCurrency || "USD");
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

    return {
      id: raw.id || raw.ad_id || raw.adset_id || raw.campaign_id,
      name: raw.name || raw.ad_name || raw.adset_name || raw.campaign_name || "Sem nome",
      campaign_id: raw.campaign_id,
      adset_id: raw.adset_id,
      status: raw.status || "PAUSED",
      daily_budget: cv((raw.daily_budget || 0), accCurrency || "USD"),
      spend,
      impressions,
      clicks,
      cpm,
      cpc,
      ctr,
      purchases,
      checkouts,
      cost_per_checkout: costPerCheckout,
      revenue,
      roas,
      roi,
      cpa,
      profit,
      margin,
      updated_at: raw.updated_time ? new Date(raw.updated_time).toLocaleDateString() : "Hoje",
    };
  };

  // 1. Carregar Campanhas, Conjuntos e Anúncios do Facebook Ads
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

    // Buscar Campanhas, Conjuntos e Anúncios da Meta Marketing API
    if (accountId) {
      try {
        const [campRes, adsetRes, adsRes] = await Promise.all([
          supabase.functions.invoke("fb-ads-control", {
            body: { action: "campaigns", ad_account_id: accountId, date_preset: dateFilter },
          }),
          supabase.functions.invoke("fb-ads-control", {
            body: { action: "adsets", ad_account_id: accountId, date_preset: dateFilter },
          }),
          supabase.functions.invoke("fb-ads-control", {
            body: { action: "ads", ad_account_id: accountId, date_preset: dateFilter },
          }),
        ]);

        const accCurrency = campRes.data?.account?.currency || "USD";

        if (campRes.data?.campaigns) {
          setCampaigns(campRes.data.campaigns.map((c: any) => mapItem(c, accCurrency)));
        }
        if (adsetRes.data?.adsets) {
          setAdsets(adsetRes.data.adsets.map((a: any) => mapItem(a, accCurrency)));
        }
        if (adsRes.data?.ads) {
          setAds(adsRes.data.ads.map((ad: any) => mapItem(ad, accCurrency)));
        }
      } catch (err) {
        console.error("Erro FB Ads:", err);
      }
    } else {
      setCampaigns([]);
      setAdsets([]);
      setAds([]);
    }

    setLoading(false);
  }, [user, current, dateFilter, cv]);

  useEffect(() => {
    loadFacebookData();
  }, [loadFacebookData]);

  // 2. Alternar Status (Pausar / Ativar Campanha, Conjunto ou Anúncio)
  const handleToggleStatus = async (item: CampaignItem, type: "campaign" | "adset" | "ad" = "campaign") => {
    if (!current?.fb_ad_account_id) return;
    const nextStatus = item.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    setUpdatingId(item.id);

    const action = type === "ad" ? "set_ad_status" : type === "adset" ? "set_adset_status" : "set_campaign_status";
    const body: any = { action, status: nextStatus };
    if (type === "ad") body.ad_id = item.id;
    else if (type === "adset") body.adset_id = item.id;
    else body.campaign_id = item.id;

    try {
      const { data, error } = await supabase.functions.invoke("fb-ads-control", { body });

      if (error || (data as any)?.error) {
        toast({ title: "Erro ao alterar no Facebook", description: error?.message || (data as any)?.error, variant: "destructive" });
      } else {
        const label = type === "ad" ? "Anúncio" : type === "adset" ? "Conjunto" : "Campanha";
        toast({ title: `${label} ${nextStatus === "ACTIVE" ? "ativado" : "pausado"} com sucesso!` });
        if (type === "campaign") {
          setCampaigns((prev) => prev.map((c) => (c.id === item.id ? { ...c, status: nextStatus } : c)));
        } else if (type === "adset") {
          setAdsets((prev) => prev.map((a) => (a.id === item.id ? { ...a, status: nextStatus } : a)));
        } else {
          setAds((prev) => prev.map((ad) => (ad.id === item.id ? { ...ad, status: nextStatus } : ad)));
        }
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
      const isAdset = activeMetaTab === "conjuntos";
      const action = isAdset ? "set_adset_budget" : "set_campaign_budget";
      const body: any = { action, daily_budget: budgetVal };
      if (isAdset) body.adset_id = selectedCampaign.id;
      else body.campaign_id = selectedCampaign.id;

      const { data, error } = await supabase.functions.invoke("fb-ads-control", { body });

      if (error || (data as any)?.error) {
        toast({ title: "Erro ao atualizar orçamento", description: error?.message, variant: "destructive" });
      } else {
        toast({ title: "Orçamento atualizado no Facebook!" });
        if (isAdset) {
          setAdsets((prev) => prev.map((a) => (a.id === selectedCampaign.id ? { ...a, daily_budget: budgetVal } : a)));
        } else {
          setCampaigns((prev) => prev.map((c) => (c.id === selectedCampaign.id ? { ...c, daily_budget: budgetVal } : c)));
        }
        setBudgetModalOpen(false);
      }
    } catch (e: any) {
      toast({ title: "Falha ao aplicar", description: e.message, variant: "destructive" });
    }
    setUpdatingId(null);
  };

  // Obter itens da aba ativa respeitando a hierarquia da campanha/conjunto selecionado
  const currentItems = useMemo(() => {
    let list: CampaignItem[] = [];
    if (activeMetaTab === "anuncios") {
      list = ads;
      if (selectedParentAdsetId !== "all") {
        list = list.filter((ad) => ad.adset_id === selectedParentAdsetId);
      }
      if (selectedParentCampaignId !== "all") {
        list = list.filter((ad) => ad.campaign_id === selectedParentCampaignId);
      }
    } else if (activeMetaTab === "conjuntos") {
      list = adsets;
      if (selectedParentCampaignId !== "all") {
        list = list.filter((a) => a.campaign_id === selectedParentCampaignId);
      }
    } else {
      list = campaigns;
    }

    return list.filter((item) => {
      const matchesName = !searchName || item.name.toLowerCase().includes(searchName.toLowerCase());
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && item.status === "ACTIVE") ||
        (statusFilter === "paused" && item.status === "PAUSED");
      return matchesName && matchesStatus;
    });
  }, [activeMetaTab, campaigns, adsets, ads, searchName, statusFilter, selectedParentCampaignId, selectedParentAdsetId]);

  // Totais consolidados da visualização ativa
  const totals = useMemo(() => {
    return currentItems.reduce(
      (acc, c) => ({
        spend: acc.spend + c.spend,
        revenue: acc.revenue + c.revenue,
        profit: acc.profit + c.profit,
        purchases: acc.purchases + c.purchases,
        checkouts: acc.checkouts + c.checkouts,
        clicks: acc.clicks + c.clicks,
        impressions: acc.impressions + c.impressions,
      }),
      { spend: 0, revenue: 0, profit: 0, purchases: 0, checkouts: 0, clicks: 0, impressions: 0 }
    );
  }, [currentItems]);

  const currentTabType = activeMetaTab === "anuncios" ? "ad" : activeMetaTab === "conjuntos" ? "adset" : "campaign";
  const entityLabel = activeMetaTab === "anuncios" ? "Anúncio" : activeMetaTab === "conjuntos" ? "Conjunto de Anúncios" : "Campanha";

  // Obter nome da campanha pai selecionada
  const activeParentCampaign = campaigns.find((c) => c.id === selectedParentCampaignId);
  const activeParentAdset = adsets.find((a) => a.id === selectedParentAdsetId);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 1. Header Estilizado NexusTrack com Abas Fluidas */}
      <div className="flex flex-wrap items-center justify-between border-b border-border/80 pb-3 gap-4">
        {/* Abas: Contas, Campanhas, Conjuntos, Anúncios */}
        <div className="flex items-center gap-1.5 p-1 bg-card/60 border border-border/80 rounded-xl backdrop-blur-md overflow-x-auto">
          <button
            onClick={() => setActiveMetaTab("contas")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeMetaTab === "contas"
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
            }`}
          >
            <FolderKanban className="h-3.5 w-3.5" /> Contas
          </button>
          <button
            onClick={() => {
              setActiveMetaTab("campanhas");
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeMetaTab === "campanhas"
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
            }`}
          >
            <Megaphone className="h-3.5 w-3.5" /> Campanhas ({campaigns.length})
          </button>
          <button
            onClick={() => setActiveMetaTab("conjuntos")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeMetaTab === "conjuntos"
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
            }`}
          >
            <Layers className="h-3.5 w-3.5" /> Conjuntos ({adsets.length})
          </button>
          <button
            onClick={() => setActiveMetaTab("anuncios")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeMetaTab === "anuncios"
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
            }`}
          >
            <Image className="h-3.5 w-3.5" /> Anúncios ({ads.length})
          </button>
        </div>

        {/* Lado Direito: Status + Atualizar */}
        <div className="flex items-center gap-3">
          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs gap-1.5 px-3 py-1 hidden sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Meta Marketing API Conectada
          </Badge>
          <Button
            onClick={loadFacebookData}
            disabled={loading}
            className="gradient-primary text-primary-foreground text-xs gap-1.5 h-9 px-4 font-semibold shadow-md shadow-primary/20 hover:scale-[1.02] transition-transform"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Atualizar Métricas
          </Button>
        </div>
      </div>

      {/* Breadcrumb de Navegação Hierárquica */}
      {(selectedParentCampaignId !== "all" || selectedParentAdsetId !== "all") && (
        <div className="flex items-center gap-2 text-xs bg-primary/10 border border-primary/20 px-3.5 py-2 rounded-xl text-primary font-mono">
          <span>Filtrando por:</span>
          {activeParentCampaign && (
            <Badge variant="outline" className="border-primary/40 text-primary gap-1">
              Campanha: {activeParentCampaign.name}
              <button onClick={() => setSelectedParentCampaignId("all")} className="ml-1 hover:text-destructive">×</button>
            </Badge>
          )}
          {activeParentAdset && (
            <Badge variant="outline" className="border-primary/40 text-primary gap-1">
              Conjunto: {activeParentAdset.name}
              <button onClick={() => setSelectedParentAdsetId("all")} className="ml-1 hover:text-destructive">×</button>
            </Badge>
          )}
          <button
            onClick={() => {
              setSelectedParentCampaignId("all");
              setSelectedParentAdsetId("all");
            }}
            className="text-[11px] underline ml-auto text-primary/80 hover:text-primary"
          >
            Limpar Filtro de Hierarquia
          </button>
        </div>
      )}

      {/* 2. Barra de Filtros Futurista NexusTrack */}
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-5 bg-card/60 backdrop-blur-md p-4 rounded-2xl border border-border/80 shadow-sm">
        {/* Filtro por Campanha Pai (para Conjuntos e Anúncios) */}
        {activeMetaTab !== "campanhas" && (
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase font-mono">Campanha Pai</span>
            <Select value={selectedParentCampaignId} onValueChange={setSelectedParentCampaignId}>
              <SelectTrigger className="h-9 text-xs bg-background/50 border-border">
                <SelectValue placeholder="Todas as campanhas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Campanhas</SelectItem>
                {campaigns.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Nome do Item */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase font-mono">Buscar {entityLabel}</span>
          <Input
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            placeholder={`Filtrar por nome...`}
            className="h-9 text-xs bg-background/50 border-border"
          />
        </div>

        {/* Status */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase font-mono">Status</span>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 text-xs bg-background/50 border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Qualquer Status</SelectItem>
              <SelectItem value="active">Somente Ativos</SelectItem>
              <SelectItem value="paused">Somente Pausados</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Período (Predefinido como HOJE) */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase font-mono">Data (Padrão: Hoje)</span>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="h-9 text-xs bg-background/50 border-border font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="yesterday">Ontem</SelectItem>
              <SelectItem value="last_7d">Últimos 7 dias</SelectItem>
              <SelectItem value="last_30d">Últimos 30 dias</SelectItem>
              <SelectItem value="this_month">Este Mês</SelectItem>
              <SelectItem value="maximum">Todo o Período</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Conta de Anúncio Conectada */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase font-mono">Conta de Anúncio</span>
          <div className="h-9 px-3 rounded-md border border-border bg-background/50 flex items-center justify-between text-xs font-mono text-primary truncate">
            <span className="truncate">{current?.fb_ad_account_id ? `act_${current.fb_ad_account_id}` : "Nenhuma"}</span>
          </div>
        </div>
      </div>

      {/* 3. Tabela Profissional com Switches Ativo/Pausado e Edição de Orçamento */}
      {(activeMetaTab === "campanhas" || activeMetaTab === "conjuntos" || activeMetaTab === "anuncios") && (
        <Card className="glass-card border-border overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="border-border text-xs uppercase font-mono">
                  <TableHead className="w-12 text-center">Status</TableHead>
                  <TableHead className="min-w-[180px]">{entityLabel}</TableHead>
                  {activeMetaTab !== "anuncios" && (
                    <TableHead className="text-right">Orçamento</TableHead>
                  )}
                  <TableHead className="text-right">Vendas</TableHead>
                  <TableHead className="text-right">CPA</TableHead>
                  <TableHead className="text-right">IC (Checkout)</TableHead>
                  <TableHead className="text-right">CPI (Custo/IC)</TableHead>
                  <TableHead className="text-right">Gastos</TableHead>
                  <TableHead className="text-right">Faturamento</TableHead>
                  <TableHead className="text-right">Lucro</TableHead>
                  <TableHead className="text-right">ROAS</TableHead>
                  <TableHead className="text-right">ROI</TableHead>
                  <TableHead className="text-right">CTR</TableHead>
                  <TableHead className="text-right">CPM</TableHead>
                  <TableHead className="text-right">Cliques</TableHead>
                  <TableHead className="text-right">Impressões</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={activeMetaTab === "anuncios" ? 15 : 16} className="py-12 text-center text-xs text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
                      Carregando {entityLabel.toLowerCase()}s do Facebook Ads...
                    </TableCell>
                  </TableRow>
                ) : currentItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={activeMetaTab === "anuncios" ? 15 : 16} className="py-12 text-center text-xs text-muted-foreground">
                      Nenhum(a) {entityLabel.toLowerCase()} encontrado(a) no período selecionado ou conta não conectada.
                    </TableCell>
                  </TableRow>
                ) : (
                  currentItems.map((c) => {
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
                              onCheckedChange={() => handleToggleStatus(c, currentTabType)}
                              title={isRunning ? "Clique para pausar" : "Clique para ativar"}
                            />
                          )}
                        </TableCell>

                        {/* Nome do Item com Link para Filtrar os Filhos */}
                        <TableCell className="font-semibold text-foreground">
                          <div className="flex flex-col">
                            {activeMetaTab === "campanhas" ? (
                              <button
                                onClick={() => {
                                  setSelectedParentCampaignId(c.id);
                                  setActiveMetaTab("conjuntos");
                                }}
                                className="text-left font-semibold text-foreground hover:text-primary hover:underline transition-colors flex items-center gap-1.5 group"
                                title="Ver conjuntos desta campanha"
                              >
                                <span className="truncate max-w-[210px]">{c.name}</span>
                                <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-primary shrink-0" />
                              </button>
                            ) : activeMetaTab === "conjuntos" ? (
                              <button
                                onClick={() => {
                                  setSelectedParentAdsetId(c.id);
                                  setActiveMetaTab("anuncios");
                                }}
                                className="text-left font-semibold text-foreground hover:text-primary hover:underline transition-colors flex items-center gap-1.5 group"
                                title="Ver anúncios deste conjunto"
                              >
                                <span className="truncate max-w-[210px]">{c.name}</span>
                                <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-primary shrink-0" />
                              </button>
                            ) : (
                              <p className="truncate max-w-[210px]" title={c.name}>{c.name}</p>
                            )}
                            <span className="text-[10px] text-muted-foreground font-mono">ID: {c.id}</span>
                          </div>
                        </TableCell>

                        {/* Orçamento Diário Editável (apenas para campanhas e conjuntos) */}
                        {activeMetaTab !== "anuncios" && (
                          <TableCell className="text-right">
                            {c.daily_budget > 0 ? (
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
                            ) : (
                              <span className="text-muted-foreground font-mono text-[11px]">Nível Conjunto</span>
                            )}
                          </TableCell>
                        )}

                        {/* Vendas */}
                        <TableCell className="text-right font-mono font-bold text-primary">
                          {c.purchases}
                        </TableCell>

                        {/* CPA */}
                        <TableCell className="text-right font-mono">
                          {c.cpa > 0 ? fmt(c.cpa) : "—"}
                        </TableCell>

                        {/* IC (Initiate Checkout) */}
                        <TableCell className="text-right font-mono font-semibold text-foreground">
                          {c.checkouts}
                        </TableCell>

                        {/* CPI (Custo por Initiate Checkout) */}
                        <TableCell className="text-right font-mono">
                          {c.cost_per_checkout > 0 ? fmt(c.cost_per_checkout) : "—"}
                        </TableCell>

                        {/* Gastos */}
                        <TableCell className="text-right font-mono text-foreground font-medium">
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
                          {c.roas > 0 ? `${c.roas.toFixed(2)}x` : "—"}
                        </TableCell>

                        {/* ROI */}
                        <TableCell className={`text-right font-mono font-bold ${c.roi >= 0 ? "text-emerald-400" : "text-destructive"}`}>
                          {c.spend > 0 ? `${c.roi.toFixed(1)}%` : "—"}
                        </TableCell>

                        {/* CTR */}
                        <TableCell className="text-right font-mono font-medium">
                          {c.ctr > 0 ? `${c.ctr.toFixed(2)}%` : "0.00%"}
                        </TableCell>

                        {/* CPM */}
                        <TableCell className="text-right font-mono text-muted-foreground">
                          {c.cpm > 0 ? fmt(c.cpm) : "—"}
                        </TableCell>

                        {/* Cliques */}
                        <TableCell className="text-right font-mono text-foreground">
                          {c.clicks.toLocaleString()}
                        </TableCell>

                        {/* Impressões */}
                        <TableCell className="text-right font-mono text-muted-foreground">
                          {c.impressions.toLocaleString()}
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