import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Trash2,
  Edit3,
  Copy,
  Check,
  AlertTriangle,
  Zap,
  X,
  MoreVertical,
  Layers,
  Code2,
  Info,
  CheckCircle2,
  Globe,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDashboard } from "@/contexts/DashboardContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export interface PixelConfig {
  id: string;
  name: string;
  pixel_type: "meta" | "tiktok" | "google" | "kwai";
  status: "active" | "inactive";
  product: string;
  dismiss_warning?: boolean;

  // Meta Pixels
  meta_pixel_ids: string[];
  meta_access_token?: string;
  test_event_code?: string;

  // Regra de Lead
  lead_enabled: boolean;

  // Regra de Add To Cart
  add_to_cart_enabled: boolean;

  // Regra de Initiate Checkout
  initiate_checkout_enabled: boolean;
  initiate_checkout_detection: "contains_text" | "contains_url" | "css_selector";
  initiate_checkout_texts: string[];
  initiate_checkout_auto_keywords: boolean;

  // Regra de Purchase
  purchase_config: "approved_only" | "approved_and_pending" | "all";
  purchase_value_type: "sale_value" | "fixed_value" | "no_value";
  purchase_fixed_value?: number;

  created_at: string;
  updated_at: string;
}

export function PixelManager() {
  const { current } = useDashboard();
  const { user } = useAuth();
  const { toast } = useToast();

  const storageKey = `nx_pixels_${user?.id || "anon"}_${current?.id || "global"}`;

  const [pixels, setPixels] = useState<PixelConfig[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPixel, setEditingPixel] = useState<PixelConfig | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form states
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<"meta" | "tiktok" | "google" | "kwai">("meta");
  const [formProduct, setFormProduct] = useState("Qualquer");
  const [metaPixelInput, setMetaPixelInput] = useState("");
  const [metaPixelList, setMetaPixelList] = useState<string[]>([]);
  const [metaAccessToken, setMetaAccessToken] = useState("");
  const [testEventCode, setTestEventCode] = useState("");

  const [leadEnabled, setLeadEnabled] = useState(false);
  const [addToCartEnabled, setAddToCartEnabled] = useState(false);

  const [initCheckoutEnabled, setInitCheckoutEnabled] = useState(true);
  const [initCheckoutDetection, setInitCheckoutDetection] = useState<"contains_text" | "contains_url" | "css_selector">("contains_text");
  const [initCheckoutTextInput, setInitCheckoutTextInput] = useState("");
  const [initCheckoutTexts, setInitCheckoutTexts] = useState<string[]>([]);
  const [initCheckoutAutoKeywords, setInitCheckoutAutoKeywords] = useState(true);

  const [purchaseConfig, setPurchaseConfig] = useState<"approved_only" | "approved_and_pending" | "all">("approved_only");
  const [purchaseValueType, setPurchaseValueType] = useState<"sale_value" | "fixed_value" | "no_value">("sale_value");
  const [purchaseFixedValue, setPurchaseFixedValue] = useState<number | undefined>(undefined);

  // Carregar dados salvos
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setPixels(JSON.parse(saved));
      } else {
        setPixels([]);
      }
    } catch {
      setPixels([]);
    }
  }, [storageKey]);

  // Salvar no localStorage e sincronizar token e pixel principal com Supabase
  const persistPixels = async (updated: PixelConfig[]) => {
    setPixels(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));

    // Se houver um pixel ativo com meta_pixel_ids, sincroniza com profiles no Supabase
    const activeMeta = updated.find((p) => p.status === "active" && p.meta_pixel_ids.length > 0);
    if (activeMeta && user) {
      try {
        const primaryMetaId = activeMeta.meta_pixel_ids[0];
        await supabase
          .from("profiles")
          .update({ meta_pixel_id: primaryMetaId })
          .eq("user_id", user.id);

        if (activeMeta.meta_access_token) {
          await supabase.functions.invoke("secrets-vault", {
            body: { action: "set", kind: "meta_access_token", value: activeMeta.meta_access_token },
          });
        }
      } catch (e) {
        console.warn("Sync Supabase pixel info failed:", e);
      }
    }
  };

  const openCreateModal = () => {
    setEditingPixel(null);
    setFormName("");
    setFormType("meta");
    setFormProduct("Qualquer");
    setMetaPixelInput("");
    setMetaPixelList([]);
    setMetaAccessToken("");
    setTestEventCode("");
    setLeadEnabled(false);
    setAddToCartEnabled(false);
    setInitCheckoutEnabled(true);
    setInitCheckoutDetection("contains_text");
    setInitCheckoutTextInput("");
    setInitCheckoutTexts(["COMPRAR AGORA", "QUERO MEU ACESSO", "GARANTIR VAGA"]);
    setInitCheckoutAutoKeywords(true);
    setPurchaseConfig("approved_only");
    setPurchaseValueType("sale_value");
    setPurchaseFixedValue(undefined);
    setModalOpen(true);
  };

  const openEditModal = (p: PixelConfig) => {
    setEditingPixel(p);
    setFormName(p.name);
    setFormType(p.pixel_type);
    setFormProduct(p.product);
    setMetaPixelInput("");
    setMetaPixelList(p.meta_pixel_ids || []);
    setMetaAccessToken(p.meta_access_token || "");
    setTestEventCode(p.test_event_code || "");
    setLeadEnabled(p.lead_enabled);
    setAddToCartEnabled(p.add_to_cart_enabled);
    setInitCheckoutEnabled(p.initiate_checkout_enabled);
    setInitCheckoutDetection(p.initiate_checkout_detection);
    setInitCheckoutTextInput("");
    setInitCheckoutTexts(p.initiate_checkout_texts || []);
    setInitCheckoutAutoKeywords(p.initiate_checkout_auto_keywords);
    setPurchaseConfig(p.purchase_config);
    setPurchaseValueType(p.purchase_value_type);
    setPurchaseFixedValue(p.purchase_fixed_value);
    setModalOpen(true);
  };

  const handleAddMetaPixelId = () => {
    const trimmed = metaPixelInput.trim().replace(/\s+/g, "");
    if (!trimmed) return;
    if (metaPixelList.includes(trimmed)) {
      toast({ title: "Pixel já adicionado", description: "Este ID já está na lista." });
      return;
    }
    setMetaPixelList([...metaPixelList, trimmed]);
    setMetaPixelInput("");
  };

  const handleRemoveMetaPixelId = (idToRemove: string) => {
    setMetaPixelList(metaPixelList.filter((id) => id !== idToRemove));
  };

  const handleAddCheckoutText = () => {
    const trimmed = initCheckoutTextInput.trim();
    if (!trimmed) return;
    if (initCheckoutTexts.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      toast({ title: "Texto já adicionado" });
      return;
    }
    setInitCheckoutTexts([...initCheckoutTexts, trimmed]);
    setInitCheckoutTextInput("");
  };

  const handleRemoveCheckoutText = (textToRemove: string) => {
    setInitCheckoutTexts(initCheckoutTexts.filter((t) => t !== textToRemove));
  };

  const handleSavePixel = async () => {
    if (!formName.trim()) {
      toast({ title: "Nome obrigatório", description: "Dê um nome para identificar o seu Pixel.", variant: "destructive" });
      return;
    }

    if (formType === "meta" && metaPixelList.length === 0) {
      toast({ title: "ID do Pixel obrigatório", description: "Adicione ao menos um ID de Pixel da Meta.", variant: "destructive" });
      return;
    }

    const now = new Date().toISOString();
    const pixelId = editingPixel?.id || `nx_px_${crypto.randomUUID().slice(0, 16)}`;

    const pixelData: PixelConfig = {
      id: pixelId,
      name: formName.trim(),
      pixel_type: formType,
      status: editingPixel?.status || "active",
      product: formProduct,
      dismiss_warning: editingPixel?.dismiss_warning || false,
      meta_pixel_ids: metaPixelList,
      meta_access_token: metaAccessToken.trim() || undefined,
      test_event_code: testEventCode.trim() || undefined,
      lead_enabled: leadEnabled,
      add_to_cart_enabled: addToCartEnabled,
      initiate_checkout_enabled: initCheckoutEnabled,
      initiate_checkout_detection: initCheckoutDetection,
      initiate_checkout_texts: initCheckoutTexts,
      initiate_checkout_auto_keywords: initCheckoutAutoKeywords,
      purchase_config: purchaseConfig,
      purchase_value_type: purchaseValueType,
      purchase_fixed_value: purchaseFixedValue,
      created_at: editingPixel?.created_at || now,
      updated_at: now,
    };

    let updated: PixelConfig[];
    if (editingPixel) {
      updated = pixels.map((p) => (p.id === editingPixel.id ? pixelData : p));
      toast({ title: "Pixel atualizado com sucesso!" });
    } else {
      updated = [...pixels, pixelData];
      toast({ title: "Pixel criado com sucesso!" });
    }

    await persistPixels(updated);
    setModalOpen(false);
  };

  const handleToggleStatus = async (pixelId: string) => {
    const updated = pixels.map((p) => {
      if (p.id === pixelId) {
        const next = p.status === "active" ? "inactive" : "active";
        toast({ title: `Pixel ${next === "active" ? "ativado" : "desativado"}` });
        return { ...p, status: next as "active" | "inactive", updated_at: new Date().toISOString() };
      }
      return p;
    });
    await persistPixels(updated);
  };

  const handleDeletePixel = async (pixelId: string) => {
    const updated = pixels.filter((p) => p.id !== pixelId);
    await persistPixels(updated);
    toast({ title: "Pixel removido" });
  };

  const handleDismissWarning = async (pixelId: string) => {
    const updated = pixels.map((p) => (p.id === pixelId ? { ...p, dismiss_warning: true } : p));
    await persistPixels(updated);
  };

  const generateSnippet = (p: PixelConfig) => {
    const host = typeof window !== "undefined" ? window.location.origin : "https://nexustrack.lovable.app";
    const metaIds = p.meta_pixel_ids.join(",");
    const texts = encodeURIComponent(p.initiate_checkout_texts.join("|"));
    return `<script src="${host}/nexustrack.js" data-pixel-id="${p.id}" data-meta-pixels="${metaIds}" data-checkout-texts="${texts}" data-auto-keywords="${p.initiate_checkout_auto_keywords}" async defer></script>`;
  };

  const copySnippet = (p: PixelConfig) => {
    const snippet = generateSnippet(p);
    navigator.clipboard.writeText(snippet);
    setCopiedId(p.id);
    toast({ title: "Código do Script copiado!", description: "Cole antes do fechamento do </head> no seu site." });
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Header da Aba */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary animate-pulse" />
            Pixels de Rastreamento
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure seus Pixels da Meta, TikTok e Google para enviar eventos automáticos de PageView, Initiate Checkout e Vendas via CAPI:
          </p>
        </div>
        <Button onClick={openCreateModal} className="gradient-primary text-primary-foreground gap-2 shrink-0 shadow-lg shadow-primary/20">
          <Plus className="h-4 w-4" /> Adicionar Pixel
        </Button>
      </div>

      {/* Lista de Pixels */}
      {pixels.length === 0 ? (
        <Card className="glass-card border-dashed border-border/60 p-8 text-center">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-3">
            <Layers className="h-6 w-6 text-primary" />
          </div>
          <h3 className="text-base font-semibold text-foreground">Nenhum Pixel configurado ainda</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1 mb-5">
            Adicione o seu Pixel da Meta com regras inteligentes de Initiate Checkout e CAPI para começar a rastrear com deduplicação perfeita.
          </p>
          <Button onClick={openCreateModal} className="gradient-primary text-primary-foreground gap-1.5 text-xs">
            <Plus className="h-3.5 w-3.5" /> Adicionar Meu Primeiro Pixel
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {pixels.map((p) => {
            const isMeta = p.pixel_type === "meta";
            return (
              <Card key={p.id} className="glass-card border-border/60 hover:border-border transition-all">
                <CardContent className="p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    {/* Informações Principais */}
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-semibold text-base text-foreground">{p.name}</span>
                        <Badge
                          variant="outline"
                          className={
                            p.status === "active"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]"
                              : "bg-muted text-muted-foreground text-[10px]"
                          }
                        >
                          {p.status === "active" ? "Status: Ativado" : "Status: Pausado"}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                          {p.pixel_type === "meta" ? "Meta (Facebook)" : p.pixel_type.toUpperCase()}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-1.5 gap-x-6 text-xs text-muted-foreground font-mono">
                        <div>
                          <span className="text-muted-foreground/60">ID:</span>{" "}
                          <span className="text-foreground select-all">{p.id}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground/60">Produto:</span>{" "}
                          <span className="text-foreground">{p.product || "Qualquer"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground/60">Pixels Meta:</span>{" "}
                          <span className="text-primary font-semibold">
                            {p.meta_pixel_ids && p.meta_pixel_ids.length > 0
                              ? p.meta_pixel_ids.join(", ")
                              : "Nenhum"}
                          </span>
                        </div>
                      </div>

                      {/* Regras Ativas */}
                      <div className="flex items-center gap-2 pt-1 flex-wrap">
                        <span className="text-[11px] text-muted-foreground">Disparos:</span>
                        <Badge variant="outline" className="text-[10px] bg-background/50 border-border/60 text-muted-foreground">
                          PageView: <span className="text-emerald-400 ml-1">Ativo</span>
                        </Badge>
                        <Badge variant="outline" className="text-[10px] bg-background/50 border-border/60 text-muted-foreground">
                          Initiate Checkout:{" "}
                          <span className={p.initiate_checkout_enabled ? "text-emerald-400 ml-1" : "text-muted-foreground ml-1"}>
                            {p.initiate_checkout_enabled ? `${p.initiate_checkout_texts.length} gatilhos` : "Off"}
                          </span>
                        </Badge>
                        <Badge variant="outline" className="text-[10px] bg-background/50 border-border/60 text-muted-foreground">
                          Purchase (CAPI):{" "}
                          <span className="text-emerald-400 ml-1">
                            {p.purchase_config === "approved_only" ? "Aprovadas" : "Todas"}
                          </span>
                        </Badge>
                      </div>
                    </div>

                    {/* Ações */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copySnippet(p)}
                        className="text-xs gap-1.5 h-8 border-primary/30 text-primary hover:bg-primary/10"
                      >
                        {copiedId === p.id ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                        {copiedId === p.id ? "Copiado!" : "Copiar Script"}
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditModal(p)}
                        className="text-xs gap-1 h-8"
                      >
                        <Edit3 className="h-3.5 w-3.5" /> Editar
                      </Button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-[#12131a] border-border text-xs">
                          <DropdownMenuItem onClick={() => handleToggleStatus(p.id)}>
                            {p.status === "active" ? "Desativar Pixel" : "Ativar Pixel"}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => copySnippet(p)}>
                            Copiar Código HTML
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDeletePixel(p.id)}
                            className="text-red-400 hover:text-red-300"
                          >
                            Excluir Pixel
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Card de Aviso de Deduplicação (Estilo UTMify com visual futurista) */}
                  {isMeta && !p.dismiss_warning && p.meta_pixel_ids.length > 0 && (
                    <div className="mt-4 rounded-xl border border-amber-500/20 bg-gradient-to-r from-amber-500/10 via-background/40 to-amber-500/5 p-4 text-xs space-y-2">
                      <div className="flex items-start gap-2.5">
                        <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                        <div className="space-y-1 flex-1">
                          <p className="font-semibold text-amber-300">
                            Detectamos outro código de Pixel Meta nas suas páginas
                          </p>
                          <p className="text-muted-foreground text-[11px] leading-relaxed">
                            O Pixel Meta <strong className="text-foreground">{p.meta_pixel_ids[0]}</strong> está configurado aqui no NexusTrack. Se estiver sendo carregado por outro plugin ou GTM sem ID de deduplicação, o Gerenciador de Anúncios pode contar eventos em dobro.
                          </p>
                          <p className="text-[11px] text-amber-400/90 font-medium">
                            O NexusTrack já dispara o Pixel Meta e a API de Conversões automaticamente por você com deduplicação oficial!
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDismissWarning(p.id)}
                          className="h-7 text-[11px] text-muted-foreground hover:text-foreground shrink-0 border border-border/40"
                        >
                          Dispensar aviso
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* MODAL / DRAWER: CRIAR OU EDITAR PIXEL */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="glass-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              {editingPixel ? "Editar Pixel" : "Adicionar Novo Pixel"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 text-left py-2">
            {/* 1. Nome & Tipo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Nome do Pixel</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: Minha Oferta Principal"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Tipo de Pixel</Label>
                <Select value={formType} onValueChange={(v: any) => setFormType(v)}>
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#12131a] border-border text-xs">
                    <SelectItem value="meta">Meta (Facebook Ads)</SelectItem>
                    <SelectItem value="tiktok">TikTok Ads</SelectItem>
                    <SelectItem value="google">Google Ads</SelectItem>
                    <SelectItem value="kwai">Kwai Ads</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 2. Código do Pixel Snippet Preview */}
            <div className="space-y-1.5 rounded-lg border border-border/60 bg-muted/20 p-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Code2 className="h-3.5 w-3.5 text-primary" />
                  Código do Script (Instalação no seu site):
                </Label>
                <span className="text-[10px] text-muted-foreground">Cole no &lt;head&gt; do seu site</span>
              </div>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={`<script src="${typeof window !== "undefined" ? window.location.origin : "https://nexustrack.lovable.app"}/nexustrack.js" data-pixel-id="${editingPixel?.id || "nx_px_..."}" async defer></script>`}
                  className="font-mono text-[11px] bg-background/60 text-emerald-400 select-all"
                />
              </div>
            </div>

            {/* 3. Seção Pixels da Meta */}
            {formType === "meta" && (
              <div className="space-y-3 p-4 rounded-xl border border-primary/20 bg-primary/5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-foreground">Pixels da Meta (IDs)</Label>
                  <span className="text-[10px] text-muted-foreground">Multi-Pixel suportado</span>
                </div>

                {/* Tags de Pixels adicionados */}
                <div className="flex flex-wrap gap-2 min-h-[32px] p-2 rounded-lg bg-background/50 border border-border/40">
                  {metaPixelList.length === 0 ? (
                    <span className="text-xs text-muted-foreground/60 italic self-center">
                      Nenhum ID adicionado. Digite o ID abaixo e clique em Adicionar +.
                    </span>
                  ) : (
                    metaPixelList.map((id) => (
                      <Badge
                        key={id}
                        variant="secondary"
                        className="bg-primary/10 text-primary border border-primary/30 text-xs gap-1.5 pl-2.5 pr-1 py-1"
                      >
                        <span className="font-mono">{id}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveMetaPixelId(id)}
                          className="hover:bg-primary/20 rounded-full p-0.5 text-primary"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))
                  )}
                </div>

                {/* Input de Adicionar Novo ID */}
                <div className="flex gap-2">
                  <Input
                    value={metaPixelInput}
                    onChange={(e) => setMetaPixelInput(e.target.value)}
                    placeholder="Ex: 1096515866506660"
                    className="font-mono text-xs"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddMetaPixelId();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    onClick={handleAddMetaPixelId}
                    variant="outline"
                    className="shrink-0 text-xs border-primary/30 text-primary hover:bg-primary/10 gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" /> Adicionar +
                  </Button>
                </div>

                {/* Token de API de Conversões (CAPI) */}
                <div className="space-y-1.5 pt-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">Token de Acesso da API de Conversões (CAPI)</Label>
                    <a
                      href="https://developers.facebook.com/docs/marketing-api/conversions-api/get-started"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
                    >
                      Como gerar na Meta <Globe className="h-2.5 w-2.5" />
                    </a>
                  </div>
                  <Input
                    type="password"
                    value={metaAccessToken}
                    onChange={(e) => setMetaAccessToken(e.target.value)}
                    placeholder="EAA... (Token gerado no Gerenciador de Eventos da Meta)"
                    className="font-mono text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    O token permite que o NexusTrack envie eventos de Purchase pelo servidor sem bloqueios de adblock.
                  </p>
                </div>

                {/* Código de Teste (opcional) */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">
                    Código de Teste do Gerenciador de Eventos (Opcional):
                  </Label>
                  <Input
                    value={testEventCode}
                    onChange={(e) => setTestEventCode(e.target.value)}
                    placeholder="Ex: TEST12345"
                    className="font-mono text-xs"
                  />
                </div>
              </div>
            )}

            {/* 4. Regra de Lead */}
            <div className="space-y-2 p-3.5 rounded-xl border border-border/60 bg-muted/10">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-bold text-foreground">Regra de Lead</Label>
                  <p className="text-[11px] text-muted-foreground">Envio de evento Lead ao preencher formulários</p>
                </div>
                <Select value={leadEnabled ? "enabled" : "disabled"} onValueChange={(v) => setLeadEnabled(v === "enabled")}>
                  <SelectTrigger className="w-36 text-xs h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#12131a] border-border text-xs">
                    <SelectItem value="disabled">Desabilitado</SelectItem>
                    <SelectItem value="enabled">Habilitado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 5. Regra de Add To Cart */}
            <div className="space-y-2 p-3.5 rounded-xl border border-border/60 bg-muted/10">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-bold text-foreground">Regra de Add To Cart</Label>
                  <p className="text-[11px] text-muted-foreground">Envio ao adicionar produto ao carrinho</p>
                </div>
                <Select value={addToCartEnabled ? "enabled" : "disabled"} onValueChange={(v) => setAddToCartEnabled(v === "enabled")}>
                  <SelectTrigger className="w-36 text-xs h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#12131a] border-border text-xs">
                    <SelectItem value="disabled">Desabilitado</SelectItem>
                    <SelectItem value="enabled">Habilitado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 6. Regra de Initiate Checkout (Destaque Principal) */}
            <div className="space-y-3.5 p-4 rounded-xl border border-border/60 bg-muted/15">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-bold text-foreground">Regra de Initiate Checkout</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Dispara quando o visitante clica no botão de ir para o pagamento
                  </p>
                </div>
                <Select
                  value={initCheckoutEnabled ? "enabled" : "disabled"}
                  onValueChange={(v) => setInitCheckoutEnabled(v === "enabled")}
                >
                  <SelectTrigger className="w-36 text-xs h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#12131a] border-border text-xs">
                    <SelectItem value="enabled">Habilitado</SelectItem>
                    <SelectItem value="disabled">Desabilitado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {initCheckoutEnabled && (
                <div className="space-y-3 pt-2 border-t border-border/40">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-muted-foreground">Regra de Detecção</Label>
                      <Select
                        value={initCheckoutDetection}
                        onValueChange={(v: any) => setInitCheckoutDetection(v)}
                      >
                        <SelectTrigger className="text-xs h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#12131a] border-border text-xs">
                          <SelectItem value="contains_text">Contém texto no botão</SelectItem>
                          <SelectItem value="contains_url">Contém link de checkout</SelectItem>
                          <SelectItem value="css_selector">Seletor de Classe CSS</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-muted-foreground">Detecção Automática por Palavras-Chave</Label>
                      <Select
                        value={initCheckoutAutoKeywords ? "enabled" : "disabled"}
                        onValueChange={(v) => setInitCheckoutAutoKeywords(v === "enabled")}
                      >
                        <SelectTrigger className="text-xs h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#12131a] border-border text-xs">
                          <SelectItem value="enabled">Habilitado (Recomendado)</SelectItem>
                          <SelectItem value="disabled">Desabilitado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Tags com textos do botão */}
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold text-foreground">
                      Marcar se o botão de compra contém:
                    </Label>
                    <div className="flex flex-wrap gap-2 p-2.5 rounded-lg bg-background/60 border border-border/40 min-h-[36px]">
                      {initCheckoutTexts.length === 0 ? (
                        <span className="text-xs text-muted-foreground/60 italic">
                          Nenhuma palavra adicionada. Adicione frases que aparecem nos seus botões.
                        </span>
                      ) : (
                        initCheckoutTexts.map((text) => (
                          <Badge
                            key={text}
                            variant="secondary"
                            className="bg-muted hover:bg-muted text-foreground border border-border/80 text-xs gap-1.5 pl-2.5 pr-1 py-1"
                          >
                            <span>{text}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveCheckoutText(text)}
                              className="hover:bg-background/80 rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Input
                        value={initCheckoutTextInput}
                        onChange={(e) => setInitCheckoutTextInput(e.target.value)}
                        placeholder="Ex: QUERO O PLANO VIP"
                        className="text-xs h-8"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddCheckoutText();
                          }
                        }}
                      />
                      <Button
                        type="button"
                        onClick={handleAddCheckoutText}
                        variant="outline"
                        className="shrink-0 text-xs h-8 border-border gap-1"
                      >
                        <Plus className="h-3.5 w-3.5" /> Adicionar +
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 7. Regra de Purchase */}
            <div className="space-y-3.5 p-4 rounded-xl border border-border/60 bg-muted/15">
              <Label className="text-xs font-bold text-foreground">Regra de Purchase (Conversão de Venda)</Label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">Configuração de Envio</Label>
                  <Select
                    value={purchaseConfig}
                    onValueChange={(v: any) => setPurchaseConfig(v)}
                  >
                    <SelectTrigger className="text-xs h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#12131a] border-border text-xs">
                      <SelectItem value="approved_only">Apenas vendas aprovadas</SelectItem>
                      <SelectItem value="approved_and_pending">Aprovadas e Pendentes (Pix/Boleto)</SelectItem>
                      <SelectItem value="all">Todas as vendas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">Valor do Envio</Label>
                  <Select
                    value={purchaseValueType}
                    onValueChange={(v: any) => setPurchaseValueType(v)}
                  >
                    <SelectTrigger className="text-xs h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#12131a] border-border text-xs">
                      <SelectItem value="sale_value">Valor real da venda</SelectItem>
                      <SelectItem value="fixed_value">Valor fixo</SelectItem>
                      <SelectItem value="no_value">Sem valor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">Produto Vinculado</Label>
                <Input
                  value={formProduct}
                  onChange={(e) => setFormProduct(e.target.value)}
                  placeholder="Qualquer"
                  className="text-xs h-8"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="pt-3 border-t border-border/40 gap-2">
            <Button variant="outline" onClick={() => setModalOpen(false)} className="text-xs">
              Cancelar
            </Button>
            <Button onClick={handleSavePixel} className="gradient-primary text-primary-foreground gap-1.5 text-xs">
              <CheckCircle2 className="h-4 w-4" /> Salvar Pixel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
