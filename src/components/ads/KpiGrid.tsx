import { Card, CardContent } from "@/components/ui/card";
import { InfoTooltip } from "@/components/InfoTooltip";
import {
  Wallet, DollarSign, PiggyBank, TrendingUp, Target, BarChart3,
  AlertTriangle, Calendar,
} from "lucide-react";

interface KpiItem {
  icon: React.ElementType;
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
  negative?: boolean;
  subValue?: string;
}

interface KpiGridProps {
  spend: number;
  revenue: number;
  profit: number;
  roas: number;
  roi: number;
  salesCount: number;
  cpa: number;
  dailyBudget: number;
  currency: string;
  fmt: (n: number) => string;
}

function KpiCard({ icon: Icon, label, value, hint, accent, negative, subValue }: KpiItem) {
  return (
    <Card className="glass-card border-border hover:neon-border transition-all duration-300 animate-fade-in">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
              negative ? "bg-destructive/10" : accent ? "bg-primary/10" : "bg-muted/50"
            }`}
          >
            <Icon
              className={`h-5 w-5 ${
                negative ? "text-destructive" : accent ? "text-primary" : "text-muted-foreground"
              }`}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {label}
              {hint && <InfoTooltip content={hint} />}
            </p>
            <p
              className={`font-display text-xl font-bold truncate mt-0.5 ${
                negative ? "text-destructive" : accent ? "text-primary" : "text-foreground"
              }`}
            >
              {value}
            </p>
            {subValue && <p className="text-[11px] text-muted-foreground mt-0.5">{subValue}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function KpiGrid({ spend, revenue, profit, roas, roi, salesCount, cpa, dailyBudget, currency, fmt }: KpiGridProps) {
  const items: KpiItem[] = [
    {
      icon: Wallet,
      label: "Gasto em Anúncios",
      value: fmt(spend),
      hint: "Gasto do Facebook + gastos manuais, convertidos ao câmbio do dia.",
      negative: spend > 0 && profit < 0,
    },
    {
      icon: DollarSign,
      label: "Receita",
      value: fmt(revenue),
      hint: "Vendas confirmadas desta operação, na moeda da operação.",
      accent: true,
    },
    {
      icon: PiggyBank,
      label: "Lucro",
      value: fmt(profit),
      hint: "Receita menos gasto em anúncios.",
      accent: profit >= 0,
      negative: profit < 0,
    },
    {
      icon: TrendingUp,
      label: "ROAS",
      value: `${roas.toFixed(2)}x`,
      hint: "Receita dividida pelo gasto. Acima de 2x é bom.",
      accent: roas >= 2,
      negative: roas > 0 && roas < 1,
      subValue: roas >= 3 ? "🔥 Excelente" : roas >= 2 ? "✅ Bom" : roas >= 1 ? "⚠️ Baixo" : roas > 0 ? "❌ Prejuízo" : undefined,
    },
    {
      icon: BarChart3,
      label: "ROI",
      value: `${roi.toFixed(1)}%`,
      hint: "Lucro sobre o gasto, em percentagem.",
      accent: roi >= 0,
      negative: roi < 0,
      subValue: roi >= 100 ? "🔥 Incrível" : roi >= 50 ? "✅ Ótimo" : roi >= 0 ? "⚠️ Modesto" : "❌ Negativo",
    },
    {
      icon: Target,
      label: "Vendas",
      value: String(salesCount),
      hint: "Número de vendas confirmadas no período.",
      accent: salesCount > 0,
    },
    {
      icon: AlertTriangle,
      label: "CPA Real",
      value: cpa > 0 ? fmt(cpa) : "—",
      hint: "Custo por venda confirmada. Quanto custou cada cliente.",
    },
    {
      icon: Calendar,
      label: "Orçamento Ativo/dia",
      value: fmt(dailyBudget),
      hint: "Soma do orçamento diário de todas as campanhas ativas.",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <KpiCard key={item.label} {...item} />
      ))}
    </div>
  );
}
