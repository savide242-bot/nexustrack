import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboard } from "@/contexts/DashboardContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ShoppingCart, RotateCcw, XCircle, Search, Instagram, Share2,
  MessageCircle, Camera, Link as LinkIcon, Film, Sparkles, Filter,
  Layers, ArrowUpRight, DollarSign, TrendingUp
} from "lucide-react";
import { DateFilter, getDefaultRange, type DateRange } from "@/components/DateFilter";

export function getAttribution(s: any) {
  const lead = s.leads_clicks;
  const rawSrc = (lead?.utm_source || s.platform || "direct").trim();
  const med = (lead?.utm_medium || "").trim().toLowerCase();
  const camp = (lead?.utm_campaign || "").trim().toLowerCase();
  const content = (lead?.utm_content || "").trim().toLowerCase();

  // Detecção precisa de canal orgânico vs pago
  let channel: "bio" | "stories" | "direct" | "reels" | "feed" | "paid" | "outro" = "outro";
  if (med.includes("bio") || content.includes("bio") || camp.includes("bio")) {
    channel = "bio";
  } else if (med.includes("stor") || content.includes("stor") || camp.includes("stor")) {
    channel = "stories";
  } else if (med.includes("direct") || content.includes("direct") || med.includes("dm") || med.includes("wpp") || med.includes("whats") || content.includes("dm")) {
    channel = "direct";
  } else if (med.includes("reel") || content.includes("reel")) {
    channel = "reels";
  } else if (med.includes("feed") || content.includes("feed") || med.includes("post")) {
    channel = "feed";
  } else if (med === "cpc" || med === "paid" || rawSrc === "fb" || rawSrc === "facebook" || rawSrc === "meta") {
    channel = "paid";
  }

  const isPaid = channel === "paid" || rawSrc === "fb" || rawSrc === "facebook" || rawSrc === "meta" || med === "cpc";

  // Identificação da Conta Social (Ex: @conta1, @conta2)
  let accountName = "Direto / Sem Conta";
  if (isPaid) {
    accountName = "Meta Ads (Pago)";
  } else if (rawSrc && rawSrc.toLowerCase() !== "direct" && rawSrc.toLowerCase() !== "organico") {
    accountName = rawSrc.startsWith("@") ? rawSrc : `@${rawSrc}`;
  }

  return {
    channel,
    isPaid,
    accountName,
    rawSource: rawSrc,
  };
}

