import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface AdAccountOption {
  id: string;
  name: string;
  currency?: string;
  account_status?: number;
  business_name?: string;
}

/**
 * Facebook Login (popup) → long-lived token → vault.
 * Works for ANY Facebook account: whoever is logged in the popup grants access
 * to the ad accounts they can manage.
 */
export function useFacebookConnect() {
  const { toast } = useToast();
  const [appId, setAppId] = useState("");
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [accounts, setAccounts] = useState<AdAccountOption[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  // App id from the edge function
  useEffect(() => {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    fetch(`https://${projectId}.supabase.co/functions/v1/fb-token-exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get_app_id" }),
    })
      .then((r) => r.json())
      .then((d) => { if (d.app_id) setAppId(d.app_id); })
      .catch(() => {});
  }, []);

  // Facebook JS SDK
  useEffect(() => {
    if (!appId) return;
    if (document.getElementById("fb-jssdk")) { setSdkLoaded(true); return; }
    (window as any).fbAsyncInit = function () {
      (window as any).FB.init({ appId, cookie: true, xfbml: false, version: "v21.0" });
      setSdkLoaded(true);
    };
    const script = document.createElement("script");
    script.id = "fb-jssdk";
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
  }, [appId]);

  /** Load ad accounts using the token already stored in the vault. */
  const loadAccounts = useCallback(async () => {
    setLoadingAccounts(true);
    const { data, error } = await supabase.functions.invoke("fb-ads-control", { body: { action: "accounts" } });
    setLoadingAccounts(false);
    if (error || (data as any)?.error) { setConnected(false); return; }
    setConnected(true);
    setAccounts(((data as any).ad_accounts || []) as AdAccountOption[]);
  }, []);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  const connect = useCallback(() => {
    if (!sdkLoaded) {
      toast({ title: "Facebook ainda a carregar", description: "Tenta novamente em alguns segundos." });
      return;
    }
    setConnecting(true);
    const timer = setTimeout(() => setConnecting(false), 30000);
    try {
      (window as any).FB.login(
        async (response: any) => {
          clearTimeout(timer);
          if (response.status !== "connected" || !response.authResponse?.accessToken) {
            setConnecting(false);
            toast({ title: "Ligação cancelada", variant: "destructive" });
            return;
          }
          try {
            const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
            const res = await fetch(`https://${projectId}.supabase.co/functions/v1/fb-token-exchange`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "exchange", short_token: response.authResponse.accessToken }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            const { error: vErr } = await supabase.functions.invoke("secrets-vault", {
              body: { action: "set", kind: "meta_access_token", value: data.access_token },
            });
            if (vErr) throw vErr;

            setConnected(true);
            setAccounts((data.ad_accounts || []) as AdAccountOption[]);
            toast({
              title: "Facebook ligado!",
              description: `${(data.ad_accounts || []).length} conta(s) de anúncio disponíveis.`,
            });
          } catch (e: any) {
            toast({ title: "Erro ao ligar", description: e.message, variant: "destructive" });
          }
          setConnecting(false);
        },
        { scope: "ads_read,ads_management,business_management" },
      );
    } catch (e: any) {
      clearTimeout(timer);
      setConnecting(false);
      toast({ title: "Popup bloqueado", description: "Permite popups para este site e tenta outra vez.", variant: "destructive" });
    }
  }, [sdkLoaded, toast]);

  return { connect, connecting, connected, accounts, loadAccounts, loadingAccounts, sdkLoaded };
}
