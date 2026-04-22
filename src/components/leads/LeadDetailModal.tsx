import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Eye, MousePointerClick, ShoppingCart, MapPin, Fingerprint, Mail, Phone } from "lucide-react";
import { formatMzn } from "@/lib/format";

interface Props {
  leadId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Lead {
  id: string;
  email: string | null;
  phone: string | null;
  name: string | null;
  fingerprint: string | null;
  city: string | null;
  country: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  utm_medium: string | null;
  page_url: string | null;
  lead_score: number | null;
  created_at: string;
}

interface CTAClick { id: string; button_text: string | null; page_url: string | null; created_at: string; }
interface Sale { id: string; amount_mzn: number | null; product_name: string | null; status: string; created_at: string; sale_date: string | null; approved_at: string | null; }

type Event =
  | { kind: "visit"; date: string; data: Lead }
  | { kind: "cta"; date: string; data: CTAClick }
  | { kind: "sale"; date: string; data: Sale };

export function LeadDetailModal({ leadId, open, onOpenChange }: Props) {
  const [lead, setLead] = useState<Lead | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!leadId || !open) return;
    setLoading(true);

    (async () => {
      const { data: leadRow } = await supabase
        .from("leads_clicks")
        .select("*")
        .eq("id", leadId)
        .maybeSingle();

      if (!leadRow) {
        setLead(null);
        setEvents([]);
        setLoading(false);
        return;
      }
      setLead(leadRow as Lead);

      // Find sibling visits (same fingerprint or email)
      const orFilters: string[] = [];
      if (leadRow.fingerprint) orFilters.push(`fingerprint.eq.${leadRow.fingerprint}`);
      if (leadRow.email) orFilters.push(`email.eq.${leadRow.email}`);

      const visitsQuery = orFilters.length > 0
        ? supabase.from("leads_clicks").select("*").or(orFilters.join(","))
        : supabase.from("leads_clicks").select("*").eq("id", leadId);

      const [{ data: visits }, { data: ctas }, { data: sales }] = await Promise.all([
        visitsQuery.order("created_at", { ascending: false }).limit(50),
        supabase.from("cta_clicks").select("*").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(50),
        supabase.from("sales").select("*").eq("lead_id", leadId).order("sale_date", { ascending: false }).limit(20),
      ]);

      const all: Event[] = [];
      (visits || []).forEach((v) => all.push({ kind: "visit", date: v.created_at, data: v as Lead }));
      (ctas || []).forEach((c) => all.push({ kind: "cta", date: c.created_at, data: c as CTAClick }));
      (sales || []).forEach((s) => all.push({ kind: "sale", date: s.sale_date || s.created_at, data: s as Sale }));
      all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setEvents(all);
      setLoading(false);
    })();
  }, [leadId, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto glass-card border-border">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            Detalhe do Lead
            {lead && <Badge variant="outline" className="border-primary/30 text-primary">Score {lead.lead_score || 0}</Badge>}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground text-sm">A carregar...</div>
        ) : !lead ? (
          <div className="py-8 text-center text-muted-foreground text-sm">Lead não encontrado</div>
        ) : (
          <div className="space-y-5">
            {/* Identity */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              {lead.email && (
                <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /><span className="truncate">{lead.email}</span></div>
              )}
              {lead.phone && (
                <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /><span>{lead.phone}</span></div>
              )}
              {(lead.city || lead.country) && (
                <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /><span>{[lead.city, lead.country].filter(Boolean).join(", ")}</span></div>
              )}
              {lead.fingerprint && (
                <div className="flex items-center gap-2"><Fingerprint className="h-4 w-4 text-muted-foreground" /><span className="font-mono text-xs truncate">{lead.fingerprint}</span></div>
              )}
            </div>

            {/* UTMs */}
            {(lead.utm_source || lead.utm_campaign || lead.utm_medium) && (
              <div className="flex flex-wrap gap-2">
                {lead.utm_source && <Badge variant="outline" className="border-primary/30 text-primary">src: {lead.utm_source}</Badge>}
                {lead.utm_medium && <Badge variant="outline">med: {lead.utm_medium}</Badge>}
                {lead.utm_campaign && <Badge variant="outline">camp: {lead.utm_campaign}</Badge>}
              </div>
            )}

            {/* Timeline */}
            <div>
              <h4 className="font-display text-sm font-bold mb-3">Timeline ({events.length})</h4>
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem eventos registados</p>
              ) : (
                <ol className="relative space-y-3 border-l border-border pl-5">
                  {events.map((e, i) => (
                    <li key={`${e.kind}-${i}`} className="relative">
                      <span className="absolute -left-[27px] flex h-5 w-5 items-center justify-center rounded-full bg-secondary border border-border">
                        {e.kind === "visit" && <Eye className="h-3 w-3 text-muted-foreground" />}
                        {e.kind === "cta" && <MousePointerClick className="h-3 w-3 text-primary" />}
                        {e.kind === "sale" && <ShoppingCart className="h-3 w-3 text-primary" />}
                      </span>
                      <div className="text-xs text-muted-foreground">
                        {new Date(e.date).toLocaleString("pt-MZ")}
                      </div>
                      <div className="text-sm mt-0.5">
                        {e.kind === "visit" && (
                          <span>Visitou <span className="font-mono text-xs text-muted-foreground truncate inline-block max-w-[300px] align-bottom">{(e.data as Lead).page_url || "—"}</span></span>
                        )}
                        {e.kind === "cta" && (
                          <span>Clicou em <span className="font-medium">"{(e.data as CTAClick).button_text || "CTA"}"</span></span>
                        )}
                        {e.kind === "sale" && (
                          <span className="text-primary font-medium">
                            Venda: {formatMzn(Number((e.data as Sale).amount_mzn) || 0)} — {(e.data as Sale).product_name || "—"}
                            <Badge className="ml-2" variant="outline">{(e.data as Sale).status}</Badge>
                            {(e.data as Sale).approved_at && <span className="ml-2 text-xs text-muted-foreground">aprovada {new Date((e.data as Sale).approved_at!).toLocaleDateString("pt-MZ")}</span>}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
