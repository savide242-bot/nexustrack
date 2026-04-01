import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Progress } from "@/components/ui/progress";
import { TrendingUp } from "lucide-react";

const GOAL = 100_000;
const LEGACY_OFFSET = 59_157;
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
      .select("amount_mzn, status");
    if (!data) return;
    const total = data.reduce((sum, s: any) => {
      if (s.status === "refunded") return sum - (Number(s.amount_mzn) || 0);
      return sum + (Number(s.amount_mzn) || 0);
    }, 0);
    setRevenue(Math.max(0, total));
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

  const pct = Math.min((revenue / GOAL) * 100, 100);
  const formatted = revenue >= 1000 ? `${(revenue / 1000).toFixed(1)}K` : revenue.toLocaleString("pt-MZ");

  return (
    <div className="flex items-center gap-3 min-w-[200px] max-w-[320px]">
      <TrendingUp className="h-4 w-4 text-primary flex-shrink-0" />
      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="font-mono font-medium text-foreground">{formatted} MT</span>
          <span className="text-muted-foreground">100K MT</span>
        </div>
        <Progress value={pct} className="h-2" />
      </div>
    </div>
  );
}
