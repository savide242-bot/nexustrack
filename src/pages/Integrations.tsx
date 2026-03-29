import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plug, Globe, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PlatformConfig {
  key: string;
  name: string;
  description: string;
  fields: { label: string; field: string; placeholder: string }[];
}

const platforms: PlatformConfig[] = [
  {
    key: "hotmart",
    name: "Hotmart",
    description: "Receba webhooks de vendas automaticamente",
    fields: [{ label: "Hotmart Token (hottok)", field: "hotmart_token", placeholder: "HOT-XXXXXX" }],
  },
  {
    key: "kiwify",
    name: "Kiwify",
    description: "Integração com Kiwify (em breve)",
    fields: [],
  },
  {
    key: "perfectpay",
    name: "Perfect Pay",
    description: "Integração com Perfect Pay (em breve)",
    fields: [],
  },
  {
    key: "eduzz",
    name: "Eduzz",
    description: "Integração com Eduzz (em breve)",
    fields: [],
  },
];

export default function Integrations() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const webhookUrl = `https://${projectId}.supabase.co/functions/v1/hotmart-webhook`;

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("hotmart_token, meta_pixel_id, meta_access_token").eq("user_id", user.id).single().then(({ data }) => {
      if (data) {
        setValues({
          hotmart_token: (data as any).hotmart_token || "",
        });
      }
      setLoaded(true);
    });
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await (supabase.from("profiles") as any).update({
      hotmart_token: values.hotmart_token || null,
    }).eq("user_id", user.id);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Configuração salva!" });
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
        <p className="text-muted-foreground">Configure tokens e APIs das plataformas</p>
      </div>

      {/* Webhook URL */}
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
                </div>
              </CardHeader>
              {p.fields.length > 0 && (
                <CardContent className="space-y-4">
                  {p.fields.map(f => (
                    <div key={f.field} className="space-y-2">
                      <Label>{f.label}</Label>
                      <Input
                        value={values[f.field] || ""}
                        onChange={e => setValues({ ...values, [f.field]: e.target.value })}
                        placeholder={f.placeholder}
                      />
                    </div>
                  ))}
                  <Button onClick={handleSave} className="w-full gradient-primary text-primary-foreground" disabled={saving}>
                    {saving ? "Salvando..." : "Salvar Configuração"}
                  </Button>
                </CardContent>
              )}
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
