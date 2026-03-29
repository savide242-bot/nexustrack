import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FileText, Plus, Copy, Check, MousePointerClick, Eye, BarChart3, Globe, TrendingUp, Link } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Page {
  id: string;
  user_id: string;
  campaign_id: string | null;
  url: string;
  name: string;
  created_at: string;
}

interface PageMetrics {
  visitors: number;
  clicks: number;
  topCtas: { text: string; count: number }[];
  utmSources: { source: string; count: number }[];
  countries: { country: string; count: number }[];
  conversionRate: number;
}

export default function Pages() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [pages, setPages] = useState<Page[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pageMetrics, setPageMetrics] = useState<Record<string, PageMetrics>>({});
  const [dataLoading, setDataLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchPages();
  }, [user]);

  const fetchPages = useCallback(async () => {
    setDataLoading(true);
    const { data: pagesData } = await supabase.from("pages").select("*").order("created_at", { ascending: false });
    if (!pagesData) { setDataLoading(false); return; }
    setPages(pagesData as Page[]);

    // Fetch all page IDs at once
    const pageIds = pagesData.map(p => p.id);
    if (pageIds.length === 0) { setDataLoading(false); return; }

    // Fetch leads and CTAs for all pages in parallel
    const [leadsRes, ctaRes] = await Promise.all([
      supabase.from("leads_clicks").select("page_id, utm_source, country").in("page_id", pageIds),
      supabase.from("cta_clicks").select("page_id, button_id, button_text").in("page_id", pageIds),
    ]);

    const leads = leadsRes.data || [];
    const ctas = ctaRes.data || [];

    const metrics: Record<string, PageMetrics> = {};
    for (const page of pagesData) {
      const pageLeads = leads.filter(l => l.page_id === page.id);
      const pageCtas = ctas.filter(c => c.page_id === page.id);

      // Top CTAs
      const ctaMap: Record<string, { text: string; count: number }> = {};
      pageCtas.forEach((c: any) => {
        const key = c.button_id || c.button_text || "unknown";
        if (!ctaMap[key]) ctaMap[key] = { text: c.button_text || key, count: 0 };
        ctaMap[key].count++;
      });
      const topCtas = Object.values(ctaMap).sort((a, b) => b.count - a.count).slice(0, 5);

      // UTM Sources
      const srcMap: Record<string, number> = {};
      pageLeads.forEach(l => {
        const src = (l as any).utm_source || "direto";
        srcMap[src] = (srcMap[src] || 0) + 1;
      });
      const utmSources = Object.entries(srcMap)
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Countries
      const countryMap: Record<string, number> = {};
      pageLeads.forEach(l => {
        const c = (l as any).country || "Desconhecido";
        if (c) countryMap[c] = (countryMap[c] || 0) + 1;
      });
      const countries = Object.entries(countryMap)
        .map(([country, count]) => ({ country, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      const visitors = pageLeads.length;
      const clicks = pageCtas.length;

      metrics[page.id] = {
        visitors,
        clicks,
        topCtas,
        utmSources,
        countries,
        conversionRate: visitors > 0 ? (clicks / visitors) * 100 : 0,
      };
    }
    setPageMetrics(metrics);
    setDataLoading(false);
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name || !url) return;
    setLoading(true);
    const { error } = await supabase.from("pages").insert({ user_id: user.id, url, name });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Página adicionada!" });
      setOpen(false);
      setName("");
      setUrl("");
      fetchPages();
    }
    setLoading(false);
  };

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

  const getScript = (page: Page) => {
    return `<script>
(function(){
  var pid="${page.id}";
  var purl=encodeURIComponent(window.location.href);
  var params=new URLSearchParams(window.location.search);
  var fp=navigator.userAgent+screen.width+screen.height+new Date().getTimezoneOffset();
  var hash=0;for(var i=0;i<fp.length;i++){hash=((hash<<5)-hash)+fp.charCodeAt(i);hash|=0;}
  var fingerprint=Math.abs(hash).toString(36);
  
  fetch("https://${projectId}.supabase.co/functions/v1/track",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      page_id:pid,page_url:purl,fingerprint:fingerprint,
      ip_address:"",user_agent:navigator.userAgent,
      referrer:document.referrer,
      utm_source:params.get("utm_source")||"",
      utm_medium:params.get("utm_medium")||"",
      utm_campaign:params.get("utm_campaign")||"",
      utm_content:params.get("utm_content")||"",
      utm_term:params.get("utm_term")||"",
      fbc:params.get("fbc")||"",
      fbp:(document.cookie.match(/_fbp=([^;]+)/)||[])[1]||""
    })
  }).then(r=>r.json()).then(function(d){
    window.__nxLeadId=d.lead_id;
    document.querySelectorAll("a,button,[data-cta]").forEach(function(el){
      el.addEventListener("click",function(){
        fetch("https://${projectId}.supabase.co/functions/v1/track-cta",{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({
            page_id:pid,lead_id:window.__nxLeadId,
            button_id:el.id||"",button_text:el.innerText||"",page_url:purl
          })
        });
      });
    });
  });
})();
</script>`;
  };

  const copyScript = (page: Page) => {
    navigator.clipboard.writeText(getScript(page));
    setCopied(page.id);
    toast({ title: "Script copiado!" });
    setTimeout(() => setCopied(null), 3000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Páginas</h1>
          <p className="text-muted-foreground">Rastreie visitantes, CTAs e conversões das suas páginas de vendas</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary text-primary-foreground"><Plus className="mr-2 h-4 w-4" />Nova Página</Button>
          </DialogTrigger>
          <DialogContent className="glass-card border-border">
            <DialogHeader><DialogTitle className="font-display">Adicionar Página</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Página de Vendas Principal" required />
              </div>
              <div className="space-y-2">
                <Label>URL</Label>
                <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://minhapagina.com" required />
              </div>
              <Button type="submit" className="w-full gradient-primary text-primary-foreground" disabled={loading}>
                {loading ? "Adicionando..." : "Adicionar Página"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {pages.length === 0 ? (
        <Card className="glass-card border-border">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">Nenhuma página adicionada ainda</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {pages.map(page => {
            const m = pageMetrics[page.id] || { visitors: 0, clicks: 0, topCtas: [], utmSources: [], countries: [], conversionRate: 0 };
            return (
              <Card key={page.id} className="glass-card border-border">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="font-display text-lg">{page.name}</CardTitle>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Link className="h-3 w-3" />{page.url}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => copyScript(page)} className="border-border">
                      {copied === page.id ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                      {copied === page.id ? "Copiado!" : "Copiar Script"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* KPI Row */}
                  <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
                    <div className="flex items-center gap-3 rounded-lg bg-secondary/50 p-3">
                      <Eye className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-xs text-muted-foreground">Visitantes</p>
                        <p className="font-display text-lg font-bold">{m.visitors}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-lg bg-secondary/50 p-3">
                      <MousePointerClick className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-xs text-muted-foreground">Cliques CTA</p>
                        <p className="font-display text-lg font-bold">{m.clicks}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-lg bg-secondary/50 p-3">
                      <BarChart3 className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-xs text-muted-foreground">Taxa Conversão</p>
                        <p className="font-display text-lg font-bold">{m.conversionRate.toFixed(1)}%</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-lg bg-secondary/50 p-3">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-xs text-muted-foreground">CTA Mais Clicado</p>
                        <p className="font-display text-sm font-bold truncate max-w-[120px]">
                          {m.topCtas[0]?.text || "—"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="grid gap-4 sm:grid-cols-3">
                    {/* Top CTAs */}
                    {m.topCtas.length > 0 && (
                      <div>
                        <p className="mb-2 text-sm font-medium text-muted-foreground flex items-center gap-1">
                          <MousePointerClick className="h-3 w-3" /> Top CTAs
                        </p>
                        <div className="space-y-1">
                          {m.topCtas.map((cta, i) => (
                            <div key={i} className="flex items-center justify-between rounded bg-secondary/30 px-2 py-1">
                              <span className="text-sm truncate max-w-[150px]">{cta.text}</span>
                              <Badge variant="outline" className="border-border text-xs">{cta.count}</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* UTM Sources */}
                    {m.utmSources.length > 0 && (
                      <div>
                        <p className="mb-2 text-sm font-medium text-muted-foreground flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" /> Origens (UTM)
                        </p>
                        <div className="space-y-1">
                          {m.utmSources.map((s, i) => (
                            <div key={i} className="flex items-center justify-between rounded bg-secondary/30 px-2 py-1">
                              <span className="text-sm truncate max-w-[150px]">{s.source}</span>
                              <Badge variant="outline" className="border-border text-xs">{s.count}</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Countries */}
                    {m.countries.length > 0 && (
                      <div>
                        <p className="mb-2 text-sm font-medium text-muted-foreground flex items-center gap-1">
                          <Globe className="h-3 w-3" /> Países
                        </p>
                        <div className="space-y-1">
                          {m.countries.map((c, i) => (
                            <div key={i} className="flex items-center justify-between rounded bg-secondary/30 px-2 py-1">
                              <span className="text-sm">{c.country}</span>
                              <Badge variant="outline" className="border-border text-xs">{c.count}</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {m.visitors === 0 && m.clicks === 0 && (
                    <p className="text-center text-muted-foreground text-sm py-4">
                      Nenhum dado ainda — cole o script na sua página para começar a rastrear
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
