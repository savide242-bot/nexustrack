import { Package } from "lucide-react";
import { formatMzn } from "@/lib/format";

interface Props {
  sales: { product_name: string | null; amount_mzn: number | string | null; status: string }[];
}

export function TopProducts({ sales }: Props) {
  const map = new Map<string, { revenue: number; count: number }>();
  for (const s of sales) {
    if (!["approved", "realized"].includes(s.status)) continue;
    const amt = Number(s.amount_mzn) || 0;
    if (amt <= 0) continue;
    const name = s.product_name || "Sem nome";
    const cur = map.get(name) || { revenue: 0, count: 0 };
    cur.revenue += amt;
    cur.count += 1;
    map.set(name, cur);
  }

  const top = [...map.entries()]
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 3);

  if (top.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center py-8 text-muted-foreground">
        <Package className="mb-2 h-8 w-8" />
        <p className="text-sm">Sem produtos vendidos no período</p>
      </div>
    );
  }

  const maxRev = top[0][1].revenue;

  return (
    <div className="space-y-3">
      {top.map(([name, data], i) => {
        const widthPct = (data.revenue / maxRev) * 100;
        return (
          <div key={name} className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary tabular-nums">
                  {i + 1}
                </span>
                <span className="text-sm font-medium truncate">{name}</span>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="font-display text-sm font-bold">{formatMzn(data.revenue)}</div>
                <div className="text-[10px] text-muted-foreground">{data.count} vendas</div>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-secondary/40 overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${widthPct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
