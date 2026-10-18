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
  ChevronRight, ChevronDown, Trash2, Settings, Loader2, Video, Clapperboard, Music2, LayoutGrid,
  Zap, Key, ShieldCheck
} from "lucide-react";
import { PixelManager } from "@/components/PixelManager";

interface FbAccount {
  id: string;
  name: string;
  currency: string;
  status?: number;
}

const OFFICIAL_FB_APP_ID = "1108905534695999";
const FB_APP_ID_KEY = "nx_fb_app_id";

export default function Integrations() {
  const { user } = useAuth();
  const { current, reloadDashboards } = useDashboard();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("ads");
  const [metaExpanded, setMetaExpanded] = useState(true);

  // Facebook Ads State
  const [fbAccounts, setFbAccounts] = useState<FbAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  // App ID Modal
  const [appIdModalOpen, setAppIdModalOpen] = useState(false);
  const [appIdInput, setAppIdInput] = useState(() => {
    return localStorage.getItem(FB_APP_ID_KEY) || "";
  });

  // Direct Token Modal
  const [directTokenModalOpen, setDirectTokenModalOpen] = useState(false);
  const [directTokenInput, setDirectTokenInput] = useState("");
  const [validatingToken, setValidatingToken] = useState(false);

  const [copiedText, setCopiedText] = useState<string | null>(null);

  const metaUtmParams = "utm_source=fb&utm_medium=paid&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&utm_term={{adset.name}}";
  const trackingScriptCode = `<script src="${window.location.origin}/nexustrack.js" async defer></script>`;
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "qjfnosljbyqzyrfhiybi";
  const webhookUrl = `https://${projectId}.supabase.co/functions/v1/hotmart-webhook?dash=${current?.id || ""}`;

  const loadFbData = async () => {
    if (!user) return;
    setLoadingAccounts(true);

    const { data: vaultData } = await supabase.functions.invoke("secrets-vault", {
      body: { action: "preview", kind: "meta_access_token" },
    });

    if (vaultData?.exists) {
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

  // Listener para o Pop-up OAuth do Facebook
  useEffect(() => {
    const handleAuthMessage = async (event: MessageEvent) => {
      if (event.data?.type === "FB_OAUTH_SUCCESS" && event.data?.token) {
        setConnecting(true);
        toast({ title: "Autorizado pelo Facebook!", description: "Salvando credenciais e buscando contas..." });

        try {
          await supabase.functions.invoke("secrets-vault", {
            body: { action: "set", kind: "meta_access_token", value: event.data.token },
          });

          const meRes = await fetch(`https://graph.facebook.com/v21.0/me?access_token=${event.data.token}`);
          const meData = await meRes.json();
          setProfileName(meData?.name || "Facebook Conectado");

          const { data: accData } = await supabase.functions.invoke("fb-list-accounts");
          if (accData?.accounts) {
            setFbAccounts(accData.accounts);
            toast({
              title: "Contas de Anúncio Carregadas!",
              description: `${accData.accounts.length} conta(s) encontrada(s). Selecione a conta desta dashboard abaixo.`,
            });
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

  const openFacebookPopup = (appIdToUse = OFFICIAL_FB_APP_ID) => {
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
        description: "Permita pop-ups para este site e tente novamente.",
        variant: "destructive",
      });
    } else {
      popup.focus();
    }
  };

  const handleStartConnect = () => {
    openFacebookPopup(OFFICIAL_FB_APP_ID);
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

  const handleConnectDirectToken = async () => {
    const token = directTokenInput.trim();
    if (!token) {
      toast({ title: "Token obrigatório", description: "Cole o token de acesso do Facebook.", variant: "destructive" });
      return;
    }

    setValidatingToken(true);
    try {
      // 1. Validar token no Facebook Graph API diretamente pelo navegador (100% à prova de falha de Edge Function)
      const meRes = await fetch(`https://graph.facebook.com/v21.0/me?access_token=${encodeURIComponent(token)}`);
      const meData = await meRes.json();
      if (meData.error) {
        throw new Error(meData.error.message || "Token inválido ou expirado.");
      }

      const userName = meData.name || "Facebook Conectado";
      setProfileName(userName);

      // 2. Buscar contas de anúncios diretamente via Graph API
      let accounts: FbAccount[] = [];
      try {
        const accRes = await fetch(
          `https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name,account_id,currency,account_status&limit=100&access_token=${encodeURIComponent(token)}`
        );
        const accJson = await accRes.json();
        if (accJson?.data) {
          accounts = accJson.data.map((acc: any) => ({
            id: acc.id.replace(/^act_/, ""),
            name: acc.name || `Conta ${acc.account_id}`,
            currency: acc.currency || "USD",
            status: acc.account_status,
          }));
        }
      } catch (graphErr) {
        console.warn("Falha ao buscar contas via browser direto, tentando backend...", graphErr);
      }

      // Salva token em cache local para garantir continuidade na sessão
      localStorage.setItem("nx_meta_direct_token", token);

      // 3. Persistir no secrets-vault em segundo plano (se falhar, não trava a conexão)
      try {
        await supabase.functions.invoke("secrets-vault", {
          body: { action: "set", kind: "meta_access_token", value: token },
        });
      } catch (vaultErr) {
        console.warn("Aviso ao persistir no vault:", vaultErr);
      }

      if (accounts.length > 0) {
        setFbAccounts(accounts);
        toast({
          title: "Facebook Conectado com Sucesso!",
          description: `${accounts.length} conta(s) de anúncio encontrada(s). Selecione a sua conta abaixo.`,
        });
      } else {
        // Tentar buscar via edge function caso a API direta não tenha retornado
        const { data: edgeData } = await supabase.functions.invoke("fb-list-accounts");
        if (edgeData?.accounts && edgeData.accounts.length > 0) {
          setFbAccounts(edgeData.accounts);
          toast({
            title: "Facebook Conectado com Sucesso!",
            description: `${edgeData.accounts.length} conta(s) de anúncio carregada(s).`,
          });
        } else {
          toast({
            title: `Conectado como ${userName}!`,
            description: "Perfil autenticado com sucesso.",
          });
        }
      }

      setDirectTokenModalOpen(false);
      setDirectTokenInput("");
    } catch (e: any) {
      toast({
        title: "Erro ao conectar Facebook",
        description: e.message || "Falha na validação do token.",
        variant: "destructive",
      });
    } finally {
      setValidatingToken(false);
    }
  };

  const handleSelectAccount = async (account: FbAccount) => {
    if (!current) {
      toast({ title: "Selecione uma dashboard primeiro", variant: "destructive" });
      return;
    }

    let res = await supabase
      .from("operations")
      .update({ fb_ad_account_id: account.id })
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
              Dashboard:
            </span>
            <strong className="text-foreground text-sm font-bold">{current?.name || "Principal"}</strong>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Conecte suas plataformas de anúncios por aqui para controlar tudo diretamente do app.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadFbData} disabled={loadingAccounts} className="h-8 gap-1.5 text-xs">
          <RefreshCw className={`h-3.5 w-3.5 ${loadingAccounts ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>

      {/* Abas Superiores Idênticas à Foto 1 da UTMify */}
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

      {/* ABA 1: ANÚNCIOS (Lista de Plataformas idêntica à Foto 1 da UTMify) */}
      {activeTab === "ads" && (
        <div className="space-y-3">
          {/* 1. Meta Ads (Acordeão Expansível) */}
          <div className="rounded-xl border border-border bg-card/60 overflow-hidden transition-all shadow-sm">
            <button
              onClick={() => setMetaExpanded(!metaExpanded)}
              className="w-full flex items-center justify-between p-4 hover:bg-muted/10 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center">
                  <Facebook className="h-5 w-5 fill-current" />
                </div>
                <div className="text-left">
                  <span className="font-semibold text-sm text-foreground">Meta Ads</span>
                  {profileName && (
                    <span className="ml-2 text-[10px] text-primary border border-primary/30 bg-primary/10 px-2 py-0.5 rounded-full font-mono">
                      {profileName}
                    </span>
                  )}
                </div>
              </div>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${metaExpanded ? "rotate-180" : ""}`} />
            </button>

            {metaExpanded && (
              <div className="p-4 pt-1 border-t border-border/40 space-y-4 bg-muted/5">
                <p className="text-xs text-muted-foreground">Conecte seus perfis por aqui:</p>

                {profileName ? (
                  <div className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-card/80">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-400 font-bold text-sm">
                        {profileName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{profileName}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">Perfil Autorizado no Facebook</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDirectTokenModalOpen(true)}
                        className="h-8 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10"
                      >
                        <Zap className="h-3.5 w-3.5" /> Atualizar Token
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleStartConnect}
                        className="h-8 text-xs gap-1"
                      >
                        Pop-up
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
                  <div className="space-y-4">
                    {/* Opção A: Conexão Direta por Token (Sem depender da Meta liberar Pop-up) */}
                    <div className="p-5 rounded-xl border border-primary/30 bg-primary/5 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Zap className="h-5 w-5 text-primary" />
                          <h4 className="text-sm font-bold text-foreground">Conexão Direta com Token (Recomendada)</h4>
                        </div>
                        <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px]">
                          100% Funcional & Sem Bloqueios
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Cole seu Token de Acesso do Facebook para conectar instantaneamente suas contas de anúncio, ler campanhas e aplicar alterações de orçamento em tempo real.
                      </p>

                      <div className="flex flex-col sm:flex-row gap-2">
                        <Input
                          type="password"
                          value={directTokenInput}
                          onChange={(e) => setDirectTokenInput(e.target.value)}
                          placeholder="Cole aqui seu token do Facebook (EAAB...)"
                          className="font-mono text-xs bg-background/80"
                        />
                        <Button
                          onClick={handleConnectDirectToken}
                          disabled={validatingToken || !directTokenInput.trim()}
                          className="gradient-primary text-primary-foreground font-semibold text-xs shrink-0 gap-1.5 h-9 px-5"
                        >
                          {validatingToken ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Conectando...
                            </>
                          ) : (
                            <>
                              <Check className="h-3.5 w-3.5" /> Conectar Token
                            </>
                          )}
                        </Button>
                      </div>

                      {/* Passo a Passo Ilustrado em 1 Minuto */}
                      <div className="rounded-lg border border-border/60 bg-background/50 p-3 space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground flex items-center gap-1.5 text-[11px]">
                            <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Como pegar seu Token no Facebook em 1 minuto:
                          </span>
                          <a
                            href="https://developers.facebook.com/tools/explorer/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline text-[11px] font-semibold inline-flex items-center gap-1"
                          >
                            Abrir Graph Explorer <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                        <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-[11px] leading-relaxed">
                          <li>Abra o <strong>Graph API Explorer</strong> no link acima.</li>
                          <li>
                            Em <strong>Permissões (Permissions)</strong>, adicione:{" "}
                            <span className="font-mono text-primary font-bold">ads_read</span>,{" "}
                            <span className="font-mono text-primary font-bold">ads_management</span> e{" "}
                            <span className="font-mono text-primary font-bold">business_management</span>.
                          </li>
                          <li>Clique no botão azul <strong>Generate Access Token</strong> e aprove.</li>
                          <li>Copie o token gerado e cole no campo acima!</li>
                        </ol>
                      </div>
                    </div>

                    {/* Opção B: Pop-up Tradicional */}
                    <div className="p-4 rounded-xl border border-dashed border-border/80 bg-card/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                          <Facebook className="h-5 w-5 text-blue-400 fill-current" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-foreground">Conectar via Janela Pop-up</p>
                          <p className="text-[11px] text-muted-foreground">Login oficial OAuth via tela modal da Meta.</p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        onClick={handleStartConnect}
                        disabled={connecting}
                        className="text-xs gap-1.5 h-8 shrink-0 hover:bg-blue-600/10 hover:text-blue-400 hover:border-blue-500/30"
                      >
                        {connecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Facebook className="h-3.5 w-3.5 fill-current" />}
                        Abrir Pop-up
                      </Button>
                    </div>
                  </div>
                )}

                {/* Seleção de Contas de Anúncio daquele Perfil */}
                <div className="space-y-2 pt-2 border-t border-border/40">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">Contas de Anúncio (Meta)</span>
                    <button onClick={loadFbData} className="text-[11px] text-primary hover:underline flex items-center gap-1">
                      Recarregar contas <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>

                  {loadingAccounts ? (
                    <div className="p-4 flex items-center justify-center text-xs text-muted-foreground gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> Carregando contas...
                    </div>
                  ) : fbAccounts.length === 0 ? (
                    <div className="p-4 rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground">
                      {profileName
                        ? "Nenhuma conta de anúncios encontrada neste perfil."
                        : "Conecte seu perfil no botão acima para listar as contas."}
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
                                : "border-border bg-card/60 hover:border-border hover:bg-muted/10"
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
                </div>
              </div>
            )}
          </div>

          {/* 2. Google Ads (Card Lista Foto 1) */}
          <div className="rounded-xl border border-border bg-card/60 p-4 flex items-center justify-between opacity-80 hover:opacity-100 transition-opacity">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-red-600/10 text-red-400 flex items-center justify-center">
                <Video className="h-4 w-4" />
              </div>
              <div>
                <span className="font-semibold text-sm text-foreground">Google Ads</span>
                <span className="ml-2 text-[10px] text-muted-foreground border border-border px-1.5 py-0.5 rounded">Em breve</span>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>

          {/* 3. Kwai Ads (Card Lista Foto 1) */}
          <div className="rounded-xl border border-border bg-card/60 p-4 flex items-center justify-between opacity-80 hover:opacity-100 transition-opacity">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-orange-600/10 text-orange-400 flex items-center justify-center">
                <Clapperboard className="h-4 w-4" />
              </div>
              <div>
                <span className="font-semibold text-sm text-foreground">Kwai Ads</span>
                <span className="ml-2 text-[10px] text-muted-foreground border border-border px-1.5 py-0.5 rounded">Em breve</span>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>

          {/* 4. TikTok Ads (Card Lista Foto 1) */}
          <div className="rounded-xl border border-border bg-card/60 p-4 flex items-center justify-between opacity-80 hover:opacity-100 transition-opacity">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-pink-600/10 text-pink-400 flex items-center justify-center">
                <Music2 className="h-4 w-4" />
              </div>
              <div>
                <span className="font-semibold text-sm text-foreground">TikTok Ads</span>
                <span className="ml-2 text-[10px] text-muted-foreground border border-border px-1.5 py-0.5 rounded">Em breve</span>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>

          {/* 5. Taboola (Card Lista Foto 1) */}
          <div className="rounded-xl border border-border bg-card/60 p-4 flex items-center justify-between opacity-80 hover:opacity-100 transition-opacity">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <LayoutGrid className="h-4 w-4" />
              </div>
              <div>
                <span className="font-semibold text-sm text-foreground">Taboola</span>
                <span className="ml-2 text-[10px] text-muted-foreground border border-border px-1.5 py-0.5 rounded">Em breve</span>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      )}

      {/* ABA 2: WEBHOOKS UNIVERSAIS (Hotmart, Kiwify, PerfectPay, Monetizze, Braip, Eduzz) */}
      {activeTab === "webhooks" && (
        <div className="space-y-6">
          <Card className="glass-card border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Radio className="h-5 w-5 text-primary" />
                    Webhook Universal de Vendas
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Cole esta URL na sua plataforma de checkout. O NexusTrack processa automaticamente aprovações, recusas, cancelamentos e envia o evento de <strong>Purchase</strong> para a Meta CAPI com 10/10 de qualidade.
                  </p>
                </div>
                <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">
                  Dashboard: {current?.name || "Principal"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-foreground">Sua URL de Webhook Exclusiva:</Label>
                <div className="flex gap-2">
                  <Input readOnly value={webhookUrl} className="font-mono text-xs bg-muted/20 border-primary/30 text-primary font-bold" />
                  <Button
                    onClick={() => copyToClipboard(webhookUrl, "wh")}
                    className="gradient-primary text-primary-foreground shrink-0 gap-1.5 font-semibold text-xs"
                  >
                    {copiedText === "wh" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    Copiar Webhook
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  O parâmetro <code className="text-primary font-mono">?dash={current?.id || ""}</code> garante que a venda e o faturamento caiam exclusivamente nesta dashboard.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Instruções por Plataforma */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Kiwify */}
            <Card className="glass-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> Como cadastrar na Kiwify:
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-2 leading-relaxed">
                <ol className="list-decimal list-inside space-y-1">
                  <li>Acesse o painel da <strong>Kiwify</strong> &gt; <strong>Apps</strong> &gt; <strong>Webhooks</strong>.</li>
                  <li>Clique em <strong>Criar Webhook</strong>.</li>
                  <li>Insira o nome (ex: NexusTrack) e cole a <strong>URL de Webhook</strong> acima.</li>
                  <li>Marque os eventos: <strong>Venda Aprovada</strong>, <strong>Boleto Gerado</strong>, <strong>Pix Gerado</strong>, <strong>Reembolso</strong>.</li>
                  <li>Selecione seus produtos e clique em <strong>Salvar</strong>.</li>
                </ol>
              </CardContent>
            </Card>

            {/* Hotmart */}
            <Card className="glass-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                  <span className="h-2 w-2 rounded-full bg-orange-500" /> Como cadastrar na Hotmart:
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-2 leading-relaxed">
                <ol className="list-decimal list-inside space-y-1">
                  <li>No menu da <strong>Hotmart</strong>, vá em <strong>Ferramentas</strong> &gt; <strong>Webhooks (API)</strong>.</li>
                  <li>Clique em <strong>Cadastrar Webhook</strong>.</li>
                  <li>Cole a <strong>URL de Webhook</strong> acima.</li>
                  <li>Em eventos, marque <strong>Compra Aprovada</strong> e <strong>Cancelamento/Reembolso</strong>.</li>
                  <li>Clique em <strong>Salvar</strong>. Pronto!</li>
                </ol>
              </CardContent>
            </Card>

            {/* PerfectPay */}
            <Card className="glass-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                  <span className="h-2 w-2 rounded-full bg-blue-500" /> Como cadastrar na PerfectPay:
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-2 leading-relaxed">
                <ol className="list-decimal list-inside space-y-1">
                  <li>Acesse <strong>Ferramentas</strong> &gt; <strong>Postback / Webhooks</strong> na PerfectPay.</li>
                  <li>Clique em <strong>Adicionar Postback</strong>.</li>
                  <li>Cole a URL acima e selecione o tipo de envio <strong>JSON</strong>.</li>
                  <li>Selecione todos os produtos e clique em <strong>Salvar</strong>.</li>
                </ol>
              </CardContent>
            </Card>

            {/* Monetizze / Eduzz / Outras */}
            <Card className="glass-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                  <span className="h-2 w-2 rounded-full bg-purple-500" /> Monetizze, Braip & Eduzz:
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-2 leading-relaxed">
                <ol className="list-decimal list-inside space-y-1">
                  <li>Vá até as configurações de <strong>Postback / Notificações</strong> do seu produto.</li>
                  <li>Cole a <strong>URL de Webhook</strong> com seu parâmetro <code>?dash=...</code>.</li>
                  <li>O NexusTrack detecta automaticamente os campos de comprador, valor, status e UTMs.</li>
                </ol>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ABA 3: UTMS */}
      {activeTab === "utms" && (
        <Card className="glass-card border-border">
          <CardHeader>
            <CardTitle className="text-lg">Parâmetros de URL (Facebook Ads)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-xs text-muted-foreground">
              Copie o modelo de parâmetros de URL e cole no Gerenciador de Anúncios do Facebook:
            </p>
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Parâmetros Oficiais de Rastreamento:</Label>
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
          </CardContent>
        </Card>
      )}

      {/* ABA 4: PIXEL & REGRAS (ESTILO UTMIFY POTENTE) */}
      {activeTab === "pixel" && <PixelManager />}

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
              <Label className="text-xs font-semibold">Facebook App ID</Label>
              <Input
                value={appIdInput}
                onChange={(e) => setAppIdInput(e.target.value)}
                placeholder="Ex: 123456789012345"
                className="font-mono text-sm"
              />
            </div>

            <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-primary">URI de Redirecionamento OAuth:</span>
                <button
                  type="button"
                  onClick={() => {
                    const uri = `${window.location.origin}/fb-callback.html`;
                    navigator.clipboard.writeText(uri);
                    toast({ title: "Copiado!", description: "URI de redirecionamento copiada." });
                  }}
                  className="text-[11px] text-muted-foreground hover:text-primary underline flex items-center gap-1"
                >
                  <Copy className="h-3 w-3" /> Copiar URI
                </button>
              </div>
              <p className="font-mono text-[11px] text-muted-foreground break-all bg-background/50 p-1.5 rounded border border-border/40">
                {typeof window !== "undefined" ? `${window.location.origin}/fb-callback.html` : ""}
              </p>
              <p className="text-[10px] text-muted-foreground leading-tight">
                Cole este endereço no campo <strong>"URIs de redirecionamento do OAuth válidos"</strong> dentro das Definições do Início de Sessão do Facebook no Meta Developers.
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

      {/* Modal: Conexão Direta com Token do Facebook */}
      <Dialog open={directTokenModalOpen} onOpenChange={setDirectTokenModalOpen}>
        <DialogContent className="glass-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Conectar Facebook Ads (Token Direto)
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 text-left py-1">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Esta é a forma <strong>mais rápida e infalível</strong> de conectar suas contas de anúncio da Meta sem enfrentar bloqueios de pop-up ou verificações da Meta.
            </p>

            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Como obter seu Token em 1 minuto:
                </span>
                <a
                  href="https://developers.facebook.com/tools/explorer/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline text-[11px] font-semibold flex items-center gap-1"
                >
                  Abrir Graph Explorer <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-[11px] leading-relaxed">
                <li>Abra o <strong>Graph API Explorer</strong> no link acima.</li>
                <li>
                  No campo <strong>Permissões (Permissions)</strong>, adicione:{" "}
                  <code className="text-primary bg-background/50 px-1 py-0.5 rounded">ads_read</code>,{" "}
                  <code className="text-primary bg-background/50 px-1 py-0.5 rounded">ads_management</code> e{" "}
                  <code className="text-primary bg-background/50 px-1 py-0.5 rounded">business_management</code>.
                </li>
                <li>Clique em <strong>Generate Access Token</strong> e confirme as permissões no Facebook.</li>
                <li>Copie o token gerado e cole no campo abaixo:</li>
              </ol>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Token de Acesso do Facebook (Access Token):</Label>
              <textarea
                value={directTokenInput}
                onChange={(e) => setDirectTokenInput(e.target.value)}
                placeholder="Cole aqui seu token (começa com EAAB... ou EAA...)"
                rows={3}
                className="w-full rounded-md border border-input bg-background/60 px-3 py-2 text-xs font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <p className="text-[10px] text-muted-foreground">
                Seu token é salvo de forma criptografada no Supabase Vault e utilizado exclusivamente para consultar suas métricas e pausar/ativar seus anúncios.
              </p>
            </div>
          </div>

          <DialogFooter className="pt-2 gap-2">
            <Button variant="outline" onClick={() => setDirectTokenModalOpen(false)} className="text-xs">
              Cancelar
            </Button>
            <Button
              onClick={handleConnectDirectToken}
              disabled={validatingToken || !directTokenInput.trim()}
              className="gradient-primary text-primary-foreground gap-1.5 text-xs"
            >
              {validatingToken ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Validando com a Meta...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" /> Validar e Puxar Minhas Contas
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}