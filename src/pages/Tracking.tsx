import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Radar, Send, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Tracking() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [pixelId, setPixelId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [events, setEvents] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [testSending, setTestSending] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("campaigns").select("id, name, meta_pixel_id, meta_access_token").order("created_at", { ascending: false }).then(({ data }) => {
      if (data) setCampaigns(data);
    });
  }, [user]);

  useEffect(() => {
    if (!selectedCampaign) return;
    const camp = campaigns.find(c => c.id === selectedCampaign);
    if (camp) {
      setPixelId(camp.meta_pixel_id || "");
      setAccessToken(camp.meta_access_token || "");
    }
    // Load CAPI events
    supabase.from("capi_events_log").select("*").eq("campaign_id", selectedCampaign).order("created_at", { ascending: false }).limit(50).then(({ data }) => {
      if (data) setEvents(data);
    });
  }, [selectedCampaign, campaigns]);

  const handleSave = async () => {
    if (!selectedCampaign) return;
    setSaving(true);
    const { error } = await supabase.from("campaigns").update({
      meta_pixel_id: pixelId,
      meta_access_token: accessToken,
    }).eq("id", selectedCampaign);
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
          campaign_id: selectedCampaign,
          pixel_id: pixelId,
          access_token: accessToken,
          event_name: "PageView",
          event_data: { email: user?.email || "" },
        }),
      });
      const data = await res.json();
      if (data.ok) {
        toast({ title: "Evento de teste enviado!" });
        // Refresh events
        const { data: newEvents } = await supabase.from("capi_events_log").select("*").eq("campaign_id", selectedCampaign).order("created_at", { ascending: false }).limit(50);
        if (newEvents) setEvents(newEvents);
      } else {
        toast({ title: "Erro", description: data.error || "Falha ao enviar", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setTestSending(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Tracking CAPI</h1>
        <p className="text-muted-foreground">Rastreamento avançado Meta Conversions API — dados reais do comprador</p>
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
            <Label>Campanha</Label>
            <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
              <SelectTrigger><SelectValue placeholder="Selecionar campanha" /></SelectTrigger>
              <SelectContent>
                {campaigns.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {selectedCampaign && (
            <>
              <div className="space-y-2">
                <Label>Pixel ID</Label>
                <Input value={pixelId} onChange={e => setPixelId(e.target.value)} placeholder="123456789012345" />
              </div>
              <div className="space-y-2">
                <Label>Access Token (CAPI)</Label>
                <Input value={accessToken} onChange={e => setAccessToken(e.target.value)} placeholder="EAAxxxxxxx" type="password" />
              </div>
              <div className="flex gap-2">
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
            </>
          )}
        </CardContent>
      </Card>

      {selectedCampaign && events.length > 0 && (
        <Card className="glass-card border-border overflow-hidden">
          <CardHeader>
            <CardTitle className="font-display text-lg">Histórico de Eventos CAPI</CardTitle>
          </CardHeader>
          <CardContent>
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
                    <TableCell className="font-mono text-xs text-muted-foreground">{ev.event_id.slice(0, 8)}...</TableCell>
                    <TableCell>
                      {ev.status === "sent" ? (
                        <CheckCircle className="h-4 w-4 text-primary" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(ev.created_at).toLocaleString("pt-MZ")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
