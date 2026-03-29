import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Radar, Send, CheckCircle, XCircle, Activity, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Tracking() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [pixelId, setPixelId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [events, setEvents] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("meta_pixel_id, meta_access_token").eq("user_id", user.id).single().then(({ data }) => {
      if (data) {
        setPixelId((data as any).meta_pixel_id || "");
        setAccessToken((data as any).meta_access_token || "");
      }
      setLoaded(true);
    });
    loadEvents();
  }, [user]);

  const loadEvents = async () => {
    const { data } = await supabase.from("capi_events_log").select("*").order("created_at", { ascending: false }).limit(50);
    if (data) setEvents(data);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await (supabase.from("profiles") as any).update({
      meta_pixel_id: pixelId || null,
      meta_access_token: accessToken || null,
    }).eq("user_id", user.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Configuração CAPI salva!" });
    }
    setSaving(false);
  };

  const sendTestEvent = async () => {
    if (!pixelId || !accessToken) {
      toast({ title: "Configure Pixel ID e Access Token primeiro", variant: "destructive" });
      return;
    }
    setTestSending(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/meta-capi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pixel_id: pixelId,
          access_token: accessToken,
          event_name: "PageView",
          user_id: user?.id || null,
          event_data: { email: user?.email || "" },
        }),
      });
      const data = await res.json();
      if (data.ok) {
        toast({ title: "Evento de teste enviado com sucesso!" });
        setTimeout(loadEvents, 1500);
      } else {
        toast({ title: "Erro", description: data.error || "Falha ao enviar", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setTestSending(false);
  };

  if (!loaded) return null;

  const sentCount = events.filter(e => e.status === "sent").length;
  const errorCount = events.filter(e => e.status === "error").length;
  const lastEvent = events.length > 0 ? events[0] : null;

  const pixelConfigured = !!(pixelId && accessToken);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Tracking CAPI</h1>
        <p className="text-muted-foreground">Rastreamento avançado Meta Conversions API — dados reais do comprador</p>
      </div>

      {/* Status Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-4">
        <Card className="glass-card border-border">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Status Pixel</p>
            {pixelConfigured ? (
              <div className="flex items-center justify-center gap-1 mt-1">
                <CheckCircle className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-primary">Configurado</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-1 mt-1">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <span className="text-sm font-medium text-destructive">Não configurado</span>
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="glass-card border-border">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Eventos Enviados</p>
            <p className="text-2xl font-bold font-mono text-primary">{sentCount}</p>
          </CardContent>
        </Card>
        <Card className="glass-card border-border">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Erros</p>
            <p className={`text-2xl font-bold font-mono ${errorCount > 0 ? "text-destructive" : "text-foreground"}`}>{errorCount}</p>
          </CardContent>
        </Card>
        <Card className="glass-card border-border">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Último Envio</p>
            <p className="text-sm font-mono text-muted-foreground mt-1">
              {lastEvent ? new Date(lastEvent.created_at).toLocaleString("pt-MZ", { dateStyle: "short", timeStyle: "short" }) : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card border-border">
        <CardHeader>
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Radar className="h-5 w-5 text-primary" />
            Configuração Meta CAPI
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Pixel ID</Label>
            <Input value={pixelId} onChange={e => setPixelId(e.target.value)} placeholder="123456789012345" />
          </div>
          <div className="space-y-2">
            <Label>Access Token (CAPI)</Label>
            <Input value={accessToken} onChange={e => setAccessToken(e.target.value)} placeholder="EAAxxxxxxx" type="password" />
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={handleSave} className="gradient-primary text-primary-foreground" disabled={saving}>
              {saving ? "Salvando..." : "Salvar Configuração"}
            </Button>
            <Button variant="outline" onClick={sendTestEvent} disabled={testSending} className="border-border">
              <Send className="mr-2 h-4 w-4" />
              {testSending ? "Enviando..." : "Enviar Evento Teste"}
            </Button>
          </div>

          <div className="rounded-lg bg-secondary/30 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-2">📡 Dados enviados ao Meta CAPI:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Email (SHA256), Telefone, Nome completo</li>
              <li>País, Cidade, Estado, CEP</li>
              <li>IP, User-Agent, FBC, FBP</li>
              <li>Valor na <strong>moeda original</strong> (USD/BRL/EUR) — não em MZN</li>
              <li>Deduplicação via event_id único</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Event History */}
      <Card className="glass-card border-border overflow-hidden">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Histórico de Eventos CAPI
            </CardTitle>
            <Badge variant="outline" className="border-border">{events.length} eventos</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum evento CAPI registado. Envie um evento de teste ou aguarde vendas reais.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead>Evento</TableHead>
                  <TableHead>Event ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map(ev => (
                  <TableRow key={ev.id} className="border-border">
                    <TableCell><Badge variant="outline" className="border-border">{ev.event_name}</Badge></TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{ev.event_id?.slice(0, 8)}...</TableCell>
                    <TableCell>
                      {ev.status === "sent" ? (
                        <div className="flex items-center gap-1">
                          <CheckCircle className="h-4 w-4 text-primary" />
                          <span className="text-xs text-primary">Enviado</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <XCircle className="h-4 w-4 text-destructive" />
                          <span className="text-xs text-destructive">Erro</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(ev.created_at).toLocaleString("pt-MZ")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
