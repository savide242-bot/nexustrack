import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, ShoppingCart, TrendingUp, Users, Target, BarChart3 } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { DateFilter, getDefaultRange, type DateRange } from "@/components/DateFilter";

interface MetricCardProps {
  title: string;
  value: string;
  icon: React.ElementType;
  change?: string;
}

function MetricCard({ title, value, icon: Icon, change }: MetricCardProps) {
  return (
    <Card className="glass-card border-border hover:neon-border transition-all duration-300">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="mt-1 font-display text-2xl font-bold text-foreground">{value}</p>
            {change && <p className="mt-1 text-xs text-primary">{change}</p>}
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const SOURCE_COLORS = [
  "hsl(150,100%,50%)",
  "hsl(200,80%,50%)",
  "hsl(280,80%,60%)",
  "hsl(40,90%,50%)",
  "hsl(0,80%,55%)",
  "hsl(170,70%,45%)",
  "hsl(320,70%,55%)",
  "hsl(60,80%,50%)",
];

function MiniDonut({ percent, color, size = 36 }: { percent: number; color: string; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const filled = circ * (percent / 100);
  return (
    <svg width={size} height={size} className="flex-shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(0,0%,18%)" strokeWidth={4} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={4}
        strokeDasharray={`${filled} ${circ - filled}`}
        strokeDashoffset={circ / 4}
        strokeLinecap="round"
      />
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

export default function Index() {
  const { user } = useAuth();
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultRange);
  const [totalMzn, setTotalMzn] = useState(0);
  const [totalSales, setTotalSales] = useState(0);
  const [totalLeads, setTotalLeads] = useState(0);
  const [utmSources, setUtmSources] = useState<{ name: string; value: number }[]>([]);
  const [dailySales, setDailySales] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const from = dateRange.from.toISOString();
    const to = dateRange.to.toISOString();

    const fetchDashboard = async () => {
      const { data: sales } = await supabase
        .from("sales")
        .select("*")
        .gte("created_at", from)
        .lte("created_at", to)
        .order("created_at", { ascending: false });

      if (sales) {
        const paid = sales.filter(s => s.status !== "refunded" && Number(s.amount_mzn) > 0);
        setTotalSales(paid.length);
        setTotalMzn(paid.reduce((sum, s) => sum + (Number(s.amount_mzn) || 0), 0));

        const last7 = Array.from({ length: 7 }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (6 - i));
          return d.toISOString().split("T")[0];
        });
        setDailySales(last7.map((date) => ({
          date: date.slice(5),
          vendas: sales.filter((s) => s.created_at.startsWith(date) && s.status !== "refunded" && Number(s.amount_mzn) > 0).reduce((sum, s) => sum + (Number(s.amount_mzn) || 0), 0),
        })));
      }

      const { count } = await supabase
        .from("leads_clicks")
        .select("*", { count: "exact", head: true })
        .gte("created_at", from)
        .lte("created_at", to);
      setTotalLeads(count || 0);

      const { data: leads } = await supabase
        .from("leads_clicks")
        .select("utm_source")
        .gte("created_at", from)
        .lte("created_at", to);

      if (leads) {
        const sourceMap: Record<string, number> = {};
        leads.forEach((l) => {
          const src = l.utm_source || "Direto";
          sourceMap[src] = (sourceMap[src] || 0) + 1;
        });
        setUtmSources(
          Object.entries(sourceMap)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
        );
      }
    };

    fetchDashboard();

    const channel = supabase
      .channel("sales-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "sales" }, () => fetchDashboard())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, dateRange]);

  const conversionRate = totalLeads > 0 ? ((totalSales / totalLeads) * 100).toFixed(1) : "0";
  const avgTicket = totalSales > 0 ? (totalMzn / totalSales).toFixed(0) : "0";
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard title="Vendas (MZN)" value={`${totalMzn.toLocaleString("pt-MZ")} MT`} icon={DollarSign} />
        <MetricCard title="Total Vendas" value={String(totalSales)} icon={ShoppingCart} />
        <MetricCard title="Leads" value={String(totalLeads)} icon={Users} />
        <MetricCard title="Conversão" value={`${conversionRate}%`} icon={Target} />
        <MetricCard title="Ticket Médio" value={`${Number(avgTicket).toLocaleString("pt-MZ")} MT`} icon={TrendingUp} />
        <MetricCard title="ROI" value="—" icon={BarChart3} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="glass-card border-border">
          <CardHeader>
            <CardTitle className="font-display text-lg">Vendas Diárias (MZN)</CardTitle>
          </CardHeader>
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
          <CardHeader>
            <CardTitle className="font-display text-lg">Origem do Tráfego</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 overflow-y-auto">
              {utmSources.length > 0 ? (
                <div className="space-y-1">
                  {utmSources.map((src, i) => (
                    <SourceRow
                      key={src.name}
                      name={src.name}
                      count={src.value}
                      total={totalVisits}
                      color={SOURCE_COLORS[i % SOURCE_COLORS.length]}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  Sem dados de UTM ainda
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
