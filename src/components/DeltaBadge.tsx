import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  delta: number | null;
  /** When true, a NEGATIVE delta is GOOD (e.g., bounce rate). Default false. */
  inverse?: boolean;
  className?: string;
}

export function DeltaBadge({ delta, inverse = false, className }: Props) {
  if (delta === null) {
    return <span className={cn("text-xs text-muted-foreground", className)}>vs período anterior</span>;
  }

  const isFlat = Math.abs(delta) < 0.5;
  const isPositive = delta > 0;
  const good = isFlat ? null : inverse ? !isPositive : isPositive;

  const tone =
    good === null
      ? "text-muted-foreground"
      : good
        ? "text-primary"
        : "text-destructive";

  const Icon = isFlat ? Minus : isPositive ? ArrowUp : ArrowDown;

  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium tabular-nums", tone, className)}>
      <Icon className="h-3 w-3" />
      {Math.abs(delta).toFixed(1)}%
      <span className="text-muted-foreground font-normal">vs período anterior</span>
    </span>
  );
}
