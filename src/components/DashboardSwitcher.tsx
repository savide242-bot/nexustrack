import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDashboard } from "@/contexts/DashboardContext";

export function DashboardSwitcher() {
  const { dashboards, activeId, setActiveId } = useDashboard();
  if (dashboards.length === 0) return null;
  return (
    <Select value={activeId ?? "all"} onValueChange={(v) => setActiveId(v === "all" ? null : v)}>
      <SelectTrigger className="h-8 w-[180px] md:w-[220px]" aria-label="Dashboard activa">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Geral (todas)</SelectItem>
        {dashboards.map((d) => (
          <SelectItem key={d.id} value={d.id}>
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
              {d.name} · {d.currency}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
