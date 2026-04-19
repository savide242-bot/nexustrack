import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShoppingCart, RotateCcw, XCircle } from "lucide-react";
import { DateFilter, getDefaultRange, type DateRange } from "@/components/DateFilter";

export default function Sales() {
  const { user } = useAuth();
  const [sales, setSales] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultRange);
  const saleStatuses = new Set(["realized", "approved"]);

  useEffect(() => {
    if (!user) return;
    const from = dateRange.from.toISOString();
    const to = dateRange.to.toISOString();

    const fetchSales = async () => {
      const { data } = await supabase
        .from("sales")
        .select("*, leads_clicks(country, city, utm_source)")
        .gte("created_at", from)
        .lte("created_at", to)
        .order("created_at", { ascending: false });
      if (data) setSales(data);
    };
    fetchSales();

    const channel = supabase
      .channel("sales-page")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "sales" }, () => fetchSales())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, dateRange]);

  const statusColor = (s: string) => {
    if (s === "approved") return "bg-primary/20 text-primary";
    if (s === "realized") return "bg-primary/10 text-primary";
    if (s === "refunded") return "bg-destructive/20 text-destructive";
    if (s === "cancelled") return "bg-orange-500/20 text-orange-400";
    return "bg-muted text-muted-foreground";
  };

  const activeSales = sales.filter(s => saleStatuses.has(s.status) && Number(s.amount_mzn) > 0);
  const cancelled = sales.filter(s => s.status === "cancelled" || (s.status !== "refunded" && Number(s.amount_mzn) <= 0));
  const refunds = sales.filter(s => s.status === "refunded");

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
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead>Comprador</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead>Original</TableHead>
              <TableHead>MZN</TableHead>
              <TableHead>País</TableHead>
              <TableHead>Fonte</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((s) => {
              const lead = s.leads_clicks;
              return (
                <TableRow key={s.id} className="border-border">
                  <TableCell>
                    <div>
                      <p className="font-medium">{s.buyer_name || "—"}</p>
                      <p className="text-xs text-muted-foreground">{s.buyer_email || ""}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{s.product_name || "—"}</TableCell>
                  <TableCell className="font-mono text-sm">{s.original_amount} {s.original_currency}</TableCell>
                  <TableCell className="font-mono text-sm font-bold text-primary">{Number(s.amount_mzn)?.toLocaleString("pt-MZ")} MT</TableCell>
                  <TableCell className="text-sm">{lead?.country || "—"}</TableCell>
                  <TableCell className="text-sm">{lead?.utm_source || "—"}</TableCell>
                  <TableCell><Badge className={statusColor(s.status)}>{s.status}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(s.created_at).toLocaleDateString("pt-MZ")}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
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