export default function Sales() {
  const { user } = useAuth();
  const { current, fmt } = useDashboard();
  const [sales, setSales] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultRange);
  const [dateMode, setDateMode] = useState<"sale_date" | "approved_at">("sale_date");
  const [statusFilter, setStatusFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const saleStatuses = new Set(["realized", "approved"]);

  useEffect(() => {
    if (!user) return;
    const from = dateRange.from.toISOString();
    const to = dateRange.to.toISOString();

    const fetchSales = async () => {
      const dateColumn = dateMode === "approved_at" ? "approved_at" : "sale_date";
      let query = (supabase
        .from("sales")
        .select("*, leads_clicks(country, city, utm_source, utm_medium, utm_campaign, utm_content, utm_term)") as any)
        .eq("user_id", user.id)
        .gte(dateColumn, from)
        .lte(dateColumn, to);

      if (current?.id) {
        query = query.or(`operation_id.eq.${current.id},operation_id.is.null`);
      }

      if (dateMode === "approved_at") query = query.not("approved_at", "is", null);

      const { data } = await query.order(dateColumn, { ascending: false });
      if (data) setSales(data);
    };
    fetchSales();

    const channel = supabase
      .channel("sales-page")
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, () => fetchSales())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, current?.id, dateRange, dateMode]);

  const statusColor = (s: string) => {
    if (s === "approved") return "bg-primary/20 text-primary";
    if (s === "realized") return "bg-primary/10 text-primary";
    if (s === "refunded") return "bg-destructive/20 text-destructive";
    if (s === "cancelled") return "bg-orange-500/20 text-orange-400";
    return "bg-muted text-muted-foreground";
  };

  const platforms = Array.from(new Set(sales.map((s) => s.platform).filter(Boolean))).sort();

  const visibleSales = sales.filter((s) => {
    const q = search.trim().toLowerCase();
    const lead = s.leads_clicks;
    const attr = getAttribution(s);

    const matchesSearch = !q || [
      s.buyer_name,
      s.buyer_email,
      s.product_name,
      s.transaction_id,
      attr.accountName,
      lead?.utm_source,
      lead?.utm_medium,
      lead?.utm_campaign,
      lead?.utm_content,
      lead?.utm_term
    ].some((value) => String(value || "").toLowerCase().includes(q));

    const matchesStatus = statusFilter === "all" || s.status === statusFilter;
    const matchesPlatform = platformFilter === "all" || s.platform === platformFilter;
    const matchesAccount = accountFilter === "all" || attr.accountName === accountFilter;
    const matchesChannel = channelFilter === "all" || attr.channel === channelFilter;

    return matchesSearch && matchesStatus && matchesPlatform && matchesAccount && matchesChannel;
  });

  const activeSales = visibleSales.filter(s => saleStatuses.has(s.status) && Number(s.amount_mzn) > 0);
  const cancelled = visibleSales.filter(s => s.status === "cancelled" || (s.status !== "refunded" && Number(s.amount_mzn) <= 0));
  const refunds = visibleSales.filter(s => s.status === "refunded");

  // Análise Orgânica das Vendas Aprovadas
  const organicBreakdown = useMemo(() => {
    const validSales = sales.filter(s => saleStatuses.has(s.status) && Number(s.amount_mzn) > 0);
    const accountsMap: Record<string, {
      name: string;
      isPaid: boolean;
      totalRevenue: number;
      salesCount: number;
      byChannel: Record<string, { count: number; revenue: number }>;
    }> = {};

    let totalOrganicRevenue = 0;
    let totalOrganicSales = 0;
    let totalPaidRevenue = 0;
    let totalPaidSales = 0;

    validSales.forEach((s) => {
      const attr = getAttribution(s);
      const rev = Number(s.amount_mzn) || 0;

      if (attr.isPaid) {
        totalPaidRevenue += rev;
        totalPaidSales += 1;
      } else {
        totalOrganicRevenue += rev;
        totalOrganicSales += 1;
      }

      if (!accountsMap[attr.accountName]) {
        accountsMap[attr.accountName] = {
          name: attr.accountName,
          isPaid: attr.isPaid,
          totalRevenue: 0,
          salesCount: 0,
          byChannel: {
            bio: { count: 0, revenue: 0 },
            stories: { count: 0, revenue: 0 },
            direct: { count: 0, revenue: 0 },
            reels: { count: 0, revenue: 0 },
            feed: { count: 0, revenue: 0 },
            outro: { count: 0, revenue: 0 },
          },
        };
      }

      accountsMap[attr.accountName].totalRevenue += rev;
      accountsMap[attr.accountName].salesCount += 1;
      if (accountsMap[attr.accountName].byChannel[attr.channel]) {
        accountsMap[attr.accountName].byChannel[attr.channel].count += 1;
        accountsMap[attr.accountName].byChannel[attr.channel].revenue += rev;
      }
    });

    const accountsList = Object.values(accountsMap).sort((a, b) => b.totalRevenue - a.totalRevenue);
    const organicAccountsOnly = accountsList.filter(a => !a.isPaid && a.name !== "Direto / Sem Conta");

    return {
      accountsList,
      organicAccountsOnly,
      totalOrganicRevenue,
      totalOrganicSales,
      totalPaidRevenue,
      totalPaidSales,
    };
  }, [sales]);

  const SalesTable = ({ data }: { data: any[] }) => (
    data.length === 0 ? (
      <Card className="glass-card border-border">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <ShoppingCart className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">Nenhum registo neste período com os filtros selecionados</p>
        </CardContent>
      </Card>
    ) : (
      <Card className="glass-card border-border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead>Comprador</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Conta / Origem Social</TableHead>
                <TableHead>Local / Canal</TableHead>
                <TableHead>Valor Original</TableHead>
                <TableHead>MZN Líquido</TableHead>
                <TableHead>Campanha / Detalhe</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((s) => {
                const lead = s.leads_clicks;
                const attr = getAttribution(s);
                return (
                  <TableRow key={s.id} className="border-border hover:bg-muted/10 transition-colors">
                    <TableCell>
                      <div>
                        <p className="font-semibold text-foreground text-sm">{s.buyer_name || "—"}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">{s.buyer_email || ""}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-medium max-w-[140px] truncate" title={s.product_name}>
                      {s.product_name || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {attr.isPaid ? (
                          <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-400 border-blue-500/30 font-medium">
                            Meta Ads
                          </Badge>
                        ) : attr.accountName.startsWith("@") ? (
                          <Badge variant="outline" className="text-xs bg-purple-500/15 text-purple-300 border-purple-500/30 font-mono font-semibold flex items-center gap-1">
                            <Instagram className="h-3 w-3 text-purple-400" />
                            {attr.accountName}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs bg-muted/40 text-muted-foreground border-border">
                            {attr.accountName}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {attr.channel === "bio" ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                          <LinkIcon className="h-3 w-3" /> Link na Bio
                        </span>
                      ) : attr.channel === "stories" ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-pink-400 bg-pink-500/10 border border-pink-500/20 px-2 py-0.5 rounded-full">
                          <Camera className="h-3 w-3" /> Stories
                        </span>
                      ) : attr.channel === "direct" ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-full">
                          <MessageCircle className="h-3 w-3" /> Direct / WhatsApp
                        </span>
                      ) : attr.channel === "reels" ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                          <Film className="h-3 w-3" /> Reels
                        </span>
                      ) : attr.channel === "paid" ? (
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {lead?.utm_medium || "cpc"}
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">Orgânico Direto</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{s.original_amount} {s.original_currency}</TableCell>
                    <TableCell className="font-mono text-xs font-bold text-primary">
                      {Number(s.amount_mzn)?.toLocaleString("pt-MZ")} MT
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[150px]">
                        <p className="font-mono text-xs text-foreground truncate" title={lead?.utm_campaign || "—"}>
                          {lead?.utm_campaign ? `📢 ${lead.utm_campaign}` : <span className="text-muted-foreground">—</span>}
                        </p>
                        {lead?.utm_content && (
                          <p className="text-[10px] text-muted-foreground font-mono truncate" title={lead.utm_content}>
                            ct: {lead.utm_content}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${statusColor(s.status)} text-[11px]`}>
                        {s.status === "approved" ? "Aprovada" : s.status === "realized" ? "Realizada" : s.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(s.approved_at || s.sale_date || s.created_at).toLocaleDateString("pt-MZ", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
    )
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-3xl font-bold">Vendas & Conversões</h1>
            <Badge variant="outline" className="border-border text-xs">
              {current?.name || "Operação Geral"}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-0.5">
            Acompanhe vendas de tráfego pago e divisão exata por contas de tráfego orgânico
          </p>
        </div>
        <DateFilter value={dateRange} onChange={setDateRange} />
      </div>

      {/* PAINEL DE ATRIBUIÇÃO ORGÂNICA POR CONTAS E LOCAIS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="font-display font-semibold text-base text-foreground">
              Divisão por Contas Orgânicas & Tráfego Pago
            </h2>
          </div>
          <div className="text-xs text-muted-foreground">
            Orgânico: <strong className="text-primary">{organicBreakdown.totalOrganicRevenue.toLocaleString("pt-MZ")} MT</strong> ({organicBreakdown.totalOrganicSales} vendas) • Pago: <strong className="text-foreground">{organicBreakdown.totalPaidRevenue.toLocaleString("pt-MZ")} MT</strong> ({organicBreakdown.totalPaidSales} vendas)
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {organicBreakdown.accountsList.map((acc, i) => (
            <Card
              key={acc.name}
              className={`glass-card border transition-all cursor-pointer ${
                accountFilter === acc.name
                  ? "border-primary shadow-[0_0_15px_hsl(150_100%_50%/0.15)] bg-primary/5"
                  : "border-border hover:border-primary/40"
              }`}
              onClick={() => setAccountFilter(accountFilter === acc.name ? "all" : acc.name)}
            >
              <CardContent className="p-4 space-y-2.5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                      {acc.isPaid ? (
                        <TrendingUp className="h-3.5 w-3.5 text-blue-400" />
                      ) : (
                        <Instagram className="h-3.5 w-3.5 text-purple-400" />
                      )}
                      {acc.name}
                    </p>
                    <p className="text-xl font-bold font-display text-foreground mt-0.5">
                      {acc.totalRevenue.toLocaleString("pt-MZ")} <span className="text-xs font-normal text-muted-foreground">MT</span>
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs border-border">
                    {acc.salesCount} {acc.salesCount === 1 ? "venda" : "vendas"}
                  </Badge>
                </div>

                {/* Detalhe de canais orgânicos desta conta */}
                {!acc.isPaid && (
                  <div className="pt-2 border-t border-border/50 grid grid-cols-3 gap-1.5 text-[11px]">
                    <div className="rounded bg-secondary/40 p-1.5 text-center">
                      <span className="text-muted-foreground block text-[10px]">🔗 Bio</span>
                      <span className="font-semibold text-emerald-400 font-mono">
                        {acc.byChannel.bio.revenue.toLocaleString("pt-MZ")} MT
                      </span>
                      <span className="text-[10px] text-muted-foreground block">({acc.byChannel.bio.count})</span>
                    </div>
                    <div className="rounded bg-secondary/40 p-1.5 text-center">
                      <span className="text-muted-foreground block text-[10px]">📸 Stories</span>
                      <span className="font-semibold text-pink-400 font-mono">
                        {acc.byChannel.stories.revenue.toLocaleString("pt-MZ")} MT
                      </span>
                      <span className="text-[10px] text-muted-foreground block">({acc.byChannel.stories.count})</span>
                    </div>
                    <div className="rounded bg-secondary/40 p-1.5 text-center">
                      <span className="text-muted-foreground block text-[10px]">💬 Direct</span>
                      <span className="font-semibold text-cyan-400 font-mono">
                        {acc.byChannel.direct.revenue.toLocaleString("pt-MZ")} MT
                      </span>
                      <span className="text-[10px] text-muted-foreground block">({acc.byChannel.direct.count})</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* FILTROS E BUSCA */}
      <Card className="glass-card border-border">
        <CardContent className="space-y-3 p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Select value={dateMode} onValueChange={(value: "sale_date" | "approved_at") => setDateMode(value)}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sale_date">Data da venda</SelectItem>
                <SelectItem value="approved_at">Data de aprovação</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="approved">Aprovadas</SelectItem>
                <SelectItem value="realized">Realizadas</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="cancelled">Canceladas</SelectItem>
                <SelectItem value="refunded">Reembolsadas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={platformFilter} onValueChange={setPlatformFilter}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Plataforma" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as plataformas</SelectItem>
                {platforms.map((platform) => <SelectItem key={platform} value={platform}>{platform}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9 bg-secondary border-border" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente, @conta, criativo" />
            </div>
          </div>

          {/* Atalhos de Filtro por Canal Orgânico */}
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/40 text-xs">
            <span className="text-muted-foreground flex items-center gap-1 font-medium mr-1">
              <Filter className="h-3 w-3" /> Filtrar Canal:
            </span>
            <Button
              variant={channelFilter === "all" ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs px-2.5"
              onClick={() => setChannelFilter("all")}
            >
              Todos os Canais
            </Button>
            <Button
              variant={channelFilter === "bio" ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs px-2.5 gap-1"
              onClick={() => setChannelFilter("bio")}
            >
              <LinkIcon className="h-3 w-3" /> Link na Bio
            </Button>
            <Button
              variant={channelFilter === "stories" ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs px-2.5 gap-1"
              onClick={() => setChannelFilter("stories")}
            >
              <Camera className="h-3 w-3" /> Stories
            </Button>
            <Button
              variant={channelFilter === "direct" ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs px-2.5 gap-1"
              onClick={() => setChannelFilter("direct")}
            >
              <MessageCircle className="h-3 w-3" /> Direct
            </Button>
            <Button
              variant={channelFilter === "reels" ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs px-2.5 gap-1"
              onClick={() => setChannelFilter("reels")}
            >
              <Film className="h-3 w-3" /> Reels
            </Button>
            <Button
              variant={channelFilter === "paid" ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs px-2.5 gap-1"
              onClick={() => setChannelFilter("paid")}
            >
              <TrendingUp className="h-3 w-3" /> Tráfego Pago
            </Button>

            {accountFilter !== "all" && (
              <Badge variant="secondary" className="ml-auto text-[11px] gap-1 cursor-pointer" onClick={() => setAccountFilter("all")}>
                Conta filtrada: {accountFilter} ✕
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="sales">
        <TabsList className="bg-secondary border border-border">
          <TabsTrigger value="sales" className="gap-1.5">
            <ShoppingCart className="h-3.5 w-3.5" />
            Vendas Aprovadas ({activeSales.length})
          </TabsTrigger>
          <TabsTrigger value="cancelled" className="gap-1.5">
            <XCircle className="h-3.5 w-3.5" />
            Canceladas ({cancelled.length})
          </TabsTrigger>
          <TabsTrigger value="refunds" className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" />
            Reembolsos ({refunds.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="sales" className="mt-4">
          <SalesTable data={activeSales} />
        </TabsContent>
        <TabsContent value="cancelled" className="mt-4">
          <SalesTable data={cancelled} />
        </TabsContent>
        <TabsContent value="refunds" className="mt-4">
          <SalesTable data={refunds} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
