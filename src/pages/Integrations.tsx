import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plug, Facebook, Globe, Bell } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface IntegrationCardProps {
  title: string;
  description: string;
  icon: React.ElementType;
  fields: { label: string; placeholder: string; key: string }[];
}

function IntegrationCard({ title, description, icon: Icon, fields }: IntegrationCardProps) {
  const { toast } = useToast();
  const [values, setValues] = useState<Record<string, string>>({});

  const handleSave = () => {
    // In production, save to campaigns table or secrets
    toast({ title: `${title} salvo!`, description: "Configuração atualizada com sucesso." });
  };

  return (
    <Card className="glass-card border-border">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="font-display text-lg">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {fields.map((f) => (
          <div key={f.key} className="space-y-2">
            <Label>{f.label}</Label>
            <Input
              placeholder={f.placeholder}
              value={values[f.key] || ""}
              onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
            />
          </div>
        ))}
        <Button onClick={handleSave} className="w-full gradient-primary text-primary-foreground">
          Salvar Configuração
        </Button>
      </CardContent>
    </Card>
  );
}

export default function Integrations() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Integrações</h1>
        <p className="text-muted-foreground">Configure tokens e APIs das plataformas</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <IntegrationCard
          title="Hotmart"
          description="Receba webhooks de vendas automaticamente"
          icon={Globe}
          fields={[
            { label: "Hotmart Token", placeholder: "HOT-XXXXXX", key: "hotmart_token" },
          ]}
        />
        <IntegrationCard
          title="Meta (Facebook) CAPI"
          description="Envie eventos de conversão via servidor"
          icon={Facebook}
          fields={[
            { label: "Pixel ID", placeholder: "123456789", key: "meta_pixel_id" },
            { label: "Access Token", placeholder: "EAAxxxxxxx", key: "meta_access_token" },
          ]}
        />
        <IntegrationCard
          title="Google Ads"
          description="Rastreamento de conversões Google"
          icon={Globe}
          fields={[
            { label: "Google Ads ID", placeholder: "AW-XXXXXXXXX", key: "google_ads_id" },
          ]}
        />
        <IntegrationCard
          title="Push Notifications (VAPID)"
          description="Receba notificações de vendas no telemóvel"
          icon={Bell}
          fields={[
            { label: "VAPID Public Key", placeholder: "BPxxx...", key: "vapid_public" },
            { label: "VAPID Private Key", placeholder: "xxx...", key: "vapid_private" },
          ]}
        />
      </div>
    </div>
  );
}
