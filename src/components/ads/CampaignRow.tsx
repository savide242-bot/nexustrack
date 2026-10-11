import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Pause, Play, ChevronDown, ChevronRight, Loader2 } from "lucide-react";

export interface AdSet {
  adset_id: string; adset_name: string; status: string; effective_status: string;
  daily_budget: number | null; spend: number; impressions: number;
  clicks: number; ctr: number; purchases: number; roas: number;
}

export interface Campaign {
  campaign_id: string; campaign_name: string; status: string; effective_status: string;
  objective: string | null; daily_budget: number | null; lifetime_budget: number | null;
  spend: number; impressions: number; clicks: number; cpc: number; cpm: number;
  ctr: number; purchases: number; cost_per_purchase: number; roas: number; platform_revenue: number;
}

interface CampaignRowProps {
  campaign: Campaign; adsets: AdSet[]; loadingAdsets: boolean;
  accountCurrency: string; opCurrency: string;
  fmt: (n: number) => string; fmtAcc: (n: number) => string;
  onToggle: (c: Campaign) => void; onBudget: (c: Campaign) => void;
  onFetchAdsets: (campaignId: string) => void;
  onToggleAdset: (adset: AdSet) => void; onAdsetBudget: (adset: AdSet) => void;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "ACTIVE") return <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px]">Ativa</Badge>;
  if (status === "PAUSED") return <Badge variant="secondary" className="text-[10px]">Pausada</Badge>;
  return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
}

const td = "px-3 py-2.5 text-sm align-middle";
const tdR = `${td} text-right font-mono text-xs`;

export function CampaignRow({ campaign: c, adsets, loadingAdsets, accountCurrency, opCurrency, fmt, fmtAcc, onToggle, onBudget, onFetchAdsets, onToggleAdset, onAdsetBudget }: CampaignRowProps) {
  const [expanded, setExpanded] = useState(false);

  const handleExpand = () => {
    if (!expanded) onFetchAdsets(c.campaign_id);
    setExpanded((v) => !v);
  };

  const roasColor = c.roas >= 3 ? "text-primary" : c.roas >= 2 ? "text-yellow-400" : c.roas > 0 ? "text-destructive" : "text-muted-foreground";

  return (
    <>
      <tr className="border-b border-border/50 hover:bg-muted/20 transition-colors group">
        <td className="w-8 pl-3 py-2.5 align-middle">
          <button onClick={handleExpand} className="text-muted-foreground hover:text-foreground transition-colors">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </td>
        <td className={td}>
          <p className="font-medium text-foreground truncate max-w-[200px]">{c.campaign_name}</p>
          <div className="flex items-center gap-1 mt-0.5">
            <StatusBadge status={c.status} />
            {c.objective && <span className="text-[10px] text-muted-foreground">{c.objective.replace(/_/g," ")}</span>}
          </div>
        </td>
        <td className={td}><Switch checked={c.status === "ACTIVE"} onCheckedChange={() => onToggle(c)} /></td>
        <td className={tdR}>{c.daily_budget ? fmt(c.daily_budget) : "—"}</td>
        <td className={tdR}>{fmt(c.spend)}</td>
        <td className={tdR}>{c.clicks.toLocaleString()}</td>
        <td className={tdR}>{c.ctr.toFixed(2)}%</td>
        <td className={tdR}>{c.purchases}</td>
        <td className={`${tdR} font-bold ${roasColor}`}>{c.roas > 0 ? `${c.roas.toFixed(2)}x` : "—"}</td>
        <td className={`${td} text-right`}>
          <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onBudget(c)} title="Editar orcamento"><Pencil className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onToggle(c)} title={c.status === "ACTIVE" ? "Pausar" : "Ativar"}>
              {c.status === "ACTIVE" ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </td>
      </tr>

      {expanded && (
        <>
          {loadingAdsets ? (
            <tr><td colSpan={10} className="bg-muted/10 py-4 text-center"><Loader2 className="h-4 w-4 animate-spin text-primary mx-auto" /></td></tr>
          ) : adsets.length === 0 ? (
            <tr><td colSpan={10} className="bg-muted/10 py-3 text-center text-xs text-muted-foreground">Nenhum adset encontrado neste periodo</td></tr>
          ) : (
            adsets.map((a) => {
              const aRoasColor = a.roas >= 3 ? "text-primary" : a.roas >= 2 ? "text-yellow-400" : a.roas > 0 ? "text-destructive" : "text-muted-foreground";
              return (
                <tr key={a.adset_id} className="border-b border-border/30 bg-muted/10 hover:bg-muted/20 transition-colors">
                  <td />
                  <td className={td}>
                    <div className="flex items-center gap-2 pl-6">
                      <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground shrink-0" />
                      <div>
                        <p className="text-sm text-foreground/80 truncate max-w-[180px]">{a.adset_name}</p>
                        <StatusBadge status={a.status} />
                      </div>
                    </div>
                  </td>
                  <td className={td}><Switch checked={a.status === "ACTIVE"} onCheckedChange={() => onToggleAdset(a)} className="scale-90" /></td>
                  <td className={`${tdR} text-muted-foreground`}>{a.daily_budget ? fmt(a.daily_budget) : "—"}</td>
                  <td className={`${tdR} text-muted-foreground`}>{fmt(a.spend)}</td>
                  <td className={`${tdR} text-muted-foreground`}>{a.clicks.toLocaleString()}</td>
                  <td className={`${tdR} text-muted-foreground`}>{a.ctr.toFixed(2)}%</td>
                  <td className={`${tdR} text-muted-foreground`}>{a.purchases}</td>
                  <td className={`${tdR} font-bold ${aRoasColor}`}>{a.roas > 0 ? `${a.roas.toFixed(2)}x` : "—"}</td>
                  <td className={`${td} text-right`}>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onAdsetBudget(a)} title="Editar orcamento do adset"><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onToggleAdset(a)} title={a.status === "ACTIVE" ? "Pausar" : "Ativar"}>
                        {a.status === "ACTIVE" ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </>
      )}
    </>
  );
}