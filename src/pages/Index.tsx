import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, ShoppingCart, TrendingUp, Users, Target, BarChart3 } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { DateFilter, getDefaultRange, type DateRange } from "@/components/DateFilter";
import { DeltaBadge } from "@/components/DeltaBadge";
import { TopProducts } from "@/components/dashboard/TopProducts";
import { SalesHeatmap } from "@/components/dashboard/SalesHeatmap";
import { Funnel } from "@/components/dashboard/Funnel";
import { OnboardingChecklist } from "@/components/dashboard/OnboardingChecklist";
import { formatMzn, pctDelta } from "@/lib/format";

import { InfoTooltip } from "@/components/InfoTooltip";

interface MetricCardProps {
  title: string;
  value: string;
  icon: React.ElementType;
  delta?: number | null;
  tip?: string;
}

function MetricCard({ title, value, icon: Icon, delta, tip }: MetricCardProps) {
  return (
    <Card className="glass-card border-border hover:neon-border transition-all duration-300">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm text-muted-foreground">{title}</p>
              {tip && <InfoTooltip text={tip} />}
            </div>
            <p className="mt-1 font-display text-2xl font-bold text-foreground truncate">{value}</p>
            {delta !== undefined && <div className="mt-1"><DeltaBadge delta={delta ?? null} /></div>}
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const SOURCE_COLORS = [
  "hsl(150,100%,50%)", "hsl(200,80%,50%)", "hsl(280,80%,60%)", "hsl(40,90%,50%)",
  "hsl(0,80%,55%)", "hsl(170,70%,45%)", "hsl(320,70%,55%)", "hsl(60,80%,50%)",
];

function MiniDonut({ percent, color, size = 36 }: { percent: number; color: string; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const filled = circ * (percent / 100);
  return (
    <svg width={size} height={size} className="flex-shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(0,0%,18%)" strokeWidth={4} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={4}
        strokeDasharray={`${filled} ${circ - filled}`} strokeDashoffset={circ / 4} strokeLinecap="round" />
    </svg>
  );
}

function SourceRow({ name, count, total, color }: { name: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3 py-2 px-1 rounded-lg hover:bg-secondary/30 transition-colors">
      <MiniDonut percent={pct} color={color} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{name}</p>
        <p className="text-xs text-muted-foreground">{count} visitas</p>
      </div>
      <span className="text-sm font-bold text-foreground tabular-nums">{pct.toFixed(0)}%</span>
    </div>
  );
}

interface Sale {
  created_at: string;
  sale_date: string | null;
  amount_mzn: number | string | null;
  status: string;
  product_name: string | null;
}

const isRevenueSale = (s: Sale) => ["approved", "realized"].includes(s.status) && Number(s.amount_mzn) > 0;

export default function Index() {
  const { user } = useAuth();
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultRange);
  const [sales, setSales] = useState<Sale[]>([]);
  const [prevSales, setPrevSales] = useState<Sale[]>([]);
  const [totalLeads, setTotalLeads] = useState(0);
  const [prevLeads, setPrevLeads] = useState(0);
  const [totalCtas, setTotalCtas] = useState(0);
  const [utmSources, setUtmSources] = useState<{ name: string; value: number }[]>([]);
  const [dailySales, setDailySales] = useState<{ date: string; vendas: number }[]>([]);

  useEffect(() => {
    if (!user) return;
    const from = dateRange.from;
    const to = dateRange.to;
    const span = to.getTime() - from.getTime();
    const prevFrom = new Date(from.getTime() - span);
    const prevTo = from;

    const fetchAll = async () => {
      const [
        { data: curSales },
        { data: prSales },
        { count: leadsCount },
        { count: prevLeadsCount },
        { count: ctaCount },
        { data: leads },
      ] = await Promise.all([
        (supabase.from("sales") as any).select("created_at, sale_date, amount_mzn, status, product_name").gte("sale_date", from.toISOString()).lte("sale_date", to.toISOString()),
        (supabase.from("sales") as any).select("created_at, sale_date, amount_mzn, status, product_name").gte("sale_date", prevFrom.toISOString()).lt("sale_date", prevTo.toISOString()),
        supabase.from("leads_clicks").select("*", { count: "exact", head: true }).gte("created_at", from.toISOString()).lte("created_at", to.toISOString()),
        supabase.from("leads_clicks").select("*", { count: "exact", head: true }).gte("created_at", prevFrom.toISOString()).lt("created_at", prevTo.toISOString()),
        supabase.from("cta_clicks").select("*", { count: "exact", head: true }).gte("created_at", from.toISOString()).lte("created_at", to.toISOString()),
        supabase.from("leads_clicks").select("utm_source").gte("created_at", from.toISOString()).lte("created_at", to.toISOString()),
      ]);

      setSales((curSales as Sale[]) || []);
      setPrevSales((prSales as Sale[]) || []);
      setTotalLeads(leadsCount || 0);
      setPrevLeads(prevLeadsCount || 0);
      setTotalCtas(ctaCount || 0);

      // Daily series across the range (cap at 30 buckets)
      const dayCount = Math.min(30, Math.max(7, Math.ceil(span / 86400000)));
      const buckets = Array.from({ length: dayCount }, (_, i) => {
        const d = new Date(to);
        d.setDate(d.getDate() - (dayCount - 1 - i));
        return d.toISOString().split("T")[0];
      });
      setDailySales(buckets.map((date) => ({
        date: date.slice(5),
        vendas: ((curSales as Sale[]) || [])
          .filter((s) => (s.sale_date || s.created_at).startsWith(date) && isRevenueSale(s))
          .reduce((sum, s) => sum + (Number(s.amount_mzn) || 0), 0),
      })));

      if (leads) {
        const sourceMap: Record<string, number> = {};
        leads.forEach((l) => {
          const src = l.utm_source || "Direto";
          sourceMap[src] = (sourceMap[src] || 0) + 1;
        });
        setUtmSources(
          Object.entries(sourceMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
        );
      }
    };

    fetchAll();

    const channel = supabase
      .channel(`dashboard-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "sales" }, () => fetchAll())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, dateRange]);

  // Current metrics
  const paidSales = sales.filter(isRevenueSale);
  const totalSales = paidSales.length;
  const totalMzn = paidSales.reduce((sum, s) => sum + (Number(s.amount_mzn) || 0), 0);

  const prevPaid = prevSales.filter(isRevenueSale);
  const prevSalesCount = prevPaid.length;
  const prevMzn = prevPaid.reduce((sum, s) => sum + (Number(s.amount_mzn) || 0), 0);

  const conversionRate = totalLeads > 0 ? (totalSales / totalLeads) * 100 : 0;
  const prevConversion = prevLeads > 0 ? (prevSalesCount / prevLeads) * 100 : 0;
  const avgTicket = totalSales > 0 ? totalMzn / totalSales : 0;
  const prevAvgTicket = prevSalesCount > 0 ? prevMzn / prevSalesCount : 0;
  const totalVisits = utmSources.reduce((s, u) => s + u.value, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Visão geral das suas métricas em tempo real</p>
        </div>
        <DateFilter value={dateRange} onChange={setDateRange} />
      </div>

      <OnboardingChecklist />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard title="Vendas (MZN)" value={formatMzn(totalMzn)} icon={DollarSign} delta={pctDelta(totalMzn, prevMzn)} tip="Receita total convertida em Meticais. Exclui reembolsos e cancelamentos." />
        <MetricCard title="Total Vendas" value={String(totalSales)} icon={ShoppingCart} delta={pctDelta(totalSales, prevSalesCount)} tip="Número de vendas aprovadas/realizadas com valor > 0 no período." />
        <MetricCard title="Leads" value={String(totalLeads)} icon={Users} delta={pctDelta(totalLeads, prevLeads)} tip="Visitantes únicos rastreados pelo pixel/script no período." />
        <MetricCard title="Conversão" value={`${conversionRate.toFixed(1)}%`} icon={Target} delta={pctDelta(conversionRate, prevConversion)} tip="Vendas ÷ Leads. Mostra que percentagem dos visitantes comprou." />
        <MetricCard title="Ticket Médio" value={formatMzn(avgTicket)} icon={TrendingUp} delta={pctDelta(avgTicket, prevAvgTicket)} tip="Receita média por venda (MZN ÷ nº vendas)." />
        <MetricCard title="ROI" value="—" icon={BarChart3} tip="Retorno sobre investimento. Será calculado quando ligares uma conta Meta Ads em Campanhas." />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="glass-card border-border">
          <CardHeader><CardTitle className="font-display text-lg">Vendas Diárias (MZN)</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailySales}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,18%)" />
                  <XAxis dataKey="date" stroke="hsl(0,0%,55%)" fontSize={12} />
                  <YAxis stroke="hsl(0,0%,55%)" fontSize={12} />
                  <Tooltip contentStyle={{ background: "hsl(0,0%,9%)", border: "1px solid hsl(0,0%,18%)", borderRadius: 8 }} labelStyle={{ color: "hsl(0,0%,95%)" }} />
                  <Line type="monotone" dataKey="vendas" stroke="hsl(150,100%,50%)" strokeWidth={2} dot={{ fill: "hsl(150,100%,50%)" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-border">
          <CardHeader><CardTitle className="font-display text-lg">Origem do Tráfego</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64 overflow-y-auto">
              {utmSources.length > 0 ? (
                <div className="space-y-1">
                  {utmSources.map((src, i) => (
                    <SourceRow key={src.name} name={src.name} count={src.value} total={totalVisits} color={SOURCE_COLORS[i % SOURCE_COLORS.length]} />
                  ))}
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">Sem dados de UTM ainda</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="glass-card border-border lg:col-span-1">
          <CardHeader><CardTitle className="font-display text-lg">Top 3 Produtos</CardTitle></CardHeader>
          <CardContent><TopProducts sales={sales} /></CardContent>
        </Card>

        <Card className="glass-card border-border lg:col-span-1">
          <CardHeader><CardTitle className="font-display text-lg">Funil de Conversão</CardTitle></CardHeader>
          <CardContent>
            <Funnel
              steps={[
                { label: "Visitantes", value: totalLeads },
                { label: "Cliques em CTA", value: totalCtas },
                { label: "Vendas", value: totalSales },
              ]}
            />
          </CardContent>
        </Card>

        <Card className="glass-card border-border lg:col-span-1">
          <CardHeader>
            <CardTitle className="font-display text-lg">Hora de Pico</CardTitle>
            <p className="text-xs text-muted-foreground">Receita por dia × hora</p>
          </CardHeader>
          <CardContent><SalesHeatmap sales={sales} /></CardContent>
        </Card>
      </div>
    </div>
  );
}
