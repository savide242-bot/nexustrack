import { useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DayPoint {
  date: string;
  revenue: number;
  spend: number;
  profit: number;
}

interface SpendChartProps {
  data: DayPoint[];
  currency: string;
  fmt: (n: number) => string;
}

const CustomTooltip = ({ active, payload, label, fmt }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card/95 backdrop-blur p-3 shadow-xl text-xs space-y-1.5">
      <p className="font-semibold text-foreground mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-mono font-bold" style={{ color: p.color }}>
            {fmt(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
};

export function SpendChart({ data, currency, fmt }: SpendChartProps) {
  const hasData = data.some((d) => d.revenue > 0 || d.spend > 0);

  return (
    <Card className="glass-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="font-display text-lg flex items-center gap-2">
          📈 Receita vs Gasto
          <span className="text-xs font-normal text-muted-foreground ml-auto">
            por dia • {currency}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            Sem dados no período seleccionado
          </div>
        ) : (
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(150,100%,50%)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="hsl(150,100%,50%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradSpend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(0,80%,60%)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="hsl(0,80%,60%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(200,80%,60%)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="hsl(200,80%,60%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,15%)" />
                <XAxis
                  dataKey="date"
                  stroke="hsl(0,0%,40%)"
                  fontSize={10}
                  tickLine={false}
                />
                <YAxis
                  stroke="hsl(0,0%,40%)"
                  fontSize={10}
                  tickLine={false}
                  tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v)))}
                />
                <Tooltip content={<CustomTooltip fmt={fmt} />} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 11, paddingTop: 8, color: "hsl(0,0%,60%)" }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Receita"
                  stroke="hsl(150,100%,50%)"
                  strokeWidth={2}
                  fill="url(#gradRevenue)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
                <Area
                  type="monotone"
                  dataKey="spend"
                  name="Gasto"
                  stroke="hsl(0,80%,60%)"
                  strokeWidth={2}
                  fill="url(#gradSpend)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
                <Area
                  type="monotone"
                  dataKey="profit"
                  name="Lucro"
                  stroke="hsl(200,80%,60%)"
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                  fill="url(#gradProfit)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
