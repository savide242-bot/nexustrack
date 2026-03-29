import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Megaphone, TrendingUp, Globe, Save, Loader2, ChevronDown, ChevronUp, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
} from "react-simple-maps";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

interface FbCampaign {
  campaign_name: string;
  campaign_id: string;
  spend: number;
  impressions: number;
  clicks: number;
  cpc: number;
  cpm: number;
  ctr: number;
  purchases: number;
  cost_per_purchase: number;
  roas: number;
}

// Rough country center coordinates for map
const COUNTRY_COORDS: Record<string, [number, number]> = {
  "BR": [-47.9, -15.8], "US": [-98.6, 39.8], "PT": [-8.2, 39.4],
  "MZ": [35.5, -18.7], "AO": [17.9, -11.2], "GB": [-1.2, 51.5],
  "DE": [10.5, 51.2], "FR": [2.2, 46.6], "ES": [-3.7, 40.4],
  "IT": [12.6, 41.9], "CA": [-106.3, 56.1], "AU": [133.8, -25.3],
  "JP": [138.3, 36.2], "IN": [78.0, 21.0], "ZA": [25.7, -28.5],
  "MX": [-102.6, 23.6], "AR": [-63.6, -38.4], "CO": [-74.3, 4.6],
  "CL": [-71.5, -35.7], "NG": [8.7, 9.1], "KE": [37.9, -0.0],
  "EG": [30.8, 26.8], "MA": [-7.1, 31.8], "CV": [-24.0, 16.0],
};

export default function Campaigns() {
  const { user } = useAuth();
  const { toast } = useToast();

  // Meta Ads state
  const [accessToken, setAccessToken] = useState("");
  const [adAccountId, setAdAccountId] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingAds, setLoadingAds] = useState(false);
  const [campaigns, setCampaigns] = useState<FbCampaign[]>([]);
  const [metaExpanded, setMetaExpanded] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [datePreset, setDatePreset] = useState("last_7d");

  // Map state
  const [salesByCountry, setSalesByCountry] = useState<{ country: string; count: number; total: number }[]>([]);

  useEffect(() => {
    if (!user) return;
    // Load profile config
    supabase.from("profiles").select("meta_access_token, fb_ad_account_id").eq("user_id", user.id).single().then(({ data }) => {
      if (data) {
        const d = data as any;
        setAccessToken(d.meta_access_token || "");
        setAdAccountId(d.fb_ad_account_id || "");
        if (d.meta_access_token && d.fb_ad_account_id) setConfigured(true);
      }
    });

    // Load sales for map
    supabase.from("sales").select("amount_mzn, leads_clicks(country, city)").then(({ data }) => {
      if (!data) return;
      const map: Record<string, { count: number; total: number }> = {};
      data.forEach((s: any) => {
        const country = s.leads_clicks?.country || "Desconhecido";
        if (!map[country]) map[country] = { count: 0, total: 0 };
        map[country].count++;
        map[country].total += Number(s.amount_mzn || 0);
      });
      setSalesByCountry(Object.entries(map).map(([country, v]) => ({ country, ...v })));
    });
  }, [user]);

  const handleSaveConfig = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await (supabase.from("profiles") as any).update({
      meta_access_token: accessToken || null,
      fb_ad_account_id: adAccountId || null,
    }).eq("user_id", user.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Configuração Meta Ads salva!" });
      setConfigured(!!accessToken && !!adAccountId);
    }
    setSaving(false);
  };

  const fetchMetaAds = async () => {
    if (!accessToken || !adAccountId) {
      toast({ title: "Configure o Access Token e Ad Account ID primeiro", variant: "destructive" });
      return;
    }
    setLoadingAds(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/facebook-ads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: accessToken, ad_account_id: adAccountId, date_preset: datePreset }),
      });
      const data = await res.json();
      if (data.error) {
        toast({ title: "Erro Meta Ads", description: data.error, variant: "destructive" });
      } else {
        setCampaigns(data.campaigns || []);
        if ((data.campaigns || []).length === 0) {
          toast({ title: "Nenhuma campanha encontrada neste período" });
        }
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setLoadingAds(false);
  };

  const totalSpend = campaigns.reduce((a, c) => a + c.spend, 0);
  const totalPurchases = campaigns.reduce((a, c) => a + c.purchases, 0);
  const avgRoas = campaigns.length ? (campaigns.reduce((a, c) => a + c.roas, 0) / campaigns.length) : 0;

  const maxSales = Math.max(...salesByCountry.map(s => s.count), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Campanhas</h1>
        <p className="text-muted-foreground">Anúncios, métricas e mapa de vendas</p>
      </div>

      <Tabs defaultValue="anuncios">
        <TabsList className="bg-secondary">
          <TabsTrigger value="anuncios" className="gap-2">
            <Megaphone className="h-4 w-4" /> Anúncios
          </TabsTrigger>
          <TabsTrigger value="mapa" className="gap-2">
            <MapPin className="h-4 w-4" /> Mapa de Vendas
          </TabsTrigger>
        </TabsList>

        {/* === ANÚNCIOS TAB === */}
        <TabsContent value="anuncios" className="space-y-4">
          {/* Meta Ads Card */}
          <Card className="glass-card border-border">
            <CardHeader
              className="cursor-pointer"
              onClick={() => setMetaExpanded(!metaExpanded)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1877F2]">
                    <span className="text-white font-bold text-lg">f</span>
                  </div>
                  <div>
                    <CardTitle className="font-display text-lg">Meta Ads</CardTitle>
                    {configured && <Badge variant="outline" className="text-primary border-primary/30 text-xs mt-1">Conectado</Badge>}
                  </div>
                </div>
                {metaExpanded ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
              </div>
            </CardHeader>

            {metaExpanded && (
              <CardContent className="space-y-4 border-t border-border pt-4">
                <p className="text-sm text-muted-foreground">
                  Conecte a sua conta Meta Ads para importar métricas de campanhas.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Access Token (Long-lived)</Label>
                    <Input
                      type="password"
                      value={accessToken}
                      onChange={(e) => setAccessToken(e.target.value)}
                      placeholder="EAAxxxxxxx..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Ad Account ID</Label>
                    <Input
                      value={adAccountId}
                      onChange={(e) => setAdAccountId(e.target.value)}
                      placeholder="act_123456789"
                    />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button onClick={handleSaveConfig} disabled={saving} variant="outline" className="border-primary/30 text-primary">
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Salvar Configuração
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Fetch + Period selector */}
          {configured && (
            <Card className="glass-card border-border">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <select
                    value={datePreset}
                    onChange={(e) => setDatePreset(e.target.value)}
                    className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground"
                  >
                    <option value="today">Hoje</option>
                    <option value="yesterday">Ontem</option>
                    <option value="last_3d">Últimos 3 dias</option>
                    <option value="last_7d">Últimos 7 dias</option>
                    <option value="last_14d">Últimos 14 dias</option>
                    <option value="last_30d">Últimos 30 dias</option>
                    <option value="this_month">Este mês</option>
                    <option value="last_month">Mês passado</option>
                  </select>
                  <Button onClick={fetchMetaAds} disabled={loadingAds} className="gradient-primary text-primary-foreground">
                    {loadingAds ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TrendingUp className="mr-2 h-4 w-4" />}
                    Importar Dados
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Summary cards */}
          {campaigns.length > 0 && (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
              <Card className="glass-card border-border">
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-muted-foreground">Gasto Total</p>
                  <p className="text-2xl font-bold font-mono text-foreground">R$ {totalSpend.toFixed(2)}</p>
                </CardContent>
              </Card>
              <Card className="glass-card border-border">
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-muted-foreground">Compras</p>
                  <p className="text-2xl font-bold font-mono text-primary">{totalPurchases}</p>
                </CardContent>
              </Card>
              <Card className="glass-card border-border">
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-muted-foreground">ROAS Médio</p>
                  <p className="text-2xl font-bold font-mono text-foreground">{avgRoas.toFixed(2)}x</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Campaigns table */}
          {campaigns.length > 0 && (
            <Card className="glass-card border-border overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead>Campanha</TableHead>
                      <TableHead className="text-right">Gasto</TableHead>
                      <TableHead className="text-right">Impressões</TableHead>
                      <TableHead className="text-right">Cliques</TableHead>
                      <TableHead className="text-right">CTR</TableHead>
                      <TableHead className="text-right">CPC</TableHead>
                      <TableHead className="text-right">Compras</TableHead>
                      <TableHead className="text-right">CPA</TableHead>
                      <TableHead className="text-right">ROAS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaigns.map((c) => (
                      <TableRow key={c.campaign_id} className="border-border">
                        <TableCell className="font-medium max-w-[200px] truncate">{c.campaign_name}</TableCell>
                        <TableCell className="text-right font-mono text-sm">R$ {c.spend.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{c.impressions.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{c.clicks.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{c.ctr.toFixed(2)}%</TableCell>
                        <TableCell className="text-right font-mono text-sm">R$ {c.cpc.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono text-sm text-primary">{c.purchases}</TableCell>
                        <TableCell className="text-right font-mono text-sm">R$ {c.cost_per_purchase.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono text-sm font-bold">{c.roas.toFixed(2)}x</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}

          {!configured && !metaExpanded && (
            <Card className="glass-card border-border">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Megaphone className="mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground">Clique em Meta Ads acima para configurar a integração</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* === MAPA DE VENDAS TAB === */}
        <TabsContent value="mapa" className="space-y-4">
          <Card className="glass-card border-border">
            <CardHeader>
              <CardTitle className="font-display">Mapa de Vendas</CardTitle>
              <p className="text-sm text-muted-foreground">Distribuição geográfica das suas vendas</p>
            </CardHeader>
            <CardContent>
              {salesByCountry.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Globe className="mb-4 h-12 w-12 text-muted-foreground" />
                  <p className="text-muted-foreground">Nenhuma venda com dados de localização</p>
                </div>
              ) : (
                <div className="w-full">
                  <ComposableMap
                    projectionConfig={{ scale: 147 }}
                    style={{ width: "100%", height: "auto" }}
                  >
                    <Geographies geography={GEO_URL}>
                      {({ geographies }) =>
                        geographies.map((geo) => (
                          <Geography
                            key={geo.rsSVGPath || geo.id}
                            geography={geo}
                            fill="hsl(0 0% 18%)"
                            stroke="hsl(0 0% 25%)"
                            strokeWidth={0.5}
                            style={{
                              hover: { fill: "hsl(0 0% 22%)" },
                            }}
                          />
                        ))
                      }
                    </Geographies>
                    {salesByCountry.map((s) => {
                      const coords = COUNTRY_COORDS[s.country];
                      if (!coords) return null;
                      const size = 4 + (s.count / maxSales) * 16;
                      return (
                        <Marker key={s.country} coordinates={coords}>
                          <circle
                            r={size}
                            fill="hsl(150 100% 50%)"
                            fillOpacity={0.5}
                            stroke="hsl(150 100% 50%)"
                            strokeWidth={1}
                          />
                          <circle r={3} fill="hsl(150 100% 50%)" />
                        </Marker>
                      );
                    })}
                  </ComposableMap>

                  {/* Country list */}
                  <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {salesByCountry
                      .sort((a, b) => b.count - a.count)
                      .map((s) => (
                        <div key={s.country} className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2">
                          <span className="text-sm font-medium">{s.country}</span>
                          <div className="text-right">
                            <span className="text-sm font-mono text-primary">{s.count} vendas</span>
                            <span className="text-xs text-muted-foreground ml-2">{s.total.toLocaleString("pt-MZ")} MT</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
