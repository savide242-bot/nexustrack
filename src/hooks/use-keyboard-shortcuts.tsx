import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

/**
 * Global keyboard shortcuts:
 *  g d → Dashboard
 *  g s → Sales
 *  g l → Leads
 *  g c → Campaigns
 *  g p → Pages
 *  g t → Tracking
 *  g n → Notifications
 *  ?  → Show shortcuts help
 */
export function useKeyboardShortcuts() {
  const navigate = useNavigate();

  useEffect(() => {
    let waitingForSecond = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const reset = () => {
      waitingForSecond = false;
      if (timer) { clearTimeout(timer); timer = null; }
    };

    const onKey = (e: KeyboardEvent) => {
      // Ignore when typing in inputs
      const target = e.target as HTMLElement;
      const tag = target?.tagName;
      const editable = target?.isContentEditable;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || editable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "?" && e.shiftKey) {
        toast("Atalhos: g+d Dashboard · g+s Vendas · g+l Leads · g+c Campanhas · g+p Páginas · g+t Tracking · g+n Notificações");
        return;
      }

      if (waitingForSecond) {
        const map: Record<string, string> = {
          d: "/", s: "/sales", l: "/leads", c: "/campaigns",
          p: "/pages", t: "/tracking", n: "/notifications",
        };
        const route = map[e.key.toLowerCase()];
        if (route) {
          e.preventDefault();
          navigate(route);
        }
        reset();
        return;
      }

      if (e.key === "g") {
        waitingForSecond = true;
        timer = setTimeout(reset, 800);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (timer) clearTimeout(timer);
    };
  }, [navigate]);
}
