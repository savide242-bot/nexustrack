import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Progress } from "@/components/ui/progress";
import { TrendingUp } from "lucide-react";

const LEGACY_OFFSET = 59_157;
/** Only sales created after this cutoff are added on top of the legacy offset */
const CUTOFF = "2026-04-01T00:00:00+02:00";

const MILESTONES = [100_000, 500_000, 1_000_000, 5_000_000, 10_000_000];

function getMilestone(revenue: number): { floor: number; goal: number } {
  for (const m of MILESTONES) {
    if (revenue < m) return { floor: revenue >= MILESTONES[0] ? MILESTONES[MILESTONES.indexOf(m) - 1] ?? 0 : 0, goal: m };
  }
  const last = MILESTONES[MILESTONES.length - 1];
  return { floor: last, goal: last * 2 };
}

function formatAmount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value.toLocaleString("pt-MZ");
}

const createChannelId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function RevenueProgress() {
  const { user } = useAuth();
  const [revenue, setRevenue] = useState(0);

  const fetchRevenue = useCallback(async () => {
    const { data } = await supabase
      .from("sales")
      .select("amount_mzn, status, created_at")
      .gte("created_at", CUTOFF);
    if (!data) return;
    const total = data.reduce((sum, s: any) => {
      const amt = Number(s.amount_mzn) || 0;
      if (amt <= 0) return sum;
      if (s.status === "refunded") return sum - amt;
      return sum + amt;
    }, 0);
    setRevenue(LEGACY_OFFSET + Math.max(0, total));
  }, []);

  useEffect(() => {
    if (!user) {
      setRevenue(0);
      return;
    }

    void fetchRevenue();

    const channel = supabase
      .channel(`revenue-progress-${createChannelId()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, () => {
        void fetchRevenue();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchRevenue, user]);

  const { floor, goal } = getMilestone(revenue);
  const range = goal - floor;
  const progress = revenue - floor;
  const pct = Math.min((progress / range) * 100, 100);
  const formatted = formatAmount(revenue);
  const goalFormatted = formatAmount(goal);

  return (
    <div className="flex items-center gap-3 min-w-[200px] max-w-[320px]">
      <TrendingUp className="h-4 w-4 text-primary flex-shrink-0" />
      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="font-mono font-medium text-foreground">{formatted} MT</span>
          <span className="text-muted-foreground">{goalFormatted} MT</span>
        </div>
        <Progress value={pct} className="h-2" />
      </div>
    </div>
  );
}
