import { createContext, useContext, useCallback, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { fetchRates, type Rates, formatCurrency, convert } from "@/lib/currency";

export interface Dashboard {
  id: string;
  user_id: string;
  name: string;
  language?: string;
  currency: string;
  timezone?: string;
  kind?: string;
  fb_ad_account_id?: string | null;
  fb_ad_account_name?: string | null;
  fb_account_currency?: string | null;
  revenue_goal?: number;
  revenue_goal_period?: string;
  revenue_goal_metric?: string;
  product_cost?: number;
  payment_fee_pct?: number;
  other_costs?: number;
  is_active?: boolean;
  created_at: string;
}

interface DashboardContextType {
  dashboards: Dashboard[];
  current: Dashboard | null;
  loading: boolean;
  rates: Rates;
  selectDashboard: (id: string) => void;
  reloadDashboards: () => Promise<void>;
  fmt: (n: number) => string;
  cv: (amount: number, from: string) => number;
}

const DashboardContext = createContext<DashboardContextType>({
  dashboards: [],
  current: null,
  loading: true,
  rates: { USD: 1 },
  selectDashboard: () => {},
  reloadDashboards: async () => {},
  fmt: (n) => String(n),
  cv: (n) => n,
});

export const useDashboard = () => useContext(DashboardContext);

const SELECTED_KEY = "nx_selected_dashboard";

export function DashboardProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [selectedId, setSelectedId] = useState<string>(() => {
    try { return localStorage.getItem(SELECTED_KEY) || ""; } catch { return ""; }
  });
  const [loading, setLoading] = useState(true);
  const [rates, setRates] = useState<Rates>({ USD: 1 });

  useEffect(() => { fetchRates().then(setRates); }, []);

  const loadDashboards = useCallback(async () => {
    if (!user) { setDashboards([]); setLoading(false); return; }
    setLoading(true);

    // Tenta primeiro "operations" (tabela existente no Supabase), ou fallback para "dashboards"
    let res = await supabase
      .from("operations")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (res.error && res.error.message.includes("schema cache")) {
      res = await supabase
        .from("dashboards" as any)
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });
    }

    const list = (res.data || []) as Dashboard[];
    setDashboards(list);

    if (!selectedId || !list.find((d) => d.id === selectedId)) {
      const first = list[0]?.id || "";
      setSelectedId(first);
      try { localStorage.setItem(SELECTED_KEY, first); } catch {}
    }
    setLoading(false);
  }, [user, selectedId]);

  useEffect(() => { loadDashboards(); }, [loadDashboards]);

  const selectDashboard = (id: string) => {
    setSelectedId(id);
    try { localStorage.setItem(SELECTED_KEY, id); } catch {}
  };

  const current = dashboards.find((d) => d.id === selectedId) || null;
  const cur = current?.currency || "MZN";

  const fmt = useCallback((n: number) => formatCurrency(n, cur), [cur]);
  const cv = useCallback((amount: number, from: string) => convert(amount, from, cur, rates), [cur, rates]);

  return (
    <DashboardContext.Provider value={{
      dashboards,
      current,
      loading,
      rates,
      selectDashboard,
      reloadDashboards: loadDashboards,
      fmt,
      cv,
    }}>
      {children}
    </DashboardContext.Provider>
  );
}