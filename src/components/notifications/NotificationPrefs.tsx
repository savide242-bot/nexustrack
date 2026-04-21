import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { DollarSign, RotateCcw, Trophy, CalendarClock } from "lucide-react";

interface Prefs {
  push_sales: boolean;
  push_refunds: boolean;
  push_milestones: boolean;
  daily_summary: boolean;
  timezone: string;
}

const DEFAULT: Prefs = {
  push_sales: true,
  push_refunds: true,
  push_milestones: true,
  daily_summary: true,
  timezone: "Africa/Maputo",
};

const TIMEZONES = [
  "Africa/Maputo", "Africa/Johannesburg", "Africa/Luanda", "Africa/Lagos",
  "Europe/Lisbon", "Europe/London", "Europe/Madrid", "America/Sao_Paulo",
  "America/New_York", "UTC",
];

export function NotificationPrefs() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("notification_prefs")
        .select("push_sales, push_refunds, push_milestones, daily_summary, timezone")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) setPrefs(data as Prefs);
      setLoading(false);
    })();
  }, [user]);

  const update = async (patch: Partial<Prefs>) => {
    if (!user) return;
    const next = { ...prefs, ...patch };
    setPrefs(next);
    const { error } = await supabase
      .from("notification_prefs")
      .upsert({ user_id: user.id, ...next }, { onConflict: "user_id" });
    if (error) {
      toast.error("Falha ao guardar preferências");
      setPrefs(prefs);
    } else {
      toast.success("Preferências atualizadas");
    }
  };

  if (loading) return null;

  const Row = ({ icon: Icon, title, desc, value, onChange }: any) => (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-border last:border-0">
      <div className="flex items-start gap-3 min-w-0">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="font-medium text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );

  return (
    <Card className="glass-card border-border">
      <CardHeader>
        <CardTitle className="font-display">Preferências de notificação</CardTitle>
        <p className="text-xs text-muted-foreground">Controla que push notifications recebes</p>
      </CardHeader>
      <CardContent className="space-y-1">
        <Row icon={DollarSign} title="Novas vendas" desc="Push imediato a cada venda aprovada" value={prefs.push_sales} onChange={(v: boolean) => update({ push_sales: v })} />
        <Row icon={RotateCcw} title="Cancelamentos e reembolsos" desc="Avisa quando uma venda é cancelada ou reembolsada" value={prefs.push_refunds} onChange={(v: boolean) => update({ push_refunds: v })} />
        <Row icon={Trophy} title="Metas atingidas" desc="Quando atinges marcos de receita (50k, 100k, 500k MZN)" value={prefs.push_milestones} onChange={(v: boolean) => update({ push_milestones: v })} />
        <Row icon={CalendarClock} title="Resumo diário às 22h" desc="Total de vendas do dia vs dia anterior" value={prefs.daily_summary} onChange={(v: boolean) => update({ daily_summary: v })} />

        <div className="pt-4 space-y-2">
          <Label className="text-xs text-muted-foreground">Fuso horário (afecta o resumo diário)</Label>
          <Select value={prefs.timezone} onValueChange={(v) => update({ timezone: v })}>
            <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((tz) => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
