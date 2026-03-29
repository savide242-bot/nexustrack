import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShoppingCart } from "lucide-react";

export default function Sales() {
  const { user } = useAuth();
  const [sales, setSales] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetchSales = async () => {
      // Fetch sales with lead data for country/utm_source
      const { data } = await supabase.from("sales").select("*, leads_clicks(country, city, utm_source)").order("created_at", { ascending: false });
      if (data) setSales(data);
    };
    fetchSales();

    const channel = supabase
      .channel("sales-page")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "sales" }, () => fetchSales())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const statusColor = (s: string) => {
    if (s === "approved") return "bg-primary/20 text-primary";
    if (s === "refunded") return "bg-destructive/20 text-destructive";
    return "bg-muted text-muted-foreground";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Vendas</h1>
        <p className="text-muted-foreground">Todas as vendas com conversão automática para Meticais</p>
      </div>

      {sales.length === 0 ? (
        <Card className="glass-card border-border">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ShoppingCart className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">Nenhuma venda registrada ainda</p>
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
                <TableHead>Câmbio</TableHead>
                <TableHead>País</TableHead>
                <TableHead>Fonte</TableHead>
                <TableHead>Plataforma</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.map((s) => {
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
                    <TableCell className="font-mono text-sm font-bold text-primary">{s.amount_mzn?.toLocaleString("pt-MZ")} MT</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{s.exchange_rate?.toFixed(2)}</TableCell>
                    <TableCell className="text-sm">{lead?.country || "—"}</TableCell>
                    <TableCell className="text-sm">{lead?.utm_source || "—"}</TableCell>
                    <TableCell><Badge variant="outline" className="border-border">{s.platform}</Badge></TableCell>
                    <TableCell><Badge className={statusColor(s.status)}>{s.status}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(s.created_at).toLocaleDateString("pt-MZ")}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
