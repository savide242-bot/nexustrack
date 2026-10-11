import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboard } from "@/contexts/DashboardContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Share2, Radio, FileText, Code2, MessageSquare, FlaskConical,
  Check, Copy, Plus, RefreshCw, MoreVertical, Facebook, ExternalLink,
  ChevronRight, ChevronDown, CheckCircle2, ShieldCheck, Trash2
} from "lucide-react";

interface FbAccount {
  id: string;
  name: string;
  currency: string;
  status?: number;
}

export default function Integrations() {
  const { user } = useAuth();
  const { current, reloadDashboards } = useDashboard();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("ads");

  // Facebook Ads State
  const [fbAccounts, setFbAccounts] = useState<FbAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [tokenModalOpen, setTokenModalOpen] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [savingToken, setSavingToken] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Parâmetros de UTM padrão UTMify para Meta Ads
  const metaUtmParams = "utm_source=fb&utm_medium=paid&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&utm_term={{adset.name}}";

  // Script de rastreamento para a página de vendas
  const trackingScriptCode = `<script src="${window.location.origin}/nexustrack.js" async defer></script>`;

  // URL do Webhook da dashboard atual
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "qjfnosljbyqzyrfhiybi";
  const webhookUrl = `https://${projectId}.supabase.co/functions/v1/hotmart-webhook?dash=${current?.id || ""}`;

  const loadFbData = async () => {
    if (!user) return;
    setLoadingAccounts(true);

    // 1. Verificar se existe token no Vault
    const { data: vaultData } = await supabase.functions.invoke("secrets-vault", {
      body: { action: "preview", kind: "meta_access_token" },
    });

    if (vaultData?.exists) {
      setProfileName(user.email ? user.email.split("@")[0] : "Perfil Conectado");

      // 2. Carregar contas de anúncios
      const { data, error } = await supabase.functions.invoke("fb-list-accounts");
      if (data?.accounts) {
        setFbAccounts(data.accounts);
      }
    } else {
      setProfileName(null);
      setFbAccounts([]);
    }
    setLoadingAccounts(false);
  };

  useEffect(() => {
    loadFbData();
  }, [user]);

  const handleSaveToken = async () => {
    if (!tokenInput.trim()) {
      toast({ title: "Informe o token de acesso da Meta", variant: "destructive" });
      return;
    }

    setSavingToken(true);
    const { data, error } = await supabase.functions.invoke("secrets-vault", {
      body: { action: "set", kind: "meta_access_token", value: tokenInput.trim() },
    });
    setSavingToken(false);

    if (error || (data as any)?.error) {
      toast({ title: "Erro ao salvar", description: error?.message || (data as any)?.error, variant: "destructive" });
      return;
    }

    toast({ title: "Perfil do Facebook conectado com sucesso!" });
    setTokenModalOpen(false);
    setTokenInput("");
    loadFbData();
  };

  const handleSelectAccount = async (account: FbAccount) => {
    if (!current) {
      toast({ title: "Selecione uma dashboard primeiro", variant: "destructive" });
      return;
    }

    let res = await supabase
      .from("operations")
      .update({
        fb_ad_account_id: account.id,
      })
      .eq("id", current.id);

    if (res.error && res.error.message.includes("schema cache")) {
      res = await supabase
        .from("dashboards" as any)
        .update({
          fb_ad_account_id: account.id,
          fb_ad_account_name: account.name,
          fb_account_currency: account.currency,
          fb_connected_at: new Date().toISOString(),
        })
        .eq("id", current.id);
    }

    if (res.error) {
      toast({ title: "Erro ao associar conta", description: res.error.message, variant: "destructive" });
      return;
    }

    toast({
      title: "Conta de Anúncios vinculada!",
      description: `${account.name} (act_${account.id}) conectada à dashboard ${current.name}`,
    });
    await reloadDashboards();
  };

  const handleDisconnectFb = async () => {
    if (!confirm("Deseja desconectar este perfil do Facebook?")) return;
    await supabase.functions.invoke("secrets-vault", {
      body: { action: "set", kind: "meta_access_token", value: "" },
    });
    setProfileName(null);
    setFbAccounts([]);
    toast({ title: "Perfil desconectado" });
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(id);
    setTimeout(() => setCopiedText(null), 2000);
    toast({ title: "Copiado para a área de transferência!" });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Banner Superior Estilo UTMify */}
      <div className="rounded-xl border border-border bg-card/60 p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
              Configuração da Dashboard:
            </span>
            <strong className="text-foreground text-sm font-bold">{current?.name || "Principal"}</strong>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Conecte suas fontes de anúncios, copie o script para sua página e configure webhooks.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadFbData} disabled={loadingAccounts} className="h-8 gap-1.5 text-xs">
          <RefreshCw className={`h-3.5 w-3.5 ${loadingAccounts ? "animate-spin" : ""}`} /> Atualizar status
        </Button>
      </div>

      {/* Abas Superiores Idênticas à Foto da UTMify */}
      <div className="flex border-b border-border/60 gap-1 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab("ads")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
            activeTab === "ads"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Share2 className="h-4 w-4" /> Anúncios
        </button>

        <button
          onClick={() => setActiveTab("webhooks")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
            activeTab === "webhooks"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Radio className="h-4 w-4" /> Webhooks
        </button>

        <button
          onClick={() => setActiveTab("utms")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
            activeTab === "utms"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileText className="h-4 w-4" /> UTMs
        </button>

        <button
          onClick={() => setActiveTab("pixel")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
            activeTab === "pixel"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Code2 className="h-4 w-4" /> Pixel & Script
        </button>

        <button
          onClick={() => setActiveTab("tests")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
            activeTab === "tests"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <FlaskConical className="h-4 w-4" /> Testes
        </button>
      </div>

      {/* ABA 1: ANÚNCIOS (Foco 100% Meta Ads, Foto 1) */}
      {activeTab === "ads" && (
        <div className="space-y-6">
          {/* Card: Meta Ads */}
          <Card className="glass-card border-border">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-bold flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center">
                  <Facebook className="h-4 w-4 fill-current" />
                </div>
                Meta Ads
              </CardTitle>
              {profileName && (
                <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">Conectado</Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">Conecte seus perfis por aqui:</p>

              {profileName ? (
                <div className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-card/60">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-400 font-bold text-sm">
                      {profileName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{profileName}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">Token Meta ativo no Vault</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDisconnectFb}
                    className="text-destructive hover:text-destructive h-8 text-xs gap-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Desconectar
                  </Button>
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-dashed border-border/80 bg-muted/5 text-center space-y-3">
                  <p className="text-xs text-muted-foreground">Nenhum perfil do Facebook Ads conectado ainda.</p>
                  <Button onClick={() => setTokenModalOpen(true)} className="gradient-primary text-primary-foreground text-xs gap-1.5 h-9">
                    <Plus className="h-4 w-4" /> Adicionar perfil
                  </Button>
                </div>
              )}

              {profileName && (
                <Button onClick={() => setTokenModalOpen(true)} variant="outline" size="sm" className="text-xs gap-1 h-8">
                  <Plus className="h-3.5 w-3.5" /> Atualizar / Trocar perfil
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Card: Contas de Anúncio (Meta) */}
          <Card className="glass-card border-border">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold">Contas de Anúncio (Meta)</CardTitle>
              <button onClick={loadFbData} className="text-xs text-primary hover:underline flex items-center gap-1">
                Recarregar contas <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Escolha a conta de anúncio para vincular a esta dashboard (<strong className="text-foreground">{current?.name}</strong>):
              </p>

              {fbAccounts.length === 0 ? (
                <div className="p-6 rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground">
                  {profileName
                    ? "Nenhuma conta de anúncios encontrada neste perfil."
                    : "Conecte um perfil do Meta Ads acima para carregar suas contas de anúncios."}
                </div>
              ) : (
                <div className="space-y-2">
                  {fbAccounts.map((acc) => {
                    const isSelected = current?.fb_ad_account_id === acc.id;
                    return (
                      <div
                        key={acc.id}
                        onClick={() => handleSelectAccount(acc)}
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? "border-primary/60 bg-primary/10 shadow-sm"
                            : "border-border bg-card/40 hover:border-border hover:bg-muted/10"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                              isSelected ? "border-primary bg-primary" : "border-muted-foreground"
                            }`}
                          >
                            {isSelected && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{acc.name}</p>
                            <p className="text-[11px] text-muted-foreground font-mono">
                              act_{acc.id} • {acc.currency}
                            </p>
                          </div>
                        </div>

                        {isSelected ? (
                          <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px]">
                            Vinculada a esta Dashboard
                          </Badge>
                        ) : (
                          <Button variant="ghost" size="sm" className="h-7 text-xs">
                            Selecionar
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ABA 2: WEBHOOKS (Hotmart, Kiwify, etc.) */}
      {activeTab === "webhooks" && (
        <Card className="glass-card border-border">
          <CardHeader>
            <CardTitle className="text-lg">Webhooks de Venda</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-xs text-muted-foreground">
              Cadastre esta URL na sua plataforma de checkout (Hotmart, Kiwify, PerfectPay, Eduzz) para receber vendas em tempo real nesta dashboard.
            </p>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">URL de Webhook da Dashboard:</Label>
              <div className="flex gap-2">
                <Input readOnly value={webhookUrl} className="font-mono text-xs bg-muted/20" />
                <Button
                  onClick={() => copyToClipboard(webhookUrl, "wh")}
                  className="gradient-primary text-primary-foreground shrink-0 gap-1.5"
                >
                  {copiedText === "wh" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  Copiar Webhook
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-muted/10 p-4 text-xs space-y-2">
              <p className="font-semibold text-foreground">Como configurar na Hotmart / Kiwify:</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Acesse as Ferramentas / Configurações da sua plataforma de pagamento.</li>
                <li>Procure por <strong>Webhooks</strong> ou <strong>Postback</strong>.</li>
                <li>Cole a URL acima e selecione os eventos: <em>Compra Aprovada, Pedido Concluído, Reembolso</em>.</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ABA 3: UTMS (Parâmetros de URL Prontos para Meta Ads, Estilo UTMify) */}
      {activeTab === "utms" && (
        <Card className="glass-card border-border">
          <CardHeader>
            <CardTitle className="text-lg">Parâmetros de URL (Facebook Ads)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-xs text-muted-foreground">
              Na UTMify você não cria link por link: você apenas copia o modelo oficial de parâmetros de URL e cola no Facebook Ads.
            </p>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">Parâmetros de URL Prontos:</Label>
              <div className="flex gap-2">
                <Input readOnly value={metaUtmParams} className="font-mono text-xs bg-muted/20 text-primary" />
                <Button
                  onClick={() => copyToClipboard(metaUtmParams, "utms")}
                  className="gradient-primary text-primary-foreground shrink-0 gap-1.5"
                >
                  {copiedText === "utms" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  Copiar Parâmetros
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-muted/10 p-4 text-xs space-y-2">
              <p className="font-semibold text-foreground">Onde colar no Gerenciador de Anúncios do Facebook:</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>No Meta Ads Manager, vá até o nível do <strong>Anúncio</strong>.</li>
                <li>Desça até a secção de <strong>Rastreamento</strong> (Tracking).</li>
                <li>No campo <strong>Parâmetros de URL</strong> (URL Parameters), cole o texto acima.</li>
                <li>O Facebook preencherá automaticamente o nome da campanha, anúncio e conjunto em cada clique!</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ABA 4: PIXEL & SCRIPT (Código da Página de Vendas) */}
      {activeTab === "pixel" && (
        <Card className="glass-card border-border">
          <CardHeader>
            <CardTitle className="text-lg">Script de Rastreamento (Página de Vendas)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-xs text-muted-foreground">
              Instale este script no cabeçalho (<code>&lt;head&gt;</code>) da sua página de vendas para capturar automaticamente cliques, visitantes e parâmetros UTM.
            </p>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">Código JavaScript Pronto:</Label>
              <div className="flex gap-2">
                <Input readOnly value={trackingScriptCode} className="font-mono text-xs bg-muted/20 text-emerald-400" />
                <Button
                  onClick={() => copyToClipboard(trackingScriptCode, "script")}
                  className="gradient-primary text-primary-foreground shrink-0 gap-1.5"
                >
                  {copiedText === "script" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  Copiar Script
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-muted/10 p-4 text-xs space-y-2">
              <p className="font-semibold text-foreground">Instruções de Instalação:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Cole dentro da tag <code>&lt;head&gt;</code> do seu site (WordPress, Webflow, Landing Page).</li>
                <li>O script é ultraleve, não bloqueia o carregamento e preserva os parâmetros até o checkout.</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ABA 5: TESTES */}
      {activeTab === "tests" && (
        <Card className="glass-card border-border">
          <CardHeader>
            <CardTitle className="text-lg">Diagnóstico de Integração</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Teste o envio de eventos, webhooks e parâmetros sem sujar os dados reais da sua dashboard.
            </p>
            <Button
              onClick={() => window.location.href = "/test-tracking"}
              className="gradient-primary text-primary-foreground gap-1.5"
            >
              Abrir Console de Testes de Tracking <ExternalLink className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Modal: Adicionar Perfil Facebook */}
      <Dialog open={tokenModalOpen} onOpenChange={setTokenModalOpen}>
        <DialogContent className="glass-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle>Conectar Perfil Meta Ads</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-left">
            <p className="text-xs text-muted-foreground">
              Cole abaixo o seu <strong>Access Token</strong> da Meta (com permissões <code>ads_read</code> e <code>ads_management</code>) para carregar suas contas de anúncio:
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs">Meta Access Token</Label>
              <Input
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="EAA..."
                className="font-mono text-xs"
              />
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setTokenModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveToken} disabled={savingToken} className="gradient-primary text-primary-foreground">
              {savingToken ? "Salvando..." : "Conectar Perfil"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}