import { useDashboard } from "@/contexts/DashboardContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { LayoutDashboard, Loader2 } from "lucide-react";

export function DashboardSelector() {
  const { dashboards, current, loading, selectDashboard } = useDashboard();

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        A carregar...
      </div>
    );
  }

  if (dashboards.length === 0) {
    return (
      <div className="px-3 py-2 text-xs text-muted-foreground">
        Nenhuma dashboard criada
      </div>
    );
  }

  return (
    <div className="px-2 pb-2">
      <Select value={current?.id || ""} onValueChange={selectDashboard}>
        <SelectTrigger className="w-full glass-card border-border h-auto py-2">
          <div className="flex items-center gap-2 text-left">
            <LayoutDashboard className="h-4 w-4 text-primary shrink-0" />
            <div className="min-w-0 flex-1">
              <SelectValue placeholder="Selecionar dashboard" />
            </div>
          </div>
        </SelectTrigger>
        <SelectContent>
          {dashboards.map((d) => (
            <SelectItem key={d.id} value={d.id}>
              <div className="flex items-center gap-2">
                <span className="truncate">{d.name}</span>
                <Badge variant="outline" className="text-[10px] shrink-0">{d.currency}</Badge>
                {d.kind === "organic" && <Badge variant="secondary" className="text-[9px]">Org</Badge>}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}