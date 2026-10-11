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
  Share2, Radio, FileText, Code2, FlaskConical,
  Check, Copy, Plus, RefreshCw, Facebook, ExternalLink,
  ChevronRight, Trash2, Settings, Loader2
} from "lucide-react";

interface FbAccount {
  id: string;
  name: string;
  currency: string;
  status?: number;
}

const FB_APP_ID_KEY = "nx_fb_app_id";

export default function Integrations() {
  const { user } = useAuth();
  const { current, reloadDashboards } = useDashboard();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("ads");

  // Facebook Ads State
  const [fbAccounts, setFbAccounts] = useState<FbAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  // App ID Modal (só se ainda não configurado)
  const [appIdModalOpen, setAppIdModalOpen] = useState(false);
  const [appIdInput, setAppIdInput] = useState(() => {
    return localStorage.getItem(FB_APP_ID_KEY) || "";
  });

  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Parâmetros de UTM padrão UTMify para Meta Ads
  const metaUtmParams = "utm_source=fb&utm_medium=paid&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&utm_term={{adset.name}}";

  // Script de rastreamento para a página de vendas
  const trackingScriptCode = `<script src="${window.location.origin}/nexustrack.js" async defer></script>`;

  // URL do Webhook da dashboard atual
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "qjfnosljbyqzyrfhiybi";
  const webhookUrl = `https://${projectId}.supabase.co/functions/v1/hotmart-webhook?dash=${current?.id || ""}`;

  // 1. Carregar dados do perfil e contas
  const loadFbData = async () => {
    if (!user) return;
    setLoadingAccounts(true);

    const { data: vaultData } = await supabase.functions.invoke("secrets-vault", {
      body: { action: "preview", kind: "meta_access_token" },
    });

    if (vaultData?.exists) {
      // Buscar nome do perfil conectado
      const { data: accountsData } = await supabase.functions.invoke("fb-list-accounts");
      if (accountsData?.accounts) {
        setFbAccounts(accountsData.accounts);
        setProfileName(user.email ? user.email.split("@")[0] : "Perfil Conectado");
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

  // 2. Ouvinte do PostMessage vindo do Pop-up do Facebook (/fb-callback.html)
  useEffect(() => {
    const handleAuthMessage = async (event: MessageEvent) => {
      if (event.data?.type === "FB_OAUTH_SUCCESS" && event.data?.token) {
        setConnecting(true);
        toast({ title: "Autorizado pelo Facebook!", description: "Salvando credenciais e buscando contas..." });

        try {
          // Salvar token no Vault
          await supabase.functions.invoke("secrets-vault", {
            body: { action: "set", kind: "meta_access_token", value: event.data.token },
          });

          // Buscar dados do perfil na Graph API
          const meRes = await fetch(`https://graph.facebook.com/v21.0/me?access_token=${event.data.token}`);
          const meData = await meRes.json();
          if (meData?.name) {
            setProfileName(meData.name);
          } else {
            setProfileName("Facebook Conectado");
          }

          // Carregar contas de anúncios
          const { data: accData, error: accErr } = await supabase.functions.invoke("fb-list-accounts");
          if (accData?.accounts) {
            setFbAccounts(accData.accounts);
            toast({
              title: "Contas de Anúncio Carregadas!",
              description: `${accData.accounts.length} conta(s) encontrada(s). Selecione a conta desta dashboard abaixo.`,
            });
          } else if (accErr) {
            toast({ title: "Aviso", description: "Token salvo, mas nenhuma conta encontrada.", variant: "destructive" });
          }
        } catch (e: any) {
          toast({ title: "Erro na autenticação", description: e.message, variant: "destructive" });
        }
        setConnecting(false);
      } else if (event.data?.type === "FB_OAUTH_ERROR") {
        setConnecting(false);
        toast({ title: "Falha na conexão", description: event.data.error, variant: "destructive" });
      }
    };

    window.addEventListener("message", handleAuthMessage);
    return () => window.removeEventListener("message", handleAuthMessage);
  }, []);

  // 3. Abertura do POP-UP Oficial do Facebook (Idêntico ao UTMify)
  const openFacebookPopup = (appIdToUse: string) => {
    if (!appIdToUse.trim()) {
      setAppIdModalOpen(true);
      return;
    }

    const width = 600;
    const height = 750;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const redirectUri = `${window.location.origin}/fb-callback.html`;
    const scopes = "ads_read,ads_management,business_management,public_profile";
    const oauthUrl = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${encodeURIComponent(
      appIdToUse.trim()
    )}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&scope=${encodeURIComponent(scopes)}&response_type=token&display=popup`;

    const popup = window.open(
      oauthUrl,
      "facebook_oauth",
      `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes`
    );

    if (!popup || popup.closed || typeof popup.closed === "undefined") {
      toast({
        title: "Pop-up bloqueado pelo navegador",
        description: "Permita pop-ups para este site nas opções do navegador e tente novamente.",
        variant: "destructive",
      });
    } else {
      popup.focus();
    }
  };

  const handleStartConnect = () => {
    const savedAppId = localStorage.getItem(FB_APP_ID_KEY) || appIdInput;
    if (!savedAppId) {
      setAppIdModalOpen(true);
    } else {
      openFacebookPopup(savedAppId);
    }
  };

  const handleSaveAppIdAndOpen = () => {
    if (!appIdInput.trim()) {
      toast({ title: "Informe o App ID", variant: "destructive" });
      return;
    }
    localStorage.setItem(FB_APP_ID_KEY, appIdInput.trim());
    setAppIdModalOpen(false);
    openFacebookPopup(appIdInput.trim());
  };

  // 4. Seleção da Conta de Anúncios para a Dashboard Ativa
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
      description: `${account.name} (act_${account.id}) vinculada à dashboard "${current.name}".`,
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
              Dashboard Selecionada:
            </span>
            <strong className="text-foreground text-sm font-bold">{current?.name || "Principal"}</strong>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Conecte seu Facebook via pop-up, selecione a conta de anúncio e copie os parâmetros UTM.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadFbData} disabled={loadingAccounts} className="h-8 gap-1.5 text-xs">
          <RefreshCw className={`h-3.5 w-3.5 ${loadingAccounts ? "animate-spin" : ""}`} /> Atualizar
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

      {/* ABA 1: ANÚNCIOS (Meta Ads com POP-UP Oficial) */}
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
                      <p className="text-[11px] text-muted-foreground font-mono">Perfil do Facebook Autorizado</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleStartConnect}
                      className="h-8 text-xs gap-1"
                    >
                      Reconectar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDisconnectFb}
                      className="text-destructive hover:text-destructive h-8 text-xs gap-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Desconectar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-6 rounded-xl border border-dashed border-border/80 bg-muted/5 text-center space-y-3">
                  <p className="text-xs text-muted-foreground">Nenhum perfil do Facebook conectado ainda.</p>
                  <Button
                    onClick={handleStartConnect}
                    disabled={connecting}
                    className="gradient-primary text-primary-foreground text-xs gap-2 h-10 px-5 shadow-lg shadow-primary/20 font-semibold"
                  >
                    {connecting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Facebook className="h-4 w-4 fill-current" />
                    )}
                    Conectar com Facebook (Pop-up)
                  </Button>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs text-muted-foreground">
                <span>App ID configurado: <strong className="text-foreground font-mono">{localStorage.getItem(FB_APP_ID_KEY) || "Não definido"}</strong></span>
                <button
                  onClick={() => setAppIdModalOpen(true)}
                  className="text-primary hover:underline flex items-center gap-1"
                >
                  <Settings className="h-3 w-3" /> Alterar App ID
                </button>
              </div>
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

              {loadingAccounts ? (
                <div className="p-6 flex items-center justify-center text-xs text-muted-foreground gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" /> Carregando contas do Facebook...
                </div>
              ) : fbAccounts.length === 0 ? (
                <div className="p-6 rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground">
                  {profileName
                    ? "Nenhuma conta de anúncios encontrada neste perfil do Facebook."
                    : "Conecte o seu Facebook no botão acima para listar automaticamente suas contas de anúncios."}
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

      {/* ABA 2: WEBHOOKS */}
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

      {/* ABA 3: UTMS */}
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

      {/* ABA 4: PIXEL & SCRIPT */}
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

      {/* Modal: Configurar Facebook App ID */}
      <Dialog open={appIdModalOpen} onOpenChange={setAppIdModalOpen}>
        <DialogContent className="glass-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle>Configurar Facebook App ID</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-left">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Para abrir a janela oficial do Facebook no formato Pop-up (como a UTMify faz), insira o <strong>App ID</strong> da sua aplicação Meta for Developers:
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs">Facebook App ID</Label>
              <Input
                value={appIdInput}
                onChange={(e) => setAppIdInput(e.target.value)}
                placeholder="Ex: 123456789012345"
                className="font-mono text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                Encontrado em: <em>developers.facebook.com &gt; My Apps &gt; Configurações Básicas</em>.
              </p>
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setAppIdModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveAppIdAndOpen} className="gradient-primary text-primary-foreground gap-1.5">
              <Facebook className="h-4 w-4 fill-current" /> Abrir Pop-up do Facebook
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}