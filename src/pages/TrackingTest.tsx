import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDashboard } from "@/contexts/DashboardContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Play, CheckCircle2, XCircle, Bug, Loader2 } from "lucide-react";

export default function TrackingTest() {
  const { current } = useDashboard();
  const { toast } = useToast();

  const [eventType, setEventType] = useState("Purchase");
  const [testEmail, setTestEmail] = useState("lead.teste@exemplo.com");
  const [testAmount, setTestAmount] = useState("1500");
  const [testUtmSource, setTestUtmSource] = useState("fb");
  const [testUtmCampaign, setTestUtmCampaign] = useState("Campanha Teste 01");
  const [sending, setSending] = useState(false);

  const [diagnosticResult, setDiagnosticResult] = useState<any>(null);

  const runTest = async () => {
    if (!current) {
      toast({ title: "Selecione uma dashboard primeiro", variant: "destructive" });
      return;
    }

    setSending(true);
    setDiagnosticResult(null);

    const payload = {
      nx_dash: current.id,
      event_type: eventType,
      email: testEmail,
      value: Number(testAmount) || 0,
      currency: current.currency,
      utm_source: testUtmSource,
      utm_campaign: testUtmCampaign,
      is_test: true,
      page_url: "https://minhaloja.com/teste",
    };

    try {
      const res = await supabase.functions.invoke("track", { body: payload });

      setDiagnosticResult({
        sentPayload: payload,
        response: res.data || res.error,
        status: res.error ? "error" : "success",
        timestamp: new Date().toLocaleTimeString(),
        dashboardName: current.name,
      });

      if (!res.error) {
        toast({ title: "Evento de teste disparado com sucesso!" });
      }
    } catch (err: any) {
      setDiagnosticResult({
        sentPayload: payload,
        response: err.message,
        status: "error",
        timestamp: new Date().toLocaleTimeString(),
      });
      toast({ title: "Falha no envio do teste", variant: "destructive" });
    }
    setSending(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <Bug className="h-6 w-6 text-primary" />
          Testar Tracking & Diagnóstico
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Simule eventos em tempo real para verificar atribuição, webhooks e isolamento sem contaminar faturamento real.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
        {/* Formulário de Simulação */}
        <Card className="glass-card border-border">
          <CardHeader>
            <CardTitle className="text-lg">Configurar Evento Simulado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Dashboard de Destino</Label>
              <Input disabled value={current?.name || "Nenhuma dashboard selecionada"} className="font-semibold" />
            </div>

            <div className="space-y-1.5">
              <Label>Tipo de Evento</Label>
              <Select value={eventType} onValueChange={setEventType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PageView">PageView (Visualização)</SelectItem>
                  <SelectItem value="Lead">Lead (Captura)</SelectItem>
                  <SelectItem value="InitiateCheckout">InitiateCheckout (Checkout)</SelectItem>
                  <SelectItem value="Purchase">Purchase (Compra Aprovada)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Email do Visitante</Label>
              <Input value={testEmail} onChange={(e) => setTestEmail(e.target.value)} />
            </div>

            {eventType === "Purchase" && (
              <div className="space-y-1.5">
                <Label>Valor do Pedido ({current?.currency})</Label>
                <Input value={testAmount} onChange={(e) => setTestAmount(e.target.value)} type="number" />
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">utm_source</Label>
                <Input value={testUtmSource} onChange={(e) => setTestUtmSource(e.target.value)} className="text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">utm_campaign</Label>
                <Input value={testUtmCampaign} onChange={(e) => setTestUtmCampaign(e.target.value)} className="text-xs" />
              </div>
            </div>

            <Button onClick={runTest} disabled={sending} className="w-full gradient-primary text-primary-foreground gap-2 mt-2">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Disparar Evento de Teste
            </Button>
          </CardContent>
        </Card>

        {/* Console de Diagnóstico */}
        <Card className="glass-card border-border">
          <CardHeader>
            <CardTitle className="text-lg">Resultado do Diagnóstico</CardTitle>
          </CardHeader>
          <CardContent>
            {!diagnosticResult ? (
              <div className="h-64 flex flex-col items-center justify-center text-sm text-muted-foreground border border-dashed border-border rounded-xl">
                <Bug className="h-8 w-8 mb-2 opacity-40" />
                Configure os dados e clique em "Disparar Evento de Teste" para ver a resposta.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20">
                  <div className="flex items-center gap-2">
                    {diagnosticResult.status === "success" ? (
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                    ) : (
                      <XCircle className="h-5 w-5 text-destructive" />
                    )}
                    <span className="font-semibold text-sm">
                      {diagnosticResult.status === "success" ? "Evento Processado com Sucesso" : "Falha no Processamento"}
                    </span>
                  </div>
                  <Badge variant="outline" className="font-mono text-xs">{diagnosticResult.timestamp}</Badge>
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground">Payload Enviado:</p>
                  <pre className="p-3 rounded-lg bg-black/60 border border-border text-xs font-mono text-green-400 overflow-x-auto">
                    {JSON.stringify(diagnosticResult.sentPayload, null, 2)}
                  </pre>
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground">Resposta do Servidor:</p>
                  <pre className="p-3 rounded-lg bg-black/60 border border-border text-xs font-mono text-blue-400 overflow-x-auto">
                    {JSON.stringify(diagnosticResult.response, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}