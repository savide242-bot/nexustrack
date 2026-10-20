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
import {
  Link2, Plus, Copy, Check, ExternalLink, Trash2, MousePointerClick,
  Users, ShoppingBag, Instagram, Camera, MessageCircle, Film, Sparkles, Layers
} from "lucide-react";

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

  // Formulário padrão
  const [form, setForm] = useState({
    name: "",
    destination_url: "",
    utm_source: "fb",
    utm_medium: "cpc",
    utm_campaign: "{{campaign.name}}",
    utm_content: "{{ad.name}}",
    utm_term: "{{adset.name}}",
  });

  // Estado do Gerador Rápido Orgânico Multi-Contas
  const [organicBaseUrl, setOrganicBaseUrl] = useState("");
  const [account1, setAccount1] = useState("conta1");
  const [account2, setAccount2] = useState("conta2");

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

  const applyPreset = (preset: "fb" | "bio" | "stories" | "direct" | "reels", customAccount?: string) => {
    const acc = customAccount || "minhaconta";
    if (preset === "fb") {
      setForm((prev) => ({
        ...prev,
        name: prev.name || "Campanha Meta Ads",
        utm_source: "fb",
        utm_medium: "cpc",
        utm_campaign: "{{campaign.name}}",
        utm_content: "{{ad.name}}",
        utm_term: "{{adset.name}}",
      }));
    } else if (preset === "bio") {
      setForm((prev) => ({
        ...prev,
        name: prev.name || `Link na Bio - @${acc}`,
        utm_source: acc,
        utm_medium: "bio",
        utm_campaign: "perfil_bio",
        utm_content: "link_bio",
        utm_term: "organico",
      }));
    } else if (preset === "stories") {
      setForm((prev) => ({
        ...prev,
        name: prev.name || `Stories - @${acc}`,
        utm_source: acc,
        utm_medium: "stories",
        utm_campaign: "stories_oferta",
        utm_content: "story_arrasta",
        utm_term: "organico",
      }));
    } else if (preset === "direct") {
      setForm((prev) => ({
        ...prev,
        name: prev.name || `Direct 1-a-1 - @${acc}`,
        utm_source: acc,
        utm_medium: "direct",
        utm_campaign: "atendimento",
        utm_content: "mensagem_direct",
        utm_term: "organico",
      }));
    } else if (preset === "reels") {
      setForm((prev) => ({
        ...prev,
        name: prev.name || `Reels - @${acc}`,
        utm_source: acc,
        utm_medium: "reels",
        utm_campaign: "video_reels",
        utm_content: "comentario_fixado",
        utm_term: "organico",
      }));
    }
  };

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

  // Helper para gerar URL orgânica ultra curta
  const buildOrganicUrl = (accKey: "1" | "2", code?: string) => {
    const raw = organicBaseUrl.trim() || "https://minhapagina.com";
    try {
      const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
      const val = code ? `${accKey}_${code}` : accKey;
      url.searchParams.set("c", val);
      return url.toString();
    } catch {
      return raw;
    }
  };

  const copyOrganicUrl = (url: string, label: string) => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    toast({ title: `Link ${label} copiado!`, description: "Cole na bio, stories ou direct para rastrear." });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold flex items-center gap-2">
              <Link2 className="h-6 w-6 text-primary" />
              Links de Rastreamento (UTMify Engine)
            </h1>
            <Badge variant="outline" className="border-border text-xs">
              {current?.name || "Operação Geral"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Crie links com UTMs e parâmetros dinâmicos vinculados à dashboard{" "}
            <span className="font-semibold text-foreground">"{current?.name || "Geral"}"</span>.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gradient-primary text-primary-foreground gap-2">
          <Plus className="h-4 w-4" /> Criar Novo Link
        </Button>
      </div>

      {/* GERADOR RÁPIDO DE MÚLTIPLAS CONTAS ORGÂNICAS (CONTA 1 & CONTA 2) */}
      <Card className="glass-card border-border border-primary/30">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Gerador de Links Orgânicos Multi-Contas (Instagram / TikTok)
            </CardTitle>
            <Badge variant="secondary" className="text-xs">
              Identificação 100% Precisa de Contas & Locais
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Gera links com <code className="text-primary font-mono font-bold">utm_source</code> (sua conta), <code className="text-primary font-mono font-bold">utm_medium</code> (bio/stories/direct) e parâmetro <code className="text-primary font-mono font-bold">src</code> para que qualquer checkout (Hotmart, Kiwify, PerfectPay, Eduzz) separe cada centavo de faturamento por conta.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Página de Destino / Checkout</Label>
              <Input
                value={organicBaseUrl}
                onChange={(e) => setOrganicBaseUrl(e.target.value)}
                placeholder="https://minhapagina.com ou link do produto"
                className="bg-secondary text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold flex items-center gap-1">
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
              <Label className="text-xs font-semibold flex items-center gap-1">
                <Instagram className="h-3.5 w-3.5 text-pink-400" /> Nome da Conta 2
              </Label>
              <Input
                value={account2}
                onChange={(e) => setAccount2(e.target.value)}
                placeholder="conta2 (ex: perfil_secundario)"
                className="bg-secondary text-xs font-mono"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 pt-2">
            {/* Bloco Conta 1 */}
            <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-mono font-bold text-sm text-purple-300 flex items-center gap-1.5">
                    <Instagram className="h-4 w-4" /> @{account1.replace(/^@/, "")}
                  </span>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Links ultra curtos para a Conta 1</p>
                </div>
                <Badge variant="secondary" className="text-[10px]">Conta 1</Badge>
              </div>

              {/* Link Único Geral */}
              <div className="rounded-lg bg-primary/10 border border-primary/30 p-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-[10px] text-muted-foreground block">⚡ Link Geral Único (Usa em Tudo):</span>
                  <span className="font-mono text-xs font-bold text-primary truncate block">
                    {buildOrganicUrl("1")}
                  </span>
                </div>
                <Button
                  size="sm"
                  className="gradient-primary text-primary-foreground h-7 px-2.5 text-xs shrink-0"
                  onClick={() => copyOrganicUrl(buildOrganicUrl("1"), `Link Geral (@${account1})`)}
                >
                  <Copy className="h-3 w-3 mr-1" /> Copiar
                </Button>
              </div>

              <div className="space-y-1 text-xs">
                {[
                  { label: "Bio", code: "b" },
                  { label: "Stories", code: "s" },
                  { label: "Direct", code: "d" },
                ].map((item) => {
                  const url = buildOrganicUrl("1", item.code);
                  return (
                    <div key={item.code} className="flex items-center justify-between bg-secondary/40 rounded px-2 py-1 gap-2 border border-border/40">
                      <span className="text-foreground font-medium text-[11px] shrink-0">
                        {item.label}: <span className="font-mono text-primary">{url}</span>
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-5 px-1.5 text-[11px] text-muted-foreground hover:text-foreground shrink-0"
                        onClick={() => copyOrganicUrl(url, `${item.label} (@${account1})`)}
                      >
                        Copiar
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bloco Conta 2 */}
            <div className="rounded-xl border border-pink-500/30 bg-pink-500/5 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-mono font-bold text-sm text-pink-300 flex items-center gap-1.5">
                    <Instagram className="h-4 w-4" /> @{account2.replace(/^@/, "")}
                  </span>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Links ultra curtos para a Conta 2</p>
                </div>
                <Badge variant="secondary" className="text-[10px]">Conta 2</Badge>
              </div>

              {/* Link Único Geral */}
              <div className="rounded-lg bg-pink-500/10 border border-pink-500/30 p-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-[10px] text-muted-foreground block">⚡ Link Geral Único (Usa em Tudo):</span>
                  <span className="font-mono text-xs font-bold text-pink-300 truncate block">
                    {buildOrganicUrl("2")}
                  </span>
                </div>
                <Button
                  size="sm"
                  className="bg-pink-600 hover:bg-pink-500 text-white h-7 px-2.5 text-xs shrink-0"
                  onClick={() => copyOrganicUrl(buildOrganicUrl("2"), `Link Geral (@${account2})`)}
                >
                  <Copy className="h-3 w-3 mr-1" /> Copiar
                </Button>
              </div>

              <div className="space-y-1 text-xs">
                {[
                  { label: "Bio", code: "b" },
                  { label: "Stories", code: "s" },
                  { label: "Direct", code: "d" },
                ].map((item) => {
                  const url = buildOrganicUrl("2", item.code);
                  return (
                    <div key={item.code} className="flex items-center justify-between bg-secondary/40 rounded px-2 py-1 gap-2 border border-border/40">
                      <span className="text-foreground font-medium text-[11px] shrink-0">
                        {item.label}: <span className="font-mono text-pink-300">{url}</span>
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-5 px-1.5 text-[11px] text-muted-foreground hover:text-foreground shrink-0"
                        onClick={() => copyOrganicUrl(url, `${item.label} (@${account2})`)}
                      >
                        Copiar
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* LISTA DE LINKS CRIADOS */}
      <Card className="glass-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Links Salvos na Dashboard "{current?.name || "Geral"}"</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Carregando links...</p>
          ) : links.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-border rounded-xl">
              <Link2 className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="font-semibold text-foreground">Nenhum link de rastreamento criado ainda nesta dashboard</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">
                Gere seus links com parâmetros do Facebook Ads ou Orgânicos para rastrear cada centavo convertido.
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
                    <TableHead>Origem / Meio</TableHead>
                    <TableHead>Campanha</TableHead>
                    <TableHead className="text-right">Cliques</TableHead>
                    <TableHead className="text-right">Vendas</TableHead>
                    <TableHead className="text-right">Receita</TableHead>
                    <TableHead className="text-right w-24">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {links.map((link) => (
                    <TableRow key={link.id}>
                      <TableCell className="font-medium max-w-[200px]">
                        <p className="truncate text-foreground font-semibold">{link.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{link.destination_url}</p>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          <Badge variant="outline" className="text-[10px] font-mono">{link.utm_source || "Sem source"}</Badge>
                          {link.utm_medium && (
                            <Badge variant="secondary" className="text-[10px]">{link.utm_medium}</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {link.utm_campaign || "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {link.clicks.toLocaleString()}
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

      {/* Modal Criar Link Customizado */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="glass-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle>Gerador de Link UTM Profissional</DialogTitle>
          </DialogHeader>

          <div className="space-y-3.5">
            {/* Presets Rápidos */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Preencher com Modelo Rápido:</Label>
              <div className="flex flex-wrap gap-1.5">
                <Button type="button" size="sm" variant="outline" className="h-6 text-[11px] px-2" onClick={() => applyPreset("fb")}>
                  ⚡ Meta Ads
                </Button>
                <Button type="button" size="sm" variant="outline" className="h-6 text-[11px] px-2" onClick={() => applyPreset("bio", account1)}>
                  🔗 Link na Bio
                </Button>
                <Button type="button" size="sm" variant="outline" className="h-6 text-[11px] px-2" onClick={() => applyPreset("stories", account1)}>
                  📸 Stories
                </Button>
                <Button type="button" size="sm" variant="outline" className="h-6 text-[11px] px-2" onClick={() => applyPreset("direct", account1)}>
                  💬 Direct
                </Button>
                <Button type="button" size="sm" variant="outline" className="h-6 text-[11px] px-2" onClick={() => applyPreset("reels", account1)}>
                  🎬 Reels
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Nome de Identificação</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Anúncio 01 ou Bio Instagram Conta 1"
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
                <Label className="text-xs">Origem (utm_source / @conta)</Label>
                <Input
                  value={form.utm_source}
                  onChange={(e) => setForm({ ...form, utm_source: e.target.value })}
                  placeholder="fb ou conta1"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Meio (utm_medium)</Label>
                <Input
                  value={form.utm_medium}
                  onChange={(e) => setForm({ ...form, utm_medium: e.target.value })}
                  placeholder="cpc, bio, stories, direct"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Campanha (utm_campaign)</Label>
              <Input
                value={form.utm_campaign}
                onChange={(e) => setForm({ ...form, utm_campaign: e.target.value })}
                placeholder="{{campaign.name}} ou nome_campanha"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Conteúdo / Anúncio (utm_content)</Label>
                <Input
                  value={form.utm_content}
                  onChange={(e) => setForm({ ...form, utm_content: e.target.value })}
                  placeholder="{{ad.name}} ou story_01"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Termo / Conjunto (utm_term)</Label>
                <Input
                  value={form.utm_term}
                  onChange={(e) => setForm({ ...form, utm_term: e.target.value })}
                  placeholder="{{adset.name}} ou organico"
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