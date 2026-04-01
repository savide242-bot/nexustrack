import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Megaphone, TrendingUp, Globe, Loader2, ChevronDown, ChevronUp, LogIn, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// ISO_A2 to ISO_N3 mapping for matching world-atlas topology
const COUNTRY_NAME_TO_ISO: Record<string, string> = {
  "BR": "076", "US": "840", "PT": "620", "MZ": "508", "AO": "024",
  "GB": "826", "DE": "276", "FR": "250", "ES": "724", "IT": "380",
  "CA": "124", "AU": "036", "JP": "392", "IN": "356", "ZA": "710",
  "MX": "484", "AR": "032", "CO": "170", "CL": "152", "NG": "566",
  "KE": "404", "EG": "818", "MA": "504", "CV": "132", "CN": "156",
  "RU": "643", "KR": "410", "SE": "752", "NL": "528", "BE": "056",
  "CH": "756", "AT": "040", "PL": "616", "NO": "578", "DK": "208",
  "FI": "246", "IE": "372", "NZ": "554", "SG": "702", "TH": "764",
  "PH": "608", "ID": "360", "MY": "458", "VN": "704", "TR": "792",
  "SA": "682", "AE": "784", "IL": "376", "PE": "604", "EC": "218",
  "UY": "858", "PY": "600", "BO": "068", "VE": "862", "CR": "188",
  "PA": "591", "DO": "214", "GT": "320", "HN": "340", "SV": "222",
  "NI": "558", "CU": "192", "JM": "388", "TT": "780", "GH": "288",
  "SN": "686", "CM": "120", "CI": "384", "TZ": "834", "UG": "800",
  "ET": "231", "RW": "646", "CD": "180", "ZM": "894", "ZW": "716",
  "BW": "072", "NA": "516", "MG": "450", "MW": "454",
};

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

interface AdAccount {
  id: string;
  name: string;
  account_status: number;
  currency: string;
  business_name?: string;
}

