import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, X, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface Step {
  key: string;
  label: string;
  to: string;
  done: boolean;
}

const DISMISS_KEY = "nx_onboarding_dismissed";

export function OnboardingChecklist() {
  const { user } = useAuth();
  const [steps, setSteps] = useState<Step[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === "1");

  useEffect(() => {
    if (!user || dismissed) return;
    let cancelled = false;

    (async () => {
      const [{ data: profile }, { data: secretKinds }, { count: pageCount }, { count: leadCount }] = await Promise.all([
        supabase
          .from("profiles")
          .select("meta_pixel_id")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase.rpc("list_my_secret_kinds"),
        supabase.from("pages").select("*", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("leads_clicks").select("*", { count: "exact", head: true }).limit(1),
      ]);

      if (cancelled) return;
      const kinds = new Set((secretKinds as any[] | null)?.map((s) => s.kind) || []);

      const next: Step[] = [
        {
          key: "pixel",
          label: "Configurar Pixel Meta + CAPI",
          to: "/tracking",
          done: !!(profile?.meta_pixel_id && kinds.has("meta_access_token")),
        },
        {
          key: "hotmart",
          label: "Conectar Hotmart (token + webhook)",
          to: "/integrations",
          done: kinds.has("hotmart_token"),
        },
        {
          key: "page",
          label: "Criar primeira página de tracking",
          to: "/pages",
          done: (pageCount || 0) > 0,
        },
        {
          key: "script",
          label: "Instalar script no site (gerar primeira visita)",
          to: "/pages",
          done: (leadCount || 0) > 0,
        },
      ];

      setSteps(next);
      setLoaded(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [user, dismissed]);

  if (dismissed || !loaded) return null;

  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  return (
    <Card className="glass-card border-primary/30 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent pointer-events-none" />
      <CardContent className="p-5 relative">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <div>
              <h3 className="font-display font-bold text-foreground">
                Configura o NexusTrack ({doneCount}/{steps.length})
              </h3>
              <p className="text-xs text-muted-foreground">Completa estes passos para começar a receber dados</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleDismiss} aria-label="Dispensar">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="mb-4 h-2 rounded-full bg-secondary/40 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-500"
            style={{ width: `${(doneCount / steps.length) * 100}%` }}
          />
        </div>

        <ul className="space-y-2">
          {steps.map((step) => (
            <li key={step.key}>
              <Link
                to={step.to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-secondary/40",
                  step.done && "opacity-60",
                )}
              >
                {step.done ? (
                  <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                )}
                <span className={cn("text-sm", step.done && "line-through")}>{step.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
