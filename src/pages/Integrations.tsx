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
  fields: { label: string; dbField: string; placeholder: string }[];
}

const platforms: PlatformConfig[] = [
  {
    key: "hotmart",
    name: "Hotmart",
    description: "Receba webhooks de vendas automaticamente",
    fields: [{ label: "Hotmart Token (hottok)", dbField: "hotmart_token", placeholder: "HOT-XXXXXX" }],
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
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const webhookUrl = `https://${projectId}.supabase.co/functions/v1/hotmart-webhook`;

  useEffect(() => {
    if (!user) return;
    supabase.from("campaigns").select("*").order("created_at", { ascending: false }).then(({ data }) => {
      if (data && data.length > 0) {
        setCampaigns(data);
        setSelectedCampaign(data[0].id);
        setValues({
          hotmart_token: data[0].hotmart_token || "",
          meta_pixel_id: data[0].meta_pixel_id || "",
          meta_access_token: data[0].meta_access_token || "",
          google_ads_id: data[0].google_ads_id || "",
          tiktok_pixel_id: data[0].tiktok_pixel_id || "",
          tiktok_access_token: data[0].tiktok_access_token || "",
        });
      }
    });
  }, [user]);

  useEffect(() => {
    const camp = campaigns.find(c => c.id === selectedCampaign);
    if (camp) {
      setValues({
        hotmart_token: camp.hotmart_token || "",
        meta_pixel_id: camp.meta_pixel_id || "",
        meta_access_token: camp.meta_access_token || "",
        google_ads_id: camp.google_ads_id || "",
        tiktok_pixel_id: camp.tiktok_pixel_id || "",
        tiktok_access_token: camp.tiktok_access_token || "",
      });
    }
  }, [selectedCampaign, campaigns]);

  const handleSave = async () => {
    if (!selectedCampaign) return;
    setSaving(true);
    const { error } = await supabase.from("campaigns").update({
      hotmart_token: values.hotmart_token || null,
      meta_pixel_id: values.meta_pixel_id || null,
      meta_access_token: values.meta_access_token || null,
      google_ads_id: values.google_ads_id || null,
      tiktok_pixel_id: values.tiktok_pixel_id || null,
      tiktok_access_token: values.tiktok_access_token || null,
    }).eq("id", selectedCampaign);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Configuração salva!" });
      // Refresh
      const { data } = await supabase.from("campaigns").select("*").order("created_at", { ascending: false });
      if (data) setCampaigns(data);
    }
    setSaving(false);
  };

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    toast({ title: "URL copiado!" });
    setTimeout(() => setCopiedWebhook(false), 3000);
  };

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

      {/* Campaign selector */}
      {campaigns.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {campaigns.map(c => (
            <Button
              key={c.id}
              variant={selectedCampaign === c.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCampaign(c.id)}
              className={selectedCampaign === c.id ? "gradient-primary text-primary-foreground" : "border-border"}
            >
              {c.name}
            </Button>
          ))}
        </div>
      )}

      {campaigns.length === 0 ? (
        <Card className="glass-card border-border">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Plug className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">Crie uma campanha primeiro para configurar integrações</p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="hotmart">
          <TabsList className="bg-secondary">
            {platforms.map(p => (
              <TabsTrigger key={p.key} value={p.key}>{p.name}</TabsTrigger>
            ))}
            <TabsTrigger value="meta">Meta Pixel</TabsTrigger>
            <TabsTrigger value="google">Google Ads</TabsTrigger>
            <TabsTrigger value="tiktok">TikTok</TabsTrigger>
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
                      <div key={f.dbField} className="space-y-2">
                        <Label>{f.label}</Label>
                        <Input
                          value={values[f.dbField] || ""}
                          onChange={e => setValues({ ...values, [f.dbField]: e.target.value })}
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

          <TabsContent value="meta">
            <Card className="glass-card border-border">
              <CardHeader>
                <CardTitle className="font-display text-lg">Meta (Facebook) Pixel</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Pixel ID</Label>
                  <Input value={values.meta_pixel_id || ""} onChange={e => setValues({ ...values, meta_pixel_id: e.target.value })} placeholder="123456789" />
                </div>
                <div className="space-y-2">
                  <Label>Access Token</Label>
                  <Input value={values.meta_access_token || ""} onChange={e => setValues({ ...values, meta_access_token: e.target.value })} placeholder="EAAxxxxxxx" type="password" />
                </div>
                <Button onClick={handleSave} className="w-full gradient-primary text-primary-foreground" disabled={saving}>
                  {saving ? "Salvando..." : "Salvar Configuração"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="google">
            <Card className="glass-card border-border">
              <CardHeader><CardTitle className="font-display text-lg">Google Ads</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Google Ads ID</Label>
                  <Input value={values.google_ads_id || ""} onChange={e => setValues({ ...values, google_ads_id: e.target.value })} placeholder="AW-XXXXXXXXX" />
                </div>
                <Button onClick={handleSave} className="w-full gradient-primary text-primary-foreground" disabled={saving}>
                  {saving ? "Salvando..." : "Salvar Configuração"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tiktok">
            <Card className="glass-card border-border">
              <CardHeader><CardTitle className="font-display text-lg">TikTok Pixel</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Pixel ID</Label>
                  <Input value={values.tiktok_pixel_id || ""} onChange={e => setValues({ ...values, tiktok_pixel_id: e.target.value })} placeholder="XXXXXXXXXXXXX" />
                </div>
                <div className="space-y-2">
                  <Label>Access Token</Label>
                  <Input value={values.tiktok_access_token || ""} onChange={e => setValues({ ...values, tiktok_access_token: e.target.value })} placeholder="Token TikTok" type="password" />
                </div>
                <Button onClick={handleSave} className="w-full gradient-primary text-primary-foreground" disabled={saving}>
                  {saving ? "Salvando..." : "Salvar Configuração"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
