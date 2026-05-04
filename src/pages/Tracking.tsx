import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Radar, Send, CheckCircle, XCircle, Activity, AlertTriangle, Terminal, Pencil, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Tracking() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [pixelId, setPixelId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [savedPixel, setSavedPixel] = useState("");
  const [tokenInfo, setTokenInfo] = useState<{ exists: boolean; masked?: string }>({ exists: false });
  const [events, setEvents] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [liveLines, setLiveLines] = useState<{ time: string; text: string; ok: boolean }[]>([]);
  const terminalRef = useRef<HTMLDivElement>(null);

  const loadAll = async () => {
    if (!user) return;
    const [{ data: profile }, vault] = await Promise.all([
      supabase.from("profiles").select("meta_pixel_id").eq("user_id", user.id).maybeSingle(),
      supabase.functions.invoke("secrets-vault", { body: { action: "preview", kind: "meta_access_token" } }),
    ]);
    setPixelId(profile?.meta_pixel_id || "");
    setSavedPixel(profile?.meta_pixel_id || "");
    const v = vault.data as any;
    setTokenInfo({ exists: !!v?.exists, masked: v?.masked });
    setLoaded(true);
  };

  useEffect(() => {
    loadAll();
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`capi-live-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "capi_events_log" }, (payload: any) => {
        const ev = payload.new;
        if (!ev) return;
        const time = new Date(ev.created_at).toLocaleTimeString("pt-MZ", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        const ok = ev.status === "sent";
        const text = ok
          ? `${ev.event_name} — event_id: ${(ev.event_id || "").slice(0, 12)}… — sent`
          : `${ev.event_name} — error: ${JSON.stringify(ev.response || "unknown").slice(0, 60)}`;
        setLiveLines(prev => [...prev.slice(-49), { time, text, ok }]);
        setEvents(prev => [ev, ...prev].slice(0, 50));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  useEffect(() => {
    if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
  }, [liveLines]);

  const loadEvents = async () => {
    const { data } = await supabase.from("capi_events_log").select("*").order("created_at", { ascending: false }).limit(50);
    if (data) setEvents(data);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // Save pixel id (non-sensitive) directly
      const { error: pErr } = await supabase.from("profiles").update({ meta_pixel_id: pixelId || null }).eq("user_id", user.id);
      if (pErr) throw pErr;
      // Save token via vault
      if (accessToken) {
        const { error: vErr } = await supabase.functions.invoke("secrets-vault", {
          body: { action: "set", kind: "meta_access_token", value: accessToken },
        });
        if (vErr) throw vErr;
      }
      toast({ title: "Configuração CAPI salva!" });
      setSavedPixel(pixelId);
      setAccessToken("");
      setEditing(false);
      await loadAll();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const sendTestEvent = async () => {
    if (!savedPixel || !tokenInfo.exists) {
      toast({ title: "Configure Pixel ID e Access Token primeiro", variant: "destructive" });
      return;
    }
    setTestSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("meta-capi", {
        body: {
          event_name: "PageView",
          user_id: user?.id || null,
          event_data: { email: user?.email || "" },
        },
      });
      if (error) throw error;
      if ((data as any)?.ok) {
        toast({ title: "Evento de teste enviado com sucesso!" });
        setTimeout(loadEvents, 1500);
      } else {
        toast({ title: "Erro", description: (data as any)?.error || "Falha ao enviar", variant: "destructive" });
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
  const pixelConfigured = !!(savedPixel && tokenInfo.exists);
  const hasSavedConfig = savedPixel.length > 0 || tokenInfo.exists;

  return (
    <div className="space-y-6">
      <div className="animate-fade-in">
        <h1 className="font-display text-3xl font-bold">Tracking CAPI</h1>
        <p className="text-muted-foreground">Rastreamento avançado Meta Conversions API — dados reais do comprador</p>
      </div>

      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        {[
          {
            label: "Status Pixel",
            content: pixelConfigured ? (
              <div className="flex items-center justify-center gap-1 mt-1">
                <CheckCircle className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-primary">Configurado</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-1 mt-1">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <span className="text-sm font-medium text-destructive">Não configurado</span>
              </div>
            ),
          },
          { label: "Eventos Enviados", content: <p className="text-2xl font-bold font-mono text-primary">{sentCount}</p> },
          { label: "Erros", content: <p className={`text-2xl font-bold font-mono ${errorCount > 0 ? "text-destructive" : "text-foreground"}`}>{errorCount}</p> },
          { label: "Último Envio", content: <p className="text-sm font-mono text-muted-foreground mt-1">{lastEvent ? new Date(lastEvent.created_at).toLocaleString("pt-MZ", { dateStyle: "short", timeStyle: "short" }) : "—"}</p> },
        ].map((card, i) => (
          <Card key={i} className="glass-card border-border animate-fade-in" style={{ animationDelay: `${i * 80}ms`, animationFillMode: "both" }}>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">{card.label}</p>
              {card.content}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border overflow-hidden animate-fade-in" style={{ animationDelay: "200ms", animationFillMode: "both" }}>
        <CardHeader className="bg-black/80 border-b border-border py-3">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-primary" />
            <CardTitle className="font-mono text-sm text-primary">Logs do CAPI (AO VIVO)</CardTitle>
            <div className="ml-auto flex items-center gap-1.5">
              <div className={`h-2 w-2 rounded-full ${pixelConfigured ? "bg-primary animate-pulse" : "bg-destructive"}`} />
              <span className="text-xs font-mono text-muted-foreground">{pixelConfigured ? "Prontidão [OK]" : "Pixel não configurado"}</span>
            </div>
          </div>
        </CardHeader>
        <div ref={terminalRef} className="bg-black p-4 font-mono text-xs max-h-[260px] overflow-y-auto space-y-1">
          {liveLines.length === 0 && <p className="text-muted-foreground/50">{"// Aguardando os primeiros eventos Server-Side..."}</p>}
          {liveLines.map((line, i) => (
            <div key={i} className="animate-fade-in">
              <span className="text-muted-foreground">[{line.time}]</span>{" "}
              {line.ok ? <span className="text-primary">✓ {line.text}</span> : <span className="text-destructive">✗ {line.text}</span>}
            </div>
          ))}
        </div>
      </Card>

      <Card className="glass-card border-border animate-fade-in" style={{ animationDelay: "300ms", animationFillMode: "both" }}>
        <CardHeader>
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Radar className="h-5 w-5 text-primary" />
            Configuração Meta CAPI
            <Badge variant="outline" className="ml-auto border-primary/30 text-primary"><Lock className="h-3 w-3 mr-1" />Vault criptografado</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasSavedConfig && !editing ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-lg bg-secondary/30 p-3">
                <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Pixel ID</p>
                  <p className="text-sm font-mono text-foreground">{savedPixel || "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-secondary/30 p-3">
                <Lock className="h-5 w-5 text-primary flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Access Token (vault)</p>
                  <p className="text-sm font-mono text-foreground">{tokenInfo.masked || "—"}</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button variant="outline" onClick={() => setEditing(true)} className="border-border flex-1">
                  <Pencil className="mr-2 h-4 w-4" />Editar Configuração
                </Button>
                <Button variant="outline" onClick={sendTestEvent} disabled={testSending} className="border-border flex-1">
                  <Send className="mr-2 h-4 w-4" />{testSending ? "Enviando..." : "Enviar Evento Teste"}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Pixel ID</Label>
                <Input value={pixelId} onChange={e => setPixelId(e.target.value)} placeholder="123456789012345" />
              </div>
              <div className="space-y-2">
                <Label>Access Token (CAPI) — armazenado criptografado, nunca lido pelo navegador</Label>
                <Input value={accessToken} onChange={e => setAccessToken(e.target.value)} placeholder={tokenInfo.exists ? "Deixe em branco para manter o atual" : "EAAxxxxxxx"} type="password" autoComplete="off" />
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button onClick={handleSave} className="gradient-primary text-primary-foreground active:scale-95 transition-transform flex-1" disabled={saving}>
                  {saving ? "Salvando..." : "Salvar Configuração"}
                </Button>
                {hasSavedConfig && (
                  <Button variant="outline" onClick={() => { setPixelId(savedPixel); setAccessToken(""); setEditing(false); }} className="border-border">
                    Cancelar
                  </Button>
                )}
              </div>
            </>
          )}

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

      <Card className="glass-card border-border overflow-hidden animate-fade-in" style={{ animationDelay: "400ms", animationFillMode: "both" }}>
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
            <p className="text-center text-muted-foreground py-8">Nenhum evento CAPI registado. Envie um evento de teste ou aguarde vendas reais.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-2 px-2">Evento</th>
                    <th className="text-left py-2 px-2">Event ID</th>
                    <th className="text-left py-2 px-2">Status</th>
                    <th className="text-left py-2 px-2">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((ev, i) => (
                    <tr key={ev.id} className="border-b border-border/50 animate-fade-in" style={{ animationDelay: `${i * 30}ms`, animationFillMode: "both" }}>
                      <td className="py-2 px-2"><Badge variant="outline" className="border-border">{ev.event_name}</Badge></td>
                      <td className="py-2 px-2 font-mono text-xs text-muted-foreground">{ev.event_id?.slice(0, 8)}...</td>
                      <td className="py-2 px-2">
                        {ev.status === "sent" ? (
                          <div className="flex items-center gap-1"><CheckCircle className="h-4 w-4 text-primary" /><span className="text-xs text-primary">Enviado</span></div>
                        ) : (
                          <div className="flex items-center gap-1"><XCircle className="h-4 w-4 text-destructive" /><span className="text-xs text-destructive">Erro</span></div>
                        )}
                      </td>
                      <td className="py-2 px-2 text-muted-foreground">{new Date(ev.created_at).toLocaleString("pt-MZ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
