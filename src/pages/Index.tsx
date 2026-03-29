import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, ShoppingCart, TrendingUp, Users, Target, BarChart3 } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, BarChart, Bar, CartesianGrid } from "recharts";

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
            {change && (
              <p className="mt-1 text-xs text-primary">{change}</p>
            )}
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const COLORS = ["hsl(150,100%,50%)", "hsl(200,80%,50%)", "hsl(280,80%,60%)", "hsl(40,90%,50%)", "hsl(0,80%,55%)"];

export default function Index() {
  const { user } = useAuth();
  const [salesData, setSalesData] = useState<any[]>([]);
  const [totalMzn, setTotalMzn] = useState(0);
  const [totalSales, setTotalSales] = useState(0);
  const [totalLeads, setTotalLeads] = useState(0);
  const [utmSources, setUtmSources] = useState<any[]>([]);
  const [dailySales, setDailySales] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;

    const fetchDashboard = async () => {
      // Fetch sales
      const { data: sales } = await supabase
        .from("sales")
        .select("*")
        .order("created_at", { ascending: false });

      if (sales) {
        setTotalSales(sales.length);
        const total = sales.reduce((sum, s) => sum + (s.amount_mzn || 0), 0);
        setTotalMzn(total);

        // Daily sales for last 7 days
        const last7 = Array.from({ length: 7 }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (6 - i));
          return d.toISOString().split("T")[0];
        });

        const daily = last7.map((date) => ({
          date: date.slice(5),
          vendas: sales.filter((s) => s.created_at.startsWith(date)).reduce((sum, s) => sum + (s.amount_mzn || 0), 0),
        }));
        setDailySales(daily);
      }

      // Fetch leads count
      const { count } = await supabase
        .from("leads_clicks")
        .select("*", { count: "exact", head: true });
      setTotalLeads(count || 0);

      // UTM sources distribution
      const { data: leads } = await supabase
        .from("leads_clicks")
        .select("utm_source");

      if (leads) {
        const sourceMap: Record<string, number> = {};
        leads.forEach((l) => {
          const src = l.utm_source || "Direto";
          sourceMap[src] = (sourceMap[src] || 0) + 1;
        });
        setUtmSources(
          Object.entries(sourceMap).map(([name, value]) => ({ name, value }))
        );
      }
    };

    fetchDashboard();

    // Real-time subscription for sales
    const channel = supabase
      .channel("sales-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "sales" }, () => {
        fetchDashboard();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const conversionRate = totalLeads > 0 ? ((totalSales / totalLeads) * 100).toFixed(1) : "0";
  const avgTicket = totalSales > 0 ? (totalMzn / totalSales).toFixed(0) : "0";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">
          Dashboard
        </h1>
        <p className="text-muted-foreground">Visão geral das suas métricas em tempo real</p>
      </div>

      {/* Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard title="Vendas (MZN)" value={`${totalMzn.toLocaleString("pt-MZ")} MT`} icon={DollarSign} />
        <MetricCard title="Total Vendas" value={String(totalSales)} icon={ShoppingCart} />
        <MetricCard title="Leads" value={String(totalLeads)} icon={Users} />
        <MetricCard title="Conversão" value={`${conversionRate}%`} icon={Target} />
        <MetricCard title="Ticket Médio" value={`${Number(avgTicket).toLocaleString("pt-MZ")} MT`} icon={TrendingUp} />
        <MetricCard title="ROI" value="—" icon={BarChart3} />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Daily Sales Line Chart */}
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
                  <Tooltip
                    contentStyle={{ background: "hsl(0,0%,9%)", border: "1px solid hsl(0,0%,18%)", borderRadius: 8 }}
                    labelStyle={{ color: "hsl(0,0%,95%)" }}
                  />
                  <Line type="monotone" dataKey="vendas" stroke="hsl(150,100%,50%)" strokeWidth={2} dot={{ fill: "hsl(150,100%,50%)" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* UTM Source Pie Chart */}
        <Card className="glass-card border-border">
          <CardHeader>
            <CardTitle className="font-display text-lg">Origem do Tráfego</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {utmSources.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={utmSources} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {utmSources.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "hsl(0,0%,9%)", border: "1px solid hsl(0,0%,18%)", borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
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
