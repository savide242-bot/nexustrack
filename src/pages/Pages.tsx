import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboard } from "@/contexts/DashboardContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  FileText, Plus, Copy, Check, MousePointerClick, Eye, BarChart3,
  Globe, TrendingUp, Link, ShoppingCart, MapPin, Trash2, Layers,
  Instagram, Sparkles, Camera, MessageCircle, Film
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DateFilter, getDefaultRange, type DateRange } from "@/components/DateFilter";

interface Page {
  id: string;
  user_id: string;
  campaign_id: string | null;
  operation_id?: string | null;
  url: string;
  name: string;
  created_at: string;
}

interface PageMetrics {
  visitors: number;
  clicks: number;
  sales: number;
  topCtas: { text: string; count: number }[];
  utmSources: { source: string; count: number }[];
  countries: { country: string; city: string; count: number }[];
  conversionRate: number;
}

export default function Pages() {
  const { user } = useAuth();
  const { current } = useDashboard();
  const { toast } = useToast();
  const [pages, setPages] = useState<Page[]>([]);
  const [open, setOpen] = useState(false);
  const [socialModalOpen, setSocialModalOpen] = useState(false);
  const [selectedSocialPage, setSelectedSocialPage] = useState<Page | null>(null);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [socialCopied, setSocialCopied] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pageMetrics, setPageMetrics] = useState<Record<string, PageMetrics>>({});
  const [dataLoading, setDataLoading] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultRange);
  const [unassignedCount, setUnassignedCount] = useState(0);

  // Contas para o gerador de links da mesma página
  const [account1, setAccount1] = useState("conta1");
  const [account2, setAccount2] = useState("conta2");

  const fetchPages = useCallback(async () => {
    if (!user) return;
    setDataLoading(true);
    const from = dateRange.from.toISOString();
    const to = dateRange.to.toISOString();

    // Filtra páginas exclusivamente da dashboard/operação selecionada
    let query = supabase.from("pages").select("*").eq("user_id", user.id);
    if (current?.id) {
      query = query.eq("operation_id", current.id);
    }

    const { data: pagesData } = await query.order("created_at", { ascending: false });
    const currentPages = (pagesData || []) as Page[];
    setPages(currentPages);

    // Checar se há páginas legadas sem operation_id atribuído
    if (current?.id) {
      const { count } = await supabase
        .from("pages")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("operation_id", null);
      setUnassignedCount(count || 0);
    } else {
      setUnassignedCount(0);
    }

    const pageIds = currentPages.map(p => p.id);
    if (pageIds.length === 0) { setDataLoading(false); return; }

    const [leadsRes, ctaRes, salesRes] = await Promise.all([
      supabase.from("leads_clicks").select("id, page_id, utm_source, country, city").in("page_id", pageIds).gte("created_at", from).lte("created_at", to),
      supabase.from("cta_clicks").select("page_id, button_id, button_text").in("page_id", pageIds).gte("created_at", from).lte("created_at", to),
      supabase.from("sales").select("lead_id, amount_mzn"),
    ]);

    const leads = leadsRes.data || [];
    const ctas = ctaRes.data || [];
    const allSales = salesRes.data || [];

    const leadToPage: Record<string, string> = {};
    leads.forEach((l: any) => { if (l.id && l.page_id) leadToPage[l.id] = l.page_id; });

    const metrics: Record<string, PageMetrics> = {};
    for (const page of currentPages) {
      const pageLeads = leads.filter(l => l.page_id === page.id);
      const pageCtas = ctas.filter(c => c.page_id === page.id);
      const pageSales = allSales.filter((s: any) => s.lead_id && leadToPage[s.lead_id] === page.id);

      const ctaMap: Record<string, { text: string; count: number }> = {};
      pageCtas.forEach((c: any) => {
        const text = c.button_text || c.button_id || "Botão";
        const key = c.button_id || text;
        if (!ctaMap[key]) ctaMap[key] = { text, count: 0 };
        ctaMap[key].count++;
      });
      const topCtas = Object.values(ctaMap).sort((a, b) => b.count - a.count).slice(0, 5);

      const srcMap: Record<string, number> = {};
      pageLeads.forEach((l: any) => {
        const src = l.utm_source || "Direto";
        srcMap[src] = (srcMap[src] || 0) + 1;
      });
      const utmSources = Object.entries(srcMap).map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count).slice(0, 5);

      const locMap: Record<string, { country: string; city: string; count: number }> = {};
      pageLeads.forEach((l: any) => {
        const country = l.country || "";
        const city = l.city || "";
        if (!country) return;
        const key = `${country}|${city}`;
        if (!locMap[key]) locMap[key] = { country, city, count: 0 };
        locMap[key].count++;
      });
      const countries = Object.values(locMap).sort((a, b) => b.count - a.count).slice(0, 8);

      metrics[page.id] = {
        visitors: pageLeads.length,
        clicks: pageCtas.length,
        sales: pageSales.length,
        topCtas,
        utmSources,
        countries,
        conversionRate: pageLeads.length > 0 ? (pageSales.length / pageLeads.length) * 100 : 0,
      };
    }
    setPageMetrics(metrics);
    setDataLoading(false);
  }, [user, current?.id, dateRange]);

  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name || !url) return;
    setLoading(true);
    const { error } = await supabase.from("pages").insert({
      user_id: user.id,
      operation_id: current?.id || null,
      url,
      name,
    });
    if (error) {
      toast({ title: "Erro ao criar página", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Página adicionada à operação atual!" });
      setOpen(false);
      setName("");
      setUrl("");
      fetchPages();
    }
    setLoading(false);
  };

  const handleDeletePage = async (page: Page) => {
    if (!confirm(`Tem certeza que deseja excluir a página "${page.name}"? Esta ação removerá o rastreamento dela e disparará uma notificação.`)) {
      return;
    }
    try {
      const { error } = await supabase.from("pages").delete().eq("id", page.id);
      if (error) throw error;
      toast({ title: "Página excluída com sucesso!" });
      setPages(prev => prev.filter(p => p.id !== page.id));

      // DISPARO DE PUSH NOTIFICATION AO REMOVER PÁGINA
      const title = "⚠️ Página Removida!";
      const body = `A página "${page.name}" (${page.url}) foi removida da dashboard "${current?.name || 'Geral'}".`;

      try {
        await supabase.functions.invoke("send-push", {
          body: { user_id: user.id, title, body }
        });
      } catch (_) {}

      // Disparo no navegador
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        try {
          new Notification(title, { body, icon: "/icon-192.png" });
        } catch (_) {}
      }

      // Registro no histórico de notificações
      await supabase.from("notifications_log").insert({
        user_id: user.id,
        title,
        body,
      });
    } catch (e: any) {
      toast({ title: "Erro ao excluir página", description: e.message, variant: "destructive" });
    }
  };

  const handleClaimLegacyPages = async () => {
    if (!user || !current?.id) return;
    try {
      const { error } = await supabase
        .from("pages")
        .update({ operation_id: current.id })
        .eq("user_id", user.id)
        .is("operation_id", null);
      if (error) throw error;
      toast({ title: `${unassignedCount} página(s) vinculada(s) à dashboard ${current.name}!` });
      fetchPages();
    } catch (e: any) {
      toast({ title: "Erro ao vincular", description: e.message, variant: "destructive" });
    }
  };

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

  const getScript = (page: Page) => {
    return `<script>
(function(){
  var pid="${page.id}";
  var pDash="${page.operation_id || current?.id || ""}";
  var purl=encodeURIComponent(window.location.href);
  var params=new URLSearchParams(window.location.search);
  var fp=navigator.userAgent+screen.width+screen.height+new Date().getTimezoneOffset();
  var hash=0;for(var i=0;i<fp.length;i++){hash=((hash<<5)-hash)+fp.charCodeAt(i);hash|=0;}
  var fingerprint=Math.abs(hash).toString(36);
  var ref=document.referrer||"";
  var utmSrc=params.get("utm_source")||"";
  if(!utmSrc&&ref.match(/instagram\\.com|l\\.instagram\\.com/i)){utmSrc="instagram";}
  if(!utmSrc&&ref.match(/facebook\\.com|fb\\.com|m\\.facebook/i)){utmSrc="facebook";}
  
  // Read _fbc and _fbp from cookies (Meta sets these)
  var getCk=function(n){return(document.cookie.match(new RegExp("(?:^|;\\\\s*)"+n+"=([^;]+)"))||[])[1]||"";};
  var fbcCookie=getCk("_fbc");
  var fbpCookie=getCk("_fbp");
  // If no _fbc cookie but fbclid in URL, generate a valid fbc string
  var fbclid=params.get("fbclid")||"";
  if(!fbcCookie&&fbclid){fbcCookie="fb.1."+Date.now()+"."+fbclid;}
  // If no _fbp cookie, generate one for matching
  if(!fbpCookie){fbpCookie="fb.1."+Date.now()+"."+Math.floor(Math.random()*2147483647);try{document.cookie="_fbp="+fbpCookie+";max-age=7776000;path=/;SameSite=Lax";}catch(e){}}
  // Store _fbc cookie if we generated one
  if(fbcCookie&&!getCk("_fbc")){try{document.cookie="_fbc="+fbcCookie+";max-age=7776000;path=/;SameSite=Lax";}catch(e){}}
  
  fetch("https://${projectId}.supabase.co/functions/v1/track",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      page_id:pid,
      nx_dash:pDash,
      page_url:purl,fingerprint:fingerprint,
      ip_address:"",user_agent:navigator.userAgent,
      referrer:ref,
      utm_source:utmSrc||params.get("utm_source")||"",
      utm_medium:params.get("utm_medium")||"",
      utm_campaign:params.get("utm_campaign")||"",
      utm_content:params.get("utm_content")||"",
      utm_term:params.get("utm_term")||"",
      fbc:fbcCookie,
      fbp:fbpCookie
    })
  }).then(r=>r.json()).then(function(d){
    window.__nxLeadId=d.lead_id;
    function getCtaLabel(el){
      var t=el.innerText||el.textContent||"";t=t.trim().substring(0,80);
      if(t)return t;
      if(el.title)return el.title;
      if(el.getAttribute("aria-label"))return el.getAttribute("aria-label");
      var parent=el.closest("[class*=testimon],[class*=review],[class*=slider],[class*=carousel],[class*=swiper]");
      if(parent){
        var cls=(el.className||"").toLowerCase();
        if(cls.match(/prev|left|back/))return "Previous Testimonial";
        if(cls.match(/next|right|forward/))return "Next Testimonial";
        var svg=el.querySelector("svg");
        if(svg)return "Slider Navigation";
      }
      if(el.tagName==="A"&&el.href)return "Link: "+el.href.substring(0,50);
      return el.tagName==="BUTTON"?"Botão":"Link";
    }
    document.querySelectorAll("a,button,[data-cta]").forEach(function(el){
      el.addEventListener("click",function(){
        fetch("https://${projectId}.supabase.co/functions/v1/track-cta",{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({
            page_id:pid,lead_id:window.__nxLeadId,
            button_id:el.id||el.getAttribute("data-cta")||"",button_text:getCtaLabel(el),page_url:purl
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
    toast({ title: "Script copiado com sucesso!" });
    setTimeout(() => setCopied(null), 3000);
  };

  const buildSocialUrl = (pageUrl: string, acc: string, medium: string, camp: string) => {
    try {
      const url = new URL(pageUrl.startsWith("http") ? pageUrl : `https://${pageUrl}`);
      const cleanAcc = acc.replace(/^@/, "").trim() || "conta";
      url.searchParams.set("utm_source", cleanAcc);
      url.searchParams.set("utm_medium", medium);
      url.searchParams.set("utm_campaign", camp);
      url.searchParams.set("src", `${cleanAcc}_${medium}`);
      if (current?.id) url.searchParams.set("nx_dash", current.id);
      return url.toString();
    } catch {
      return pageUrl;
    }
  };

  const copySocialLink = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setSocialCopied(id);
    toast({ title: "Link copiado para a área de transferência!" });
    setTimeout(() => setSocialCopied(null), 2500);
  };

  const openSocialLinksForPage = (page: Page) => {
    setSelectedSocialPage(page);
    setSocialModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header com identificação da Dashboard / Operação Ativa */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-fade-in">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-3xl font-bold">Páginas</h1>
            <Badge variant="outline" className="border-primary/40 text-primary text-xs flex items-center gap-1">
              <Layers className="h-3 w-3" />
              {current?.name || "Operação Geral"}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-0.5">
            Páginas exclusivas da dashboard <span className="font-semibold text-foreground">"{current?.name || "Geral"}"</span>. Rastreie visitantes, CTAs e conversões.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
          <DateFilter value={dateRange} onChange={setDateRange} />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-primary text-primary-foreground active:scale-95 transition-transform">
                <Plus className="mr-2 h-4 w-4" />Nova Página
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-card border-border">
              <DialogHeader>
                <DialogTitle className="font-display">Adicionar Página à Operação "{current?.name || "Geral"}"</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Página de Vendas Principal" required />
                </div>
                <div className="space-y-2">
                  <Label>URL Completa</Label>
                  <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://minhapagina.com" required />
                </div>
                <p className="text-xs text-muted-foreground">
                  Esta página ficará vinculada e isolada apenas nesta dashboard/operação.
                </p>
                <Button type="submit" className="w-full gradient-primary text-primary-foreground" disabled={loading}>
                  {loading ? "Adicionando..." : "Adicionar Página"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Banner se houver páginas anteriores não vinculadas */}
      {unassignedCount > 0 && (
        <div className="p-3.5 rounded-lg border border-primary/30 bg-primary/5 flex flex-wrap items-center justify-between gap-3 text-sm">
          <div>
            <p className="font-semibold text-foreground">Você possui {unassignedCount} página(s) criadas anteriormente sem dashboard definida.</p>
            <p className="text-xs text-muted-foreground">Deseja vincular essas páginas à dashboard atual "{current?.name}"?</p>
          </div>
          <Button size="sm" variant="outline" className="border-primary/50 text-primary" onClick={handleClaimLegacyPages}>
            Vincular a esta Dashboard
          </Button>
        </div>
      )}

      {pages.length === 0 ? (
        <Card className="glass-card border-border animate-fade-in">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="mb-4 h-12 w-12 text-muted-foreground/60" />
            <p className="font-medium text-foreground">Nenhuma página nesta dashboard ainda</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4 text-center max-w-sm">
              Cada dashboard possui suas próprias páginas isoladas. Clique em "Nova Página" para adicionar a página de vendas desta operação.
            </p>
            <Button size="sm" onClick={() => setOpen(true)} className="gradient-primary text-primary-foreground gap-1.5">
              <Plus className="h-4 w-4" /> Adicionar Página
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {pages.map((page, idx) => {
            const m = pageMetrics[page.id] || { visitors: 0, clicks: 0, sales: 0, topCtas: [], utmSources: [], countries: [], conversionRate: 0 };
            return (
              <Card key={page.id} className="glass-card border-border hover:shadow-[0_0_25px_hsl(150_100%_50%/0.08)] transition-all duration-300 animate-fade-in" style={{ animationDelay: `${idx * 100}ms`, animationFillMode: "both" }}>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <CardTitle className="font-display text-lg">{page.name}</CardTitle>
                        <Badge variant="secondary" className="text-[10px] font-mono">
                          {current?.name || "Operação"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground flex items-center gap-1 truncate mt-0.5">
                        <Link className="h-3 w-3 flex-shrink-0" /><span className="truncate">{page.url}</span>
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openSocialLinksForPage(page)}
                        className="border-primary/40 text-primary hover:bg-primary/10 text-xs gap-1.5"
                      >
                        <Instagram className="h-3.5 w-3.5" />
                        Gerar Links para Redes Sociais
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyScript(page)}
                        className="border-border text-xs active:scale-95 transition-transform"
                      >
                        {copied === page.id ? <Check className="mr-1.5 h-3.5 w-3.5 text-primary" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
                        {copied === page.id ? "Copiado!" : "Copiar Script"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeletePage(page)}
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 px-2.5 active:scale-95 transition-transform shrink-0"
                        title="Remover Página"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 grid-cols-2 sm:grid-cols-5">
                    {[
                      { icon: Eye, label: "Visitantes", value: m.visitors },
                      { icon: MousePointerClick, label: "Cliques CTA", value: m.clicks },
                      { icon: ShoppingCart, label: "Vendas", value: m.sales, highlight: true },
                      { icon: BarChart3, label: "Conversão", value: `${m.conversionRate.toFixed(1)}%` },
                      { icon: TrendingUp, label: "CTA Top", value: m.topCtas[0]?.text || "—", truncate: true },
                    ].map((kpi, i) => (
                      <div key={i} className="flex items-center gap-3 rounded-lg bg-secondary/50 p-3 hover:shadow-[0_0_15px_hsl(150_100%_50%/0.1)] transition-all duration-300">
                        <kpi.icon className="h-5 w-5 text-primary flex-shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">{kpi.label}</p>
                          <p className={`font-display text-lg font-bold ${kpi.truncate ? "text-sm truncate max-w-[100px]" : ""} ${kpi.highlight ? "text-primary" : ""}`}>{kpi.value}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    {m.topCtas.length > 0 && (
                      <div>
                        <p className="mb-2 text-sm font-medium text-muted-foreground flex items-center gap-1"><MousePointerClick className="h-3 w-3" /> Top CTAs</p>
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
                    {m.utmSources.length > 0 && (
                      <div>
                        <p className="mb-2 text-sm font-medium text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Origens</p>
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
                    {m.countries.length > 0 && (
                      <div>
                        <p className="mb-2 text-sm font-medium text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> Localização</p>
                        <div className="space-y-1">
                          {m.countries.map((c, i) => (
                            <div key={i} className="flex items-center justify-between rounded bg-secondary/30 px-2 py-1">
                              <span className="text-sm truncate max-w-[150px]">{c.country}{c.city ? ` — ${c.city}` : ""}</span>
                              <Badge variant="outline" className="border-border text-xs">{c.count}</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {m.visitors === 0 && m.clicks === 0 && (
                    <p className="text-center text-muted-foreground text-sm py-4">Nenhum dado ainda — cole o script na sua página para começar a rastrear</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* MODAL: GERAR LINKS DA MESMA PÁGINA PARA AS DUAS CONTAS */}
      <Dialog open={socialModalOpen} onOpenChange={setSocialModalOpen}>
        <DialogContent className="glass-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <DialogTitle className="font-display text-lg">
                Gerador de Links para Redes Sociais da Mesma Página
              </DialogTitle>
            </div>
          </DialogHeader>

          {selectedSocialPage && (
            <div className="space-y-4">
              <div className="rounded-lg bg-primary/10 border border-primary/20 p-3 text-xs text-muted-foreground leading-relaxed">
                <p className="font-semibold text-foreground mb-1">
                  💡 Como usar a MESMA página nas duas contas sem conflito:
                </p>
                Você <strong>NÃO precisa duplicar a página nem criar duas páginas diferentes</strong>! O rastreador da NexusTrack instalado nesta página já detecta automaticamente qual link foi clicado, grava a conta e o local do visitante, e repassa essa informação para o checkout na hora da compra.
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Instagram className="h-3.5 w-3.5 text-purple-400" /> Nome da Conta 1
                  </Label>
                  <Input
                    value={account1}
                    onChange={(e) => setAccount1(e.target.value)}
                    placeholder="conta1 (ex: perfil_principal)"
                    className="bg-secondary text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Instagram className="h-3.5 w-3.5 text-pink-400" /> Nome da Conta 2
                  </Label>
                  <Input
                    value={account2}
                    onChange={(e) => setAccount2(e.target.value)}
                    placeholder="conta2 (ex: perfil_reserva)"
                    className="bg-secondary text-xs font-mono"
                  />
                </div>
              </div>

              <div className="space-y-4 pt-2">
                {/* Bloco Conta 1 */}
                <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-sm text-purple-300 flex items-center gap-1.5">
                      <Instagram className="h-4 w-4" /> @{account1.replace(/^@/, "")}
                    </span>
                    <Badge variant="secondary" className="text-[10px]">Conta 1</Badge>
                  </div>
                  <div className="space-y-2 text-xs">
                    {[
                      { label: "Link na Bio", icon: Link, medium: "bio", camp: "bio_perfil" },
                      { label: "Stories", icon: Camera, medium: "stories", camp: "stories" },
                      { label: "Direct 1-a-1", icon: MessageCircle, medium: "direct", camp: "direct" },
                      { label: "Reels", icon: Film, medium: "reels", camp: "reels" },
                    ].map((item) => {
                      const finalUrl = buildSocialUrl(selectedSocialPage.url, account1, item.medium, item.camp);
                      const key = `c1_${item.medium}`;
                      return (
                        <div key={key} className="flex flex-col sm:flex-row sm:items-center justify-between bg-secondary/50 rounded-lg p-2 gap-2 border border-border/50">
                          <div className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5 font-semibold text-foreground text-xs">
                              <item.icon className="h-3.5 w-3.5 text-primary" /> {item.label}
                            </span>
                            <span className="font-mono text-[10px] text-muted-foreground break-all block mt-0.5">
                              {finalUrl}
                            </span>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="shrink-0 h-7 text-xs border-border"
                            onClick={() => copySocialLink(finalUrl, key)}
                          >
                            {socialCopied === key ? (
                              <Check className="h-3 w-3 mr-1 text-primary" />
                            ) : (
                              <Copy className="h-3 w-3 mr-1" />
                            )}
                            {socialCopied === key ? "Copiado!" : "Copiar Link"}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Bloco Conta 2 */}
                <div className="rounded-xl border border-pink-500/30 bg-pink-500/5 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-sm text-pink-300 flex items-center gap-1.5">
                      <Instagram className="h-4 w-4" /> @{account2.replace(/^@/, "")}
                    </span>
                    <Badge variant="secondary" className="text-[10px]">Conta 2</Badge>
                  </div>
                  <div className="space-y-2 text-xs">
                    {[
                      { label: "Link na Bio", icon: Link, medium: "bio", camp: "bio_perfil" },
                      { label: "Stories", icon: Camera, medium: "stories", camp: "stories" },
                      { label: "Direct 1-a-1", icon: MessageCircle, medium: "direct", camp: "direct" },
                      { label: "Reels", icon: Film, medium: "reels", camp: "reels" },
                    ].map((item) => {
                      const finalUrl = buildSocialUrl(selectedSocialPage.url, account2, item.medium, item.camp);
                      const key = `c2_${item.medium}`;
                      return (
                        <div key={key} className="flex flex-col sm:flex-row sm:items-center justify-between bg-secondary/50 rounded-lg p-2 gap-2 border border-border/50">
                          <div className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5 font-semibold text-foreground text-xs">
                              <item.icon className="h-3.5 w-3.5 text-primary" /> {item.label}
                            </span>
                            <span className="font-mono text-[10px] text-muted-foreground break-all block mt-0.5">
                              {finalUrl}
                            </span>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="shrink-0 h-7 text-xs border-border"
                            onClick={() => copySocialLink(finalUrl, key)}
                          >
                            {socialCopied === key ? (
                              <Check className="h-3 w-3 mr-1 text-primary" />
                            ) : (
                              <Copy className="h-3 w-3 mr-1" />
                            )}
                            {socialCopied === key ? "Copiado!" : "Copiar Link"}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
