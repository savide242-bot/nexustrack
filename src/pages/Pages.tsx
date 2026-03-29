import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FileText, Plus, Copy, Check, MousePointerClick, Eye, BarChart3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Page {
  id: string;
  user_id: string;
  campaign_id: string | null;
  url: string;
  name: string;
  created_at: string;
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
  const [pageMetrics, setPageMetrics] = useState<Record<string, { visitors: number; clicks: number; topCtas: any[] }>>({});

  useEffect(() => {
    if (!user) return;
    fetchPages();
  }, [user]);

  const fetchPages = async () => {
    const { data } = await supabase.from("pages").select("*").order("created_at", { ascending: false });
    if (data) {
      setPages(data as Page[]);
      for (const page of data) {
        const leadsRes = await (supabase.from("leads_clicks") as any).select("*", { count: "exact", head: true }).eq("page_id", page.id);
        const ctaRes = await (supabase.from("cta_clicks") as any).select("button_id, button_text").eq("page_id", page.id);
        const visitors = leadsRes.count;
        const clicks = ctaRes.data;

        const ctaMap: Record<string, { text: string; count: number }> = {};
        (clicks || []).forEach((c: any) => {
          const key = c.button_id || c.button_text || "unknown";
          if (!ctaMap[key]) ctaMap[key] = { text: c.button_text || key, count: 0 };
          ctaMap[key].count++;
        });
        const topCtas = Object.values(ctaMap).sort((a, b) => b.count - a.count).slice(0, 5);

        setPageMetrics(prev => ({
          ...prev,
          [page.id]: { visitors: visitors || 0, clicks: (clicks || []).length, topCtas }
        }));
      }
    }
  };

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
          <p className="text-muted-foreground">Adicione suas páginas de vendas e obtenha scripts de rastreamento</p>
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
            const metrics = pageMetrics[page.id] || { visitors: 0, clicks: 0, topCtas: [] };
            return (
              <Card key={page.id} className="glass-card border-border">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="font-display text-lg">{page.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{page.url}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => copyScript(page)} className="border-border">
                      {copied === page.id ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                      {copied === page.id ? "Copiado!" : "Copiar Script"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-3 mb-4">
                    <div className="flex items-center gap-3 rounded-lg bg-secondary/50 p-3">
                      <Eye className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-xs text-muted-foreground">Visitantes</p>
                        <p className="font-display text-lg font-bold">{metrics.visitors}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-lg bg-secondary/50 p-3">
                      <MousePointerClick className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-xs text-muted-foreground">Cliques CTA</p>
                        <p className="font-display text-lg font-bold">{metrics.clicks}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-lg bg-secondary/50 p-3">
                      <BarChart3 className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-xs text-muted-foreground">Taxa Conversão</p>
                        <p className="font-display text-lg font-bold">
                          {metrics.visitors > 0 ? ((metrics.clicks / metrics.visitors) * 100).toFixed(1) : "0"}%
                        </p>
                      </div>
                    </div>
                  </div>
                  {metrics.topCtas.length > 0 && (
                    <div>
                      <p className="mb-2 text-sm font-medium text-muted-foreground">CTAs mais clicados</p>
                      <Table>
                        <TableHeader>
                          <TableRow className="border-border hover:bg-transparent">
                            <TableHead>Botão</TableHead>
                            <TableHead>Cliques</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {metrics.topCtas.map((cta, i) => (
                            <TableRow key={i} className="border-border">
                              <TableCell className="text-sm">{cta.text}</TableCell>
                              <TableCell><Badge variant="outline" className="border-border">{cta.count}</Badge></TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
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
