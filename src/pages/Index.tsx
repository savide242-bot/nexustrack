import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboard } from "@/contexts/DashboardContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, ShoppingCart, TrendingUp, Users, Target, BarChart3, RefreshCw, Zap } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { DateFilter, getDefaultRange, type DateRange } from "@/components/DateFilter";
import { DeltaBadge } from "@/components/DeltaBadge";
import { InfoTooltip } from "@/components/InfoTooltip";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

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

export default function Index() {
  const { user } = useAuth();
  const { current, fmt, cv } = useDashboard();
  const [range, setRange] = useState<DateRange>(getDefaultRange());
  const [loading, setLoading] = useState(true);

  // Dados carregados
  const [sales, setSales] = useState<any[]>([]);
  const [leadsCount, setLeadsCount] = useState(0);
  const [fbSpend, setFbSpend] = useState(0);
  const [campaigns, setCampaigns] = useState<any[]>([]);

  const loadData = async () => {
    if (!user || !current) return;
    setLoading(true);

    const fromIso = range.from.toISOString();
    const toIso = range.to.toISOString();

    // 1. Carregar vendas da dashboard
    let salesQuery = supabase
      .from("sales")
      .select("*")
      .eq("user_id", user.id)
      .gte("sale_date", fromIso)
      .lte("sale_date", toIso);

    if (current?.id) {
      salesQuery = salesQuery.or(`operation_id.eq.${current.id},operation_id.is.null`);
    }

    const { data: salesData } = await salesQuery;
    setSales(salesData || []);

    // 2. Carregar leads
    const { count } = await supabase
      .from("leads_clicks")
      .select("id", { count: "exact", head: true })
      .gte("created_at", fromIso)
      .lte("created_at", toIso);

    setLeadsCount(count || 0);

    // 3. Se houver conta do Facebook Ads associada à Dashboard, carregar investimento real
    if (current.fb_ad_account_id) {
      try {
        const { data: fbData } = await supabase.functions.invoke("fb-ads-control", {
          body: { action: "campaigns", ad_account_id: current.fb_ad_account_id, date_preset: "last_7d" },
        });

        if (fbData?.campaigns) {
          setCampaigns(fbData.campaigns);
          const totalSpend = (fbData.campaigns || []).reduce((acc: number, c: any) => {
            const accCurr = fbData.account?.currency || "USD";
            return acc + cv(c.spend || 0, accCurr);
          }, 0);
          setFbSpend(totalSpend);
        }
      } catch (e) {
        console.error("Erro ao puxar FB Ads:", e);
      }
    } else {
      setFbSpend(0);
      setCampaigns([]);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [user, current, range]);

  // Cálculos consolidados da Dashboard
  const metrics = useMemo(() => {
    const validSales = sales.filter((s) => s.status === "approved" || s.status === "realized");
    const grossRevenue = validSales.reduce((sum, s) => sum + cv(Number(s.original_amount || 0), s.original_currency || "USD"), 0);

    const refundedSales = sales.filter((s) => s.status === "refunded");
    const refundAmount = refundedSales.reduce((sum, s) => sum + cv(Number(s.original_amount || 0), s.original_currency || "USD"), 0);

    const netRevenue = grossRevenue - refundAmount;
    const spend = fbSpend;
    const profit = netRevenue - spend - (current?.product_cost || 0) * validSales.length;

    const roas = spend > 0 ? netRevenue / spend : 0;
    const roi = spend > 0 ? (profit / spend) * 100 : 0;
    const cpa = validSales.length > 0 && spend > 0 ? spend / validSales.length : 0;
    const ticketMedio = validSales.length > 0 ? netRevenue / validSales.length : 0;

    return {
      grossRevenue,
      netRevenue,
      refundAmount,
      spend,
      profit,
      roas,
      roi,
      cpa,
      ticketMedio,
      salesCount: validSales.length,
      refundCount: refundedSales.length,
    };
  }, [sales, fbSpend, current, cv]);

  // Meta de Faturamento
  const goalProgress = useMemo(() => {
    const goal = current?.revenue_goal || 0;
    if (goal <= 0) return { pct: 0, remaining: 0, goal: 0 };
    const pct = Math.min(Math.round((metrics.netRevenue / goal) * 100), 100);
    const remaining = Math.max(goal - metrics.netRevenue, 0);
    return { pct, remaining, goal };
  }, [current, metrics.netRevenue]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold text-foreground">
              {current?.name || "Dashboard"}
            </h1>
            <span className="text-xs px-2 py-0.5 rounded-full border border-border bg-muted/40 font-mono">
              {current?.currency || "MZN"}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Métricas de tráfego, vendas e faturamento isoladas em tempo real.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DateFilter value={range} onChange={setRange} />
          <Button variant="outline" size="icon" onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Barra de Progresso da Meta */}
      {goalProgress.goal > 0 && (
        <Card className="glass-card border-border">
          <CardContent className="p-4 space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="font-semibold flex items-center gap-1.5">
                <Target className="h-4 w-4 text-primary" /> Meta de Faturamento ({current?.revenue_goal_period})
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                <strong className="text-foreground">{fmt(metrics.netRevenue)}</strong> de {fmt(goalProgress.goal)} ({goalProgress.pct}%)
              </span>
            </div>
            <Progress value={goalProgress.pct} className="h-2.5" />
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>Falta: {fmt(goalProgress.remaining)}</span>
              <span>{goalProgress.pct >= 100 ? "🎉 Meta Batida!" : `${100 - goalProgress.pct}% restante`}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Grid de KPIs Consolidados */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Faturamento Líquido"
          value={fmt(metrics.netRevenue)}
          icon={DollarSign}
          tip="Receita aprovada subtraída de reembolsos."
        />
        <MetricCard
          title="Investimento em Ads"
          value={fmt(metrics.spend)}
          icon={TrendingUp}
          tip="Gasto reportado pela conta do Facebook vinculada a esta dashboard."
        />
        <MetricCard
          title="Lucro Estimado"
          value={fmt(metrics.profit)}
          icon={BarChart3}
          tip="Receita líquida subtraída de gasto em anúncios e custos de produtos."
        />
        <MetricCard
          title="ROAS Real"
          value={metrics.roas > 0 ? `${metrics.roas.toFixed(2)}x` : "—"}
          icon={Zap}
          tip="Faturamento líquido dividido pelo investimento em anúncios."
        />
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Vendas Aprovadas"
          value={metrics.salesCount.toLocaleString()}
          icon={ShoppingCart}
          tip="Total de pedidos confirmados nesta dashboard."
        />
        <MetricCard
          title="Ticket Médio"
          value={fmt(metrics.ticketMedio)}
          icon={DollarSign}
          tip="Média gasta por cliente em cada pedido."
        />
        <MetricCard
          title="CPA (Custo por Venda)"
          value={metrics.cpa > 0 ? fmt(metrics.cpa) : "N/A"}
          icon={Target}
          tip="Investimento em anúncios dividido pelo total de vendas aprovadas."
        />
        <MetricCard
          title="Leads / Visitantes"
          value={leadsCount.toLocaleString()}
          icon={Users}
          tip="Visitas e leads únicos registrados no tracking desta dashboard."
        />
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="ROI"
          value={metrics.spend > 0 ? `${metrics.roi.toFixed(1)}%` : "N/A"}
          icon={TrendingUp}
          tip="Retorno sobre o investimento."
        />
        <MetricCard
          title="Margem de Lucro"
          value={metrics.netRevenue > 0 ? `${((metrics.profit / metrics.netRevenue) * 100).toFixed(1)}%` : "N/A"}
          icon={BarChart3}
          tip="Percentual de lucro sobre a receita líquida."
        />
        <MetricCard
          title="Vendas Reembolsadas"
          value={fmt(metrics.refundAmount)}
          icon={ShoppingCart}
          tip="Total de devoluções e reembolsos."
        />
        <MetricCard
          title="Taxa de Conversão"
          value={leadsCount > 0 ? `${((metrics.salesCount / leadsCount) * 100).toFixed(2)}%` : "0.0%"}
          icon={Target}
          tip="Percentual de leads e visitantes que converteram em vendas."
        />
      </div>
    </div>
  );
}