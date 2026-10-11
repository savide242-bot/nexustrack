import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface DashboardOption { id: string; name: string; currency: string; color: string; kind: string; fb_ad_account_id: string | null }

interface Ctx {
  dashboards: DashboardOption[];
  activeId: string | null; // null = Geral (todas)
  active: DashboardOption | null;
  setActiveId: (id: string | null) => void;
  reload: () => void;
}

const DashboardCtx = createContext<Ctx>({ dashboards: [], activeId: null, active: null, setActiveId: () => {}, reload: () => {} });
const KEY = "nexus.activeDashboard";

export function DashboardProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [dashboards, setDashboards] = useState<DashboardOption[]>([]);
  const [activeId, setActive] = useState<string | null>(() => localStorage.getItem(KEY));

  const reload = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("operations")
      .select("id, name, currency, color, kind, fb_ad_account_id").eq("user_id", user.id).order("created_at");
    const list = (data || []) as DashboardOption[];
    setDashboards(list);
    setActive((cur) => (cur && !list.some((d) => d.id === cur) ? null : cur));
  }, [user]);

  useEffect(() => { reload(); }, [reload]);

  const setActiveId = (id: string | null) => {
    setActive(id);
    if (id) localStorage.setItem(KEY, id); else localStorage.removeItem(KEY);
  };

  const active = dashboards.find((d) => d.id === activeId) || null;
  return <DashboardCtx.Provider value={{ dashboards, activeId: active?.id ?? null, active, setActiveId, reload }}>{children}</DashboardCtx.Provider>;
}

export const useDashboard = () => useContext(DashboardCtx);

/** Restrict a query to the active dashboard (no-op when "Geral"). */
export function scopeOp<T>(q: T, activeId: string | null): T {
  return activeId ? (q as any).eq("operation_id", activeId) : q;
}
