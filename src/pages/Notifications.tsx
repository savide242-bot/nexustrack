import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Bell } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Notification = Tables<"notifications_log">;

export default function Notifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("notifications_log").select("*").order("sent_at", { ascending: false }).limit(50).then(({ data }) => {
      if (data) setNotifications(data);
    });
  }, [user]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Notificações</h1>
        <p className="text-muted-foreground">Histórico de notificações de vendas</p>
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
