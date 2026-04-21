import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { formatMzn } from "@/lib/format";
import { TrendingUp, ShoppingCart, MousePointerClick, DollarSign } from "lucide-react";

interface FbCampaign {
  campaign_name: string;
  campaign_id: string;
  spend: number;
  impressions: number;
  clicks: number;
  cpc: number;
  cpm: number;
  ctr: number;
  purchases: number;
  cost_per_purchase: number;
  roas: number;
}

interface Props {
  campaign: FbCampaign | null;
  attributedRevenue: number; // MZN attributed to this campaign by name match
  attributedCount: number;
  exchangeRateBrlToMzn: number; // for converting spend BRL → MZN approximation
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function Stat({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent?: boolean }) {
  return (
    <Card className="glass-card border-border">
      <CardContent className="p-4 flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={`font-display text-lg font-bold truncate ${accent ? "text-primary" : "text-foreground"}`}>{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function CampaignDetailModal({ campaign, attributedRevenue, attributedCount, exchangeRateBrlToMzn, open, onOpenChange }: Props) {
  if (!campaign) return null;

  const spendMzn = campaign.spend * (exchangeRateBrlToMzn || 1);
  const realRoas = spendMzn > 0 ? attributedRevenue / spendMzn : 0;
  const realCpa = attributedCount > 0 ? spendMzn / attributedCount : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl glass-card border-border">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{campaign.campaign_name}</DialogTitle>
          <p className="text-xs text-muted-foreground">ID: {campaign.campaign_id}</p>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground mb-2">Performance Meta Ads</h4>
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
              <Stat icon={DollarSign} label="Gasto" value={`R$ ${campaign.spend.toFixed(2)}`} />
              <Stat icon={MousePointerClick} label="Cliques" value={campaign.clicks.toLocaleString()} />
              <Stat icon={ShoppingCart} label="Compras Meta" value={String(campaign.purchases)} />
              <Stat icon={TrendingUp} label="ROAS Meta" value={`${campaign.roas.toFixed(2)}x`} accent />
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-muted-foreground mb-2">Atribuição real (vendas confirmadas)</h4>
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
              <Stat icon={ShoppingCart} label="Vendas atribuídas" value={String(attributedCount)} accent />
              <Stat icon={DollarSign} label="Receita real" value={formatMzn(attributedRevenue)} accent />
              <Stat icon={TrendingUp} label="ROAS real" value={`${realRoas.toFixed(2)}x`} accent />
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Atribuição faz match por <code className="text-primary">utm_campaign</code> com o nome da campanha. Se o ROAS real estiver abaixo do Meta, o pixel pode estar sub-reportando.
            </p>
            {attributedCount > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                CPA real: <span className="text-foreground font-mono">{formatMzn(realCpa)}</span> por venda
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border">
            <div><p className="text-xs text-muted-foreground">CTR</p><p className="font-mono text-sm">{campaign.ctr.toFixed(2)}%</p></div>
            <div><p className="text-xs text-muted-foreground">CPC</p><p className="font-mono text-sm">R$ {campaign.cpc.toFixed(2)}</p></div>
            <div><p className="text-xs text-muted-foreground">CPM</p><p className="font-mono text-sm">R$ {campaign.cpm.toFixed(2)}</p></div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
