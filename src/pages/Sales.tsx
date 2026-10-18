import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShoppingCart, RotateCcw, XCircle, Search } from "lucide-react";
import { DateFilter, getDefaultRange, type DateRange } from "@/components/DateFilter";

export default function Sales() {
  const { user } = useAuth();
  const [sales, setSales] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultRange);
  const [dateMode, setDateMode] = useState<"sale_date" | "approved_at">("sale_date");
  const [statusFilter, setStatusFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");
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
        .select("*, leads_clicks(country, city, utm_source, utm_campaign, utm_content, utm_term)") as any)
        .gte(dateColumn, from)
        .lte(dateColumn, to);

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
  }, [user, dateRange, dateMode]);

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
    const matchesSearch = !q || [
      s.buyer_name,
      s.buyer_email,
      s.product_name,
      s.transaction_id,
      lead?.utm_source,
      lead?.utm_campaign,
      lead?.utm_content,
      lead?.utm_term
    ].some((value) => String(value || "").toLowerCase().includes(q));
    const matchesStatus = statusFilter === "all" || s.status === statusFilter;
    const matchesPlatform = platformFilter === "all" || s.platform === platformFilter;
    return matchesSearch && matchesStatus && matchesPlatform;
  });

  const activeSales = visibleSales.filter(s => saleStatuses.has(s.status) && Number(s.amount_mzn) > 0);
  const cancelled = visibleSales.filter(s => s.status === "cancelled" || (s.status !== "refunded" && Number(s.amount_mzn) <= 0));
  const refunds = visibleSales.filter(s => s.status === "refunded");

  const SalesTable = ({ data }: { data: any[] }) => (
    data.length === 0 ? (
      <Card className="glass-card border-border">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <ShoppingCart className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">Nenhum registo neste período</p>
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
                <TableHead>Valor Original</TableHead>
                <TableHead>MZN Líquido</TableHead>
                <TableHead>Criativo / Anúncio</TableHead>
                <TableHead>Campanha</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((s) => {
                const lead = s.leads_clicks;
                return (
                  <TableRow key={s.id} className="border-border hover:bg-muted/10 transition-colors">
                    <TableCell>
                      <div>
                        <p className="font-semibold text-foreground text-sm">{s.buyer_name || "—"}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">{s.buyer_email || ""}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-medium max-w-[150px] truncate" title={s.product_name}>
                      {s.product_name || "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{s.original_amount} {s.original_currency}</TableCell>
                    <TableCell className="font-mono text-xs font-bold text-primary">
                      {Number(s.amount_mzn)?.toLocaleString("pt-MZ")} MT
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[180px]">
                        <p className="font-mono text-xs font-semibold text-foreground truncate" title={lead?.utm_content || "Sem criativo"}>
                          {lead?.utm_content ? `🎯 ${lead.utm_content}` : <span className="text-muted-foreground">—</span>}
                        </p>
                        {lead?.utm_term && (
                          <p className="text-[10px] text-muted-foreground font-mono truncate" title={lead.utm_term}>
                            cj: {lead.utm_term}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[160px]">
                        <p className="font-mono text-xs text-foreground truncate" title={lead?.utm_campaign || "Orgânico"}>
                          {lead?.utm_campaign ? `📢 ${lead.utm_campaign}` : <span className="text-muted-foreground">—</span>}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-medium text-[11px] uppercase bg-muted/30 px-1.5 py-0.5 rounded border border-border/50">
                          {lead?.utm_source || s.platform || "direct"}
                        </span>
                        {lead?.country && (
                          <span className="text-[10px] text-muted-foreground">({lead.country})</span>
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
          <h1 className="font-display text-3xl font-bold">Vendas</h1>
          <p className="text-muted-foreground">Todas as vendas com conversão automática para Meticais</p>
        </div>
        <DateFilter value={dateRange} onChange={setDateRange} />
      </div>

      <Card className="glass-card border-border">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
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
            <Input className="pl-9 bg-secondary border-border" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar venda" />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="sales">
        <TabsList className="bg-secondary border border-border">
          <TabsTrigger value="sales" className="gap-1.5">
            <ShoppingCart className="h-3.5 w-3.5" />
            Vendas ({activeSales.length})
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