export default function Campaigns() {
  const { user } = useAuth();
  const { toast } = useToast();

  // FB SDK state
  const [fbConnected, setFbConnected] = useState(false);
  const [fbLoading, setFbLoading] = useState(false);
  const [fbAppId, setFbAppId] = useState("");
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [longLivedToken, setLongLivedToken] = useState("");

  // Ads data
  const [campaigns, setCampaigns] = useState<FbCampaign[]>([]);
  const [loadingAds, setLoadingAds] = useState(false);
  const [datePreset, setDatePreset] = useState("last_7d");
  const [adsExpanded, setAdsExpanded] = useState(true);

  // Map state
  const [salesByCountry, setSalesByCountry] = useState<Record<string, { count: number; total: number }>>({});
  const [mapPosition, setMapPosition] = useState<{ coordinates: [number, number]; zoom: number }>({ coordinates: [0, 0], zoom: 1 });
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Load FB App ID from edge function
  useEffect(() => {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    fetch(`https://${projectId}.supabase.co/functions/v1/fb-token-exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get_app_id" }),
    })
      .then(r => r.json())
      .then(d => { if (d.app_id) setFbAppId(d.app_id); })
      .catch(() => {});
  }, []);

  // Load FB SDK
  useEffect(() => {
    if (!fbAppId) return;
    if (document.getElementById("fb-jssdk")) { setSdkLoaded(true); return; }
    
    (window as any).fbAsyncInit = function () {
      (window as any).FB.init({
        appId: fbAppId,
        cookie: true,
        xfbml: false,
        version: "v21.0",
      });
      setSdkLoaded(true);
    };

    const script = document.createElement("script");
    script.id = "fb-jssdk";
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
  }, [fbAppId]);

  // Load existing config
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("meta_access_token, fb_ad_account_id").eq("user_id", user.id).single().then(({ data }) => {
      if (data) {
        const d = data as any;
        if (d.meta_access_token && d.fb_ad_account_id) {
          setFbConnected(true);
          setLongLivedToken(d.meta_access_token);
          setSelectedAccount(d.fb_ad_account_id);
        }
      }
    });
  }, [user]);

  // Load sales for map + realtime
  const loadSales = useCallback(async () => {
    const { data } = await supabase.from("sales").select("amount_mzn, status, leads_clicks(country)");
    if (!data) return;
    const map: Record<string, { count: number; total: number }> = {};
    data.forEach((s: any) => {
      if (s.status === "refunded" || Number(s.amount_mzn) <= 0) return;
      const country = s.leads_clicks?.country;
      if (!country) return;
      if (!map[country]) map[country] = { count: 0, total: 0 };
      map[country].count++;
      map[country].total += Number(s.amount_mzn || 0);
    });
    setSalesByCountry(map);
  }, []);

  useEffect(() => {
    if (!user) return;
    loadSales();

    const channel = supabase
      .channel("campaigns-sales-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "sales" }, () => {
        loadSales();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, loadSales]);

  // Facebook Login
  const handleFbLogin = () => {
    if (!sdkLoaded) {
      toast({ title: "Facebook SDK a carregar...", description: "Tenta novamente em alguns segundos" });
      return;
    }
    setFbLoading(true);

    // Fallback timeout in case popup is silently blocked
    const fallbackTimer = setTimeout(() => {
      setFbLoading(false);
    }, 30000);

    try {
      (window as any).FB.login(
        async (response: any) => {
          clearTimeout(fallbackTimer);
          if (response.status !== "connected" || !response.authResponse?.accessToken) {
            setFbLoading(false);
            toast({ title: "Login cancelado", variant: "destructive" });
            return;
          }

        try {
          const shortToken = response.authResponse.accessToken;
          const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
          const res = await fetch(`https://${projectId}.supabase.co/functions/v1/fb-token-exchange`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ short_token: shortToken, action: "exchange" }),
          });
          const data = await res.json();

          if (data.error) {
            toast({ title: "Erro Facebook", description: data.error, variant: "destructive" });
          } else {
            setLongLivedToken(data.access_token);
            setAdAccounts(data.ad_accounts || []);
            if (data.ad_accounts?.length > 0) {
              toast({ title: "Conectado ao Facebook!", description: `${data.ad_accounts.length} conta(s) de anúncio encontrada(s)` });
            } else {
              toast({ title: "Conectado, mas sem contas de anúncio encontradas", variant: "destructive" });
            }
          }
        } catch (e: any) {
          toast({ title: "Erro", description: e.message, variant: "destructive" });
        }
        setFbLoading(false);
      },
        { scope: "ads_read,ads_management,business_management" }
      );
    } catch (e: any) {
      clearTimeout(fallbackTimer);
      setFbLoading(false);
      toast({ title: "Popup bloqueado", description: "Permita popups para este site e tente novamente.", variant: "destructive" });
    }
  };

  // Save selected ad account
  const handleSelectAccount = async (accountId: string) => {
    if (!user) return;
    setSelectedAccount(accountId);

    const { error } = await (supabase.from("profiles") as any).update({
      meta_access_token: longLivedToken,
      fb_ad_account_id: accountId,
    }).eq("user_id", user.id);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      setFbConnected(true);
      toast({ title: "Conta de anúncios conectada!" });
    }
  };

  // Fetch ads
  const fetchMetaAds = async () => {
    if (!longLivedToken || !selectedAccount) {
      toast({ title: "Conecte a sua conta Facebook primeiro", variant: "destructive" });
      return;
    }
    setLoadingAds(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/facebook-ads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: longLivedToken, ad_account_id: selectedAccount, date_preset: datePreset }),
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

  const maxSales = Math.max(...Object.values(salesByCountry).map(s => s.count), 1);

  // Get fill color for a country
  const getCountryFill = (geo: any) => {
    const isoN3 = geo.id || geo.properties?.ISO_N3;
    // Find matching country code
    for (const [code, n3] of Object.entries(COUNTRY_NAME_TO_ISO)) {
      if (n3 === isoN3 && salesByCountry[code]) {
        const intensity = salesByCountry[code].count / maxSales;
        const lightness = 45 - intensity * 25; // 45% → 20%
        return `hsl(150 80% ${lightness}%)`;
      }
    }
    return "hsl(var(--muted) / 0.3)";
  };

  const getCountryTooltip = (geo: any): string | null => {
    const isoN3 = geo.id || geo.properties?.ISO_N3;
    for (const [code, n3] of Object.entries(COUNTRY_NAME_TO_ISO)) {
      if (n3 === isoN3 && salesByCountry[code]) {
        return `${code}: ${salesByCountry[code].count} vendas — ${salesByCountry[code].total.toLocaleString("pt-MZ")} MT`;
      }
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Campanhas</h1>
        <p className="text-muted-foreground">Anúncios Meta Ads e mapa global de vendas</p>
      </div>

      {/* === META ADS SECTION === */}
      <Card className="glass-card border-border">
        <CardHeader
          className="cursor-pointer"
          onClick={() => setAdsExpanded(!adsExpanded)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1877F2]">
                <span className="text-white font-bold text-lg">f</span>
              </div>
              <div>
                <CardTitle className="font-display text-lg">Meta Ads</CardTitle>
                {fbConnected && <Badge variant="outline" className="text-primary border-primary/30 text-xs mt-1">Conectado</Badge>}
              </div>
            </div>
            {adsExpanded ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
          </div>
        </CardHeader>

        {adsExpanded && (
          <CardContent className="space-y-4 border-t border-border pt-4">
            {!fbConnected && adAccounts.length === 0 && (
              <>
                <p className="text-sm text-muted-foreground">
                  Conecte a sua conta Facebook para importar automaticamente os dados das suas campanhas.
                </p>
                <Button
                  onClick={handleFbLogin}
                  disabled={fbLoading || !fbAppId}
                  className="bg-[#1877F2] hover:bg-[#166FE5] text-white"
                >
                  {fbLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
                  Conectar com Facebook
                </Button>
                {!fbAppId && (
                  <p className="text-xs text-muted-foreground">
                    Facebook App não configurado. Adicione FB_APP_ID e FB_APP_SECRET nas configurações.
                  </p>
                )}
              </>
            )}

            {/* Ad Account Selection */}
            {adAccounts.length > 0 && !fbConnected && (
              <div className="space-y-3">
                <p className="text-sm font-medium">Selecione a conta de anúncios:</p>
                <div className="grid gap-2">
                  {adAccounts.map((acc) => (
                    <Button
                      key={acc.id}
                      variant="outline"
                      className="justify-start h-auto py-3 border-border"
                      onClick={() => handleSelectAccount(acc.id)}
                    >
                      <div className="text-left">
                        <p className="font-medium">{acc.name || acc.id}</p>
                        {acc.business_name && <p className="text-xs text-muted-foreground">{acc.business_name}</p>}
                        <p className="text-xs text-muted-foreground">{acc.id} · {acc.currency}</p>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Connected: fetch data */}
            {fbConnected && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="flex items-center gap-2 text-sm text-primary">
                  <Check className="h-4 w-4" />
                  <span>Conta {selectedAccount}</span>
                </div>
                <Select value={datePreset} onValueChange={setDatePreset}>
                  <SelectTrigger className="w-[180px] bg-secondary border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Hoje</SelectItem>
                    <SelectItem value="yesterday">Ontem</SelectItem>
                    <SelectItem value="last_3d">Últimos 3 dias</SelectItem>
                    <SelectItem value="last_7d">Últimos 7 dias</SelectItem>
                    <SelectItem value="last_14d">Últimos 14 dias</SelectItem>
                    <SelectItem value="last_30d">Últimos 30 dias</SelectItem>
                    <SelectItem value="this_month">Este mês</SelectItem>
                    <SelectItem value="last_month">Mês passado</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={fetchMetaAds} disabled={loadingAds} className="gradient-primary text-primary-foreground">
                  {loadingAds ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TrendingUp className="mr-2 h-4 w-4" />}
                  Importar Dados
                </Button>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Summary cards */}
      {campaigns.length > 0 && (
        <>
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
            <Card className="glass-card border-border">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">Gasto Total</p>
                <p className="text-xl font-bold font-mono text-foreground">R$ {totalSpend.toFixed(2)}</p>
              </CardContent>
            </Card>
            <Card className="glass-card border-border">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">Compras</p>
                <p className="text-xl font-bold font-mono text-primary">{totalPurchases}</p>
              </CardContent>
            </Card>
            <Card className="glass-card border-border">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">ROAS Médio</p>
                <p className="text-xl font-bold font-mono text-foreground">{avgRoas.toFixed(2)}x</p>
              </CardContent>
            </Card>
            <Card className="glass-card border-border">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">Impressões</p>
                <p className="text-xl font-bold font-mono text-foreground">{campaigns.reduce((a, c) => a + c.impressions, 0).toLocaleString()}</p>
              </CardContent>
            </Card>
          </div>
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
            <Card className="glass-card border-border">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">Cliques</p>
                <p className="text-xl font-bold font-mono text-foreground">{campaigns.reduce((a, c) => a + c.clicks, 0).toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card className="glass-card border-border">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">CTR Médio</p>
                <p className="text-xl font-bold font-mono text-foreground">{(campaigns.reduce((a, c) => a + c.ctr, 0) / campaigns.length).toFixed(2)}%</p>
              </CardContent>
            </Card>
            <Card className="glass-card border-border">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">CPC Médio</p>
                <p className="text-xl font-bold font-mono text-foreground">R$ {(campaigns.reduce((a, c) => a + c.cpc, 0) / campaigns.length).toFixed(2)}</p>
              </CardContent>
            </Card>
            <Card className="glass-card border-border">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">CPM Médio</p>
                <p className="text-xl font-bold font-mono text-foreground">R$ {(campaigns.reduce((a, c) => a + c.cpm, 0) / campaigns.length).toFixed(2)}</p>
              </CardContent>
            </Card>
          </div>
        </>
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

      {/* === MAPA DE VENDAS (sempre visível) === */}
      <Card className="glass-card border-border">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            <CardTitle className="font-display">Mapa de Vendas</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">Países acendem quando recebem vendas — em tempo real</p>
        </CardHeader>
        <CardContent>
          <div className="w-full rounded-lg overflow-hidden bg-background/50">
            <ComposableMap
              projectionConfig={{ scale: 147 }}
              style={{ width: "100%", height: "auto" }}
            >
              <Geographies geography={GEO_URL}>
                {({ geographies }) =>
                  geographies.map((geo) => {
                    const tip = getCountryTooltip(geo);
                    return (
                      <Geography
                        key={geo.rsmKey || geo.id}
                        geography={geo}
                        fill={getCountryFill(geo)}
                        stroke="hsl(var(--border))"
                        strokeWidth={0.4}
                        style={{
                          default: { outline: "none" },
                          hover: {
                            fill: tip ? "hsl(150 90% 40%)" : "hsl(var(--muted) / 0.5)",
                            outline: "none",
                            cursor: tip ? "pointer" : "default",
                          },
                          pressed: { outline: "none" },
                        }}
                      />
                    );
                  })
                }
              </Geographies>
            </ComposableMap>
          </div>

          {/* Country breakdown */}
          {Object.keys(salesByCountry).length > 0 && (
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(salesByCountry)
                .sort((a, b) => b[1].count - a[1].count)
                .map(([country, data]) => (
                  <div key={country} className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-primary" />
                      <span className="text-sm font-medium">{country}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-mono text-primary">{data.count} vendas</span>
                      <span className="text-xs text-muted-foreground ml-2">{data.total.toLocaleString("pt-MZ")} MT</span>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {Object.keys(salesByCountry).length === 0 && (
            <p className="text-center text-muted-foreground text-sm mt-4">
              Nenhuma venda com localização — quando chegarem vendas, os países acendem automaticamente
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
