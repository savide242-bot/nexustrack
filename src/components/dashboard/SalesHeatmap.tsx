import { useMemo } from "react";

interface Props {
  /** Each item must have the real sale date and `amount_mzn`. */
  sales: { created_at: string; sale_date?: string | null; amount_mzn: number | string | null; status: string }[];
}

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function SalesHeatmap({ sales }: Props) {
  const { grid, max } = useMemo(() => {
    // grid[day][hour] = total MZN
    const g: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    let m = 0;
    for (const s of sales) {
      if (!["approved", "realized"].includes(s.status)) continue;
      const amt = Number(s.amount_mzn) || 0;
      if (amt <= 0) continue;
      const d = new Date(s.sale_date || s.created_at);
      const day = d.getDay();
      const hour = d.getHours();
      g[day][hour] += amt;
      if (g[day][hour] > m) m = g[day][hour];
    }
    return { grid: g, max: m };
  }, [sales]);

  if (max === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Sem vendas suficientes para gerar heatmap
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="inline-block min-w-full">
        <div className="flex gap-1 pl-10 mb-1">
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="w-4 text-[9px] text-muted-foreground text-center tabular-nums">
              {h % 3 === 0 ? h : ""}
            </div>
          ))}
        </div>
        {grid.map((row, day) => (
          <div key={day} className="flex items-center gap-1 mb-1">
            <div className="w-9 text-xs text-muted-foreground tabular-nums">{DAYS[day]}</div>
            {row.map((val, hour) => {
              const intensity = val === 0 ? 0 : 0.15 + (val / max) * 0.85;
              return (
                <div
                  key={hour}
                  className="h-4 w-4 rounded-sm border border-border/40"
                  style={{
                    backgroundColor:
                      val === 0
                        ? "hsl(var(--muted) / 0.3)"
                        : `hsl(150 100% 50% / ${intensity})`,
                  }}
                  title={`${DAYS[day]} ${hour}h — ${Math.round(val).toLocaleString("pt-MZ")} MT`}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
