interface Step {
  label: string;
  value: number;
}

interface Props {
  steps: Step[];
}

export function Funnel({ steps }: Props) {
  const max = Math.max(...steps.map((s) => s.value), 1);

  return (
    <div className="space-y-3">
      {steps.map((step, i) => {
        const widthPct = (step.value / max) * 100;
        const conv =
          i > 0 && steps[i - 1].value > 0
            ? ((step.value / steps[i - 1].value) * 100).toFixed(1)
            : null;
        return (
          <div key={step.label}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-foreground font-medium">{step.label}</span>
              <div className="flex items-center gap-2">
                <span className="font-display font-bold tabular-nums">{step.value.toLocaleString("pt-MZ")}</span>
                {conv !== null && (
                  <span className="text-xs text-muted-foreground tabular-nums">({conv}%)</span>
                )}
              </div>
            </div>
            <div className="h-3 rounded-md bg-secondary/40 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-500"
                style={{ width: `${Math.max(widthPct, 2)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
