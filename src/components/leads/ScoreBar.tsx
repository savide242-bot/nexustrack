import { cn } from "@/lib/utils";

interface Props {
  score: number;
  className?: string;
}

export function ScoreBar({ score, className }: Props) {
  const pct = Math.max(0, Math.min(100, score));
  // gradient hue: 0 -> 0deg (red), 100 -> 140deg (green)
  const hue = (pct / 100) * 140;
  return (
    <div className={cn("flex items-center gap-2 min-w-[120px]", className)}>
      <div className="flex-1 h-2 rounded-full bg-secondary/40 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: `hsl(${hue} 90% 50%)` }}
        />
      </div>
      <span className="text-xs font-bold tabular-nums w-7 text-right">{pct}</span>
    </div>
  );
}
