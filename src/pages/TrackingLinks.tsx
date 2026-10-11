import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboard } from "@/contexts/DashboardContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Link2, Plus, Copy, Check, ExternalLink, Trash2, MousePointerClick, Users, ShoppingBag } from "lucide-react";

interface TrackingLink {
  id: string;
  name: string;
  destination_url: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  clicks: number;
  leads: number;
  sales: number;
  revenue: number;
  is_active: boolean;
  created_at: string;
}

export default function TrackingLinks() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { current, fmt } = useDashboard();

  const [links, setLinks] = useState<TrackingLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    destination_url: "",
    utm_source: "fb",
    utm_medium: "cpc",
    utm_campaign: "{{campaign.name}}",
    utm_content: "{{ad.name}}",
    utm_term: "{{adset.name}}",
  });

  const loadLinks = async () => {
    if (!user || !current) return;
    setLoading(true);
    const { data } = await supabase
      .from("tracking_links")
      .select("*")
      .eq("dashboard_id", current.id)
      .order("created_at", { ascending: false });
    setLinks((data || []) as TrackingLink[]);
    setLoading(false);
  };

  useEffect(() => {
    loadLinks();
  }, [current, user]);

  const generatedUrl = useMemo(() => {
    if (!form.destination_url.trim()) return "";
    try {
      const url = new URL(
        form.destination_url.startsWith("http") ? form.destination_url : `https://${form.destination_url}`
      );
      if (form.utm_source) url.searchParams.set("utm_source", form.utm_source);
      if (form.utm_medium) url.searchParams.set("utm_medium", form.utm_medium);
      if (form.utm_campaign) url.searchParams.set("utm_campaign", form.utm_campaign);
      if (form.utm_content) url.searchParams.set("utm_content", form.utm_content);
      if (form.utm_term) url.searchParams.set("utm_term", form.utm_term);
      if (current?.id) url.searchParams.set("nx_dash", current.id);
      return url.toString();
    } catch {
      return "";
    }
  }, [form, current]);

  const handleSave = async () => {
    if (!user || !current || !form.name.trim() || !form.destination_url.trim()) {
      toast({ title: "Preencha o nome e a URL de destino", variant: "destructive" });
      return;
    }

    const { error } = await supabase.from("tracking_links").insert({
      dashboard_id: current.id,
      user_id: user.id,
      name: form.name.trim(),
      destination_url: form.destination_url.trim(),
      utm_source: form.utm_source || null,
      utm_medium: form.utm_medium || null,
      utm_campaign: form.utm_campaign || null,
      utm_content: form.utm_content || null,
      utm_term: form.utm_term || null,
    });

    if (error) {
      toast({ title: "Erro ao criar link", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Link de rastreamento criado com sucesso!" });
    setDialogOpen(false);
    loadLinks();
  };

  const copyLink = (link: TrackingLink) => {
    try {
      const url = new URL(
        link.destination_url.startsWith("http") ? link.destination_url : `https://${link.destination_url}`
      );
      if (link.utm_source) url.searchParams.set("utm_source", link.utm_source);
      if (link.utm_medium) url.searchParams.set("utm_medium", link.utm_medium);
      if (link.utm_campaign) url.searchParams.set("utm_campaign", link.utm_campaign);
      if (link.utm_content) url.searchParams.set("utm_content", link.utm_content);
      if (link.utm_term) url.searchParams.set("utm_term", link.utm_term);
      if (current?.id) url.searchParams.set("nx_dash", current.id);

      navigator.clipboard.writeText(url.toString());
      setCopiedId(link.id);
      setTimeout(() => setCopiedId(null), 2000);
      toast({ title: "Link copiado para a área de transferência!" });
    } catch {
      toast({ title: "Erro ao copiar URL", variant: "destructive" });
    }
  };

  const deleteLink = async (id: string) => {
    if (!confirm("Excluir este link de rastreamento?")) return;
    await supabase.from("tracking_links").delete().eq("id", id);
    toast({ title: "Link removido" });
    loadLinks();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Link2 className="h-6 w-6 text-primary" />
            Links de Rastreamento (UTMify)
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Crie links com UTMs e parâmetros dinâmicos vinculados à dashboard{" "}
            <span className="font-semibold text-foreground">"{current?.name || "Geral"}"</span>.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gradient-primary text-primary-foreground gap-2">
          <Plus className="h-4 w-4" /> Criar Novo Link
        </Button>
      </div>

      <Card className="glass-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Links Criados</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Carregando links...</p>
          ) : links.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-border rounded-xl">
              <Link2 className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="font-semibold text-foreground">Nenhum link de rastreamento criado ainda</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">
                Gere seus links com parâmetros do Facebook Ads para rastrear cada centavo convertido.
              </p>
              <Button size="sm" onClick={() => setDialogOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" /> Criar primeiro link
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Origem / Campanha</TableHead>
                    <TableHead className="text-right">Cliques</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                    <TableHead className="text-right">Vendas</TableHead>
                    <TableHead className="text-right">Receita</TableHead>
                    <TableHead className="text-right w-24">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {links.map((link) => (
                    <TableRow key={link.id}>
                      <TableCell className="font-medium max-w-[200px]">
                        <p className="truncate text-foreground">{link.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{link.destination_url}</p>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          <Badge variant="outline" className="text-[10px]">{link.utm_source || "Sem source"}</Badge>
                          {link.utm_campaign && (
                            <Badge variant="secondary" className="text-[10px]">{link.utm_campaign}</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {link.clicks.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {link.leads.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-bold text-primary">
                        {link.sales}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-bold">
                        {fmt(link.revenue)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => copyLink(link)}
                            title="Copiar Link"
                          >
                            {copiedId === link.id ? (
                              <Check className="h-3.5 w-3.5 text-primary" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => deleteLink(link.id)}
                            title="Excluir"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Criar Link */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="glass-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle>Gerador de Link UTM Profissional</DialogTitle>
          </DialogHeader>

          <div className="space-y-3.5">
            <div className="space-y-1">
              <Label>Nome de Identificação</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Anúncio 01 - Criativo Vídeo Mulher"
              />
            </div>

            <div className="space-y-1">
              <Label>Página de Destino (URL do Produto/Página)</Label>
              <Input
                value={form.destination_url}
                onChange={(e) => setForm({ ...form, destination_url: e.target.value })}
                placeholder="https://meuproduto.com/checkout"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Origem (utm_source)</Label>
                <Input
                  value={form.utm_source}
                  onChange={(e) => setForm({ ...form, utm_source: e.target.value })}
                  placeholder="fb"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Meio (utm_medium)</Label>
                <Input
                  value={form.utm_medium}
                  onChange={(e) => setForm({ ...form, utm_medium: e.target.value })}
                  placeholder="cpc"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <Label className="text-xs">Campanha (utm_campaign)</Label>
                <span className="text-[10px] text-muted-foreground font-mono">Dica: {"{{campaign.name}}"}</span>
              </div>
              <Input
                value={form.utm_campaign}
                onChange={(e) => setForm({ ...form, utm_campaign: e.target.value })}
                placeholder="{{campaign.name}}"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Conteúdo / Anúncio (utm_content)</Label>
                <Input
                  value={form.utm_content}
                  onChange={(e) => setForm({ ...form, utm_content: e.target.value })}
                  placeholder="{{ad.name}}"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Termo / Conjunto (utm_term)</Label>
                <Input
                  value={form.utm_term}
                  onChange={(e) => setForm({ ...form, utm_term: e.target.value })}
                  placeholder="{{adset.name}}"
                />
              </div>
            </div>

            {generatedUrl && (
              <div className="rounded-lg bg-muted/30 border border-border p-2.5 text-xs">
                <p className="text-[11px] text-muted-foreground mb-1 font-semibold">URL Gerada:</p>
                <p className="font-mono break-all text-primary">{generatedUrl}</p>
              </div>
            )}
          </div>

          <DialogFooter className="pt-2 border-t border-border">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} className="gradient-primary text-primary-foreground">
              Salvar Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}