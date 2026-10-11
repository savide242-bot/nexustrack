import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, CheckCircle, AlertTriangle, XCircle, Loader2 } from "lucide-react";

export interface Alert {
  id: string;
  level: "success" | "warning" | "danger";
  message: string;
  detail?: string;
}

interface AlertsPanelProps {
  alerts: Alert[];
  onSendPush: (alert: Alert) => Promise<void>;
  sendingId: string | null;
}

const levelConfig = {
  success: {
    icon: CheckCircle,
    bg: "bg-primary/10",
    border: "border-primary/20",
    text: "text-primary",
    label: "OK",
  },
  warning: {
    icon: AlertTriangle,
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/20",
    text: "text-yellow-400",
    label: "Atenção",
  },
  danger: {
    icon: XCircle,
    bg: "bg-destructive/10",
    border: "border-destructive/20",
    text: "text-destructive",
    label: "Alerta",
  },
};

function AlertRow({ alert, onSend, sending }: { alert: Alert; onSend: () => void; sending: boolean }) {
  const cfg = levelConfig[alert.level];
  const Icon = cfg.icon;
  return (
    <div className={`flex items-start gap-3 rounded-lg border ${cfg.border} ${cfg.bg} p-3`}>
      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${cfg.text}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${cfg.text}`}>{alert.message}</p>
        {alert.detail && <p className="text-xs text-muted-foreground mt-0.5">{alert.detail}</p>}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 opacity-60 hover:opacity-100"
        onClick={onSend}
        disabled={sending}
        title="Enviar notificação push"
      >
        {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bell className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}

export function AlertsPanel({ alerts, onSendPush, sendingId }: AlertsPanelProps) {
  return (
    <Card className="glass-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="font-display text-lg flex items-center gap-2">
          🎯 Alertas da Operação
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {alerts.length === 0 ? (
          <div className="flex h-28 items-center justify-center text-sm text-muted-foreground">
            Sem alertas — operação saudável ✅
          </div>
        ) : (
          alerts.map((a) => (
            <AlertRow
              key={a.id}
              alert={a}
              onSend={() => onSendPush(a)}
              sending={sendingId === a.id}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}
