import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, BellRing } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Notifications() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [enabling, setEnabling] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("notifications_log").select("*").order("sent_at", { ascending: false }).limit(50).then(({ data }) => {
      if (data) setNotifications(data);
    });

    // Check if push is already enabled
    if ("serviceWorker" in navigator && "PushManager" in window) {
      navigator.serviceWorker.getRegistration().then(reg => {
        if (reg) {
          reg.pushManager.getSubscription().then(sub => {
            if (sub) setPushEnabled(true);
          });
        }
      });
    }

    // Realtime for new notifications
    const channel = supabase
      .channel("notifications-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications_log" }, (payload) => {
        setNotifications(prev => [payload.new as any, ...prev]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const enablePush = async () => {
    if (!user) return;
    setEnabling(true);
    try {
      // Register service worker
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      // Request permission
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast({ title: "Permissão negada", description: "Ative as notificações no navegador", variant: "destructive" });
        setEnabling(false);
        return;
      }

      // Subscribe to push
      const vapidPublicKey = "BAOhQu5GzLaWqPRGOnnJtxaooJsf5IX6IzZ2bfnyCehzXHebgQ-0jLhVZuU-hIjrteYi7R1E-eELWSht3dlk_Y0";
      const urlBase64ToUint8Array = (base64String: string) => {
        const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
        const rawData = window.atob(base64);
        return new Uint8Array([...rawData].map(c => c.charCodeAt(0)));
      };

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      const subJson = subscription.toJSON();

      // Save to database
      const { error } = await supabase.from("push_subscriptions").insert({
        user_id: user.id,
        endpoint: subJson.endpoint!,
        p256dh: subJson.keys!.p256dh!,
        auth_key: subJson.keys!.auth!,
      });

      if (error) throw error;

      setPushEnabled(true);
      toast({ title: "Notificações ativadas!", description: "Receberá alertas de vendas em tempo real" });
    } catch (err: any) {
      console.error("Push setup error:", err);
      toast({ title: "Erro", description: err.message || "Falha ao ativar notificações", variant: "destructive" });
    }
    setEnabling(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Notificações</h1>
          <p className="text-muted-foreground">Histórico de notificações de vendas</p>
        </div>
        {!pushEnabled ? (
          <Button onClick={enablePush} className="gradient-primary text-primary-foreground" disabled={enabling}>
            <BellRing className="mr-2 h-4 w-4" />
            {enabling ? "Ativando..." : "Ativar Notificações"}
          </Button>
        ) : (
          <Button variant="outline" disabled className="border-primary text-primary">
            <Bell className="mr-2 h-4 w-4" />
            Notificações ativas
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <Card className="glass-card border-border">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Bell className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">Nenhuma notificação ainda</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <Card key={n.id} className="glass-card border-border">
              <CardContent className="flex items-start gap-3 p-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Bell className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">{n.title}</p>
                  <p className="text-sm text-muted-foreground">{n.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(n.sent_at).toLocaleString("pt-MZ")}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
