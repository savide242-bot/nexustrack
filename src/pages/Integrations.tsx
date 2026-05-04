import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Globe, Copy, Check, CheckCircle, Pencil, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PlatformConfig {
  key: string;
  name: string;
  description: string;
  fields: { label: string; vaultKind: string; placeholder: string }[];
}

const platforms: PlatformConfig[] = [
  {
    key: "hotmart",
    name: "Hotmart",
    description: "Receba webhooks de vendas automaticamente",
    fields: [{ label: "Hotmart Token (hottok)", vaultKind: "hotmart_token", placeholder: "HOT-XXXXXX" }],
  },
  { key: "kiwify", name: "Kiwify", description: "Integração com Kiwify (em breve)", fields: [] },
  { key: "perfectpay", name: "Perfect Pay", description: "Integração com Perfect Pay (em breve)", fields: [] },
  { key: "eduzz", name: "Eduzz", description: "Integração com Eduzz (em breve)", fields: [] },
];

export default function Integrations() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tokenInfo, setTokenInfo] = useState<Record<string, { exists: boolean; masked?: string }>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const webhookUrl = `https://${projectId}.supabase.co/functions/v1/hotmart-webhook`;

  const loadVault = async () => {
    if (!user) return;
    const map: Record<string, { exists: boolean; masked?: string }> = {};
    for (const p of platforms) {
      for (const f of p.fields) {
        const { data } = await supabase.functions.invoke("secrets-vault", { body: { action: "preview", kind: f.vaultKind } });
        map[f.vaultKind] = { exists: !!(data as any)?.exists, masked: (data as any)?.masked };
      }
    }
    setTokenInfo(map);
    setLoaded(true);
  };

  useEffect(() => { loadVault(); /* eslint-disable-next-line */ }, [user]);

  const hasSavedData = Object.values(tokenInfo).some(t => t.exists);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      for (const p of platforms) {
        for (const f of p.fields) {
          const v = (values[f.vaultKind] || "").trim();
          if (v) {
            const { error } = await supabase.functions.invoke("secrets-vault", { body: { action: "set", kind: f.vaultKind, value: v } });
            if (error) throw error;
          }
        }
      }
      toast({ title: "Configuração salva no vault criptografado!" });
      setValues({});
      setEditing(false);
      await loadVault();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    toast({ title: "URL copiado!" });
    setTimeout(() => setCopiedWebhook(false), 3000);
  };

  if (!loaded) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Integrações</h1>
        <p className="text-muted-foreground">Configure tokens e APIs das plataformas — armazenamento em vault criptografado</p>
      </div>

      <Card className="glass-card border-border neon-border">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground mb-1">🔗 URL do Webhook (cadastre na plataforma)</p>
              <code className="text-xs text-primary break-all">{webhookUrl}</code>
            </div>
            <Button variant="outline" size="sm" onClick={copyWebhook} className="border-border shrink-0">
              {copiedWebhook ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="hotmart">
        <TabsList className="bg-secondary">
          {platforms.map(p => (
            <TabsTrigger key={p.key} value={p.key}>{p.name}</TabsTrigger>
          ))}
        </TabsList>

        {platforms.map(p => (
          <TabsContent key={p.key} value={p.key}>
            <Card className="glass-card border-border">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Globe className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="font-display text-lg">{p.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{p.description}</p>
                  </div>
                  {p.fields.length === 0 && <Badge variant="outline" className="border-border ml-auto">Em breve</Badge>}
                  {p.fields.length > 0 && <Badge variant="outline" className="ml-auto border-primary/30 text-primary"><Lock className="h-3 w-3 mr-1" />Vault</Badge>}
                </div>
              </CardHeader>
              {p.fields.length > 0 && (
                <CardContent className="space-y-4">
                  {hasSavedData && !editing ? (
                    <div className="space-y-3">
                      {p.fields.map(f => {
                        const t = tokenInfo[f.vaultKind];
                        return (
                          <div key={f.vaultKind} className="flex items-center gap-3 rounded-lg bg-secondary/30 p-3">
                            {t?.exists ? <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" /> : <Lock className="h-5 w-5 text-muted-foreground flex-shrink-0" />}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-muted-foreground">{f.label}</p>
                              <p className="text-sm font-mono text-foreground">{t?.masked || "Não configurado"}</p>
                            </div>
                          </div>
                        );
                      })}
                      <Button variant="outline" onClick={() => setEditing(true)} className="border-border w-full">
                        <Pencil className="mr-2 h-4 w-4" />
                        Editar Configuração
                      </Button>
                    </div>
                  ) : (
                    <>
                      {p.fields.map(f => (
                        <div key={f.vaultKind} className="space-y-2">
                          <Label>{f.label}</Label>
                          <Input
                            type="password"
                            autoComplete="off"
                            value={values[f.vaultKind] || ""}
                            onChange={e => setValues({ ...values, [f.vaultKind]: e.target.value })}
                            placeholder={tokenInfo[f.vaultKind]?.exists ? "Deixe em branco para manter o atual" : f.placeholder}
                          />
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <Button onClick={handleSave} className="flex-1 gradient-primary text-primary-foreground" disabled={saving}>
                          {saving ? "Salvando..." : "Salvar no Vault"}
                        </Button>
                        {hasSavedData && (
                          <Button variant="outline" onClick={() => { setValues({}); setEditing(false); }} className="border-border">
                            Cancelar
                          </Button>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              )}
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
