import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Fingerprint } from "lucide-react";
import { DateFilter, getDefaultRange, type DateRange } from "@/components/DateFilter";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"leads_clicks">;

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 70 ? "bg-primary/20 text-primary" : score >= 40 ? "bg-yellow-500/20 text-yellow-400" : "bg-destructive/20 text-destructive";
  return <Badge className={color}>{score}</Badge>;
}

export default function Leads() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultRange);

  useEffect(() => {
    if (!user) return;
    const from = dateRange.from.toISOString();
    const to = dateRange.to.toISOString();
    supabase
      .from("leads_clicks")
      .select("*")
      .gte("created_at", from)
      .lte("created_at", to)
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }) => {
        if (data) setLeads(data);
      });
  }, [user, dateRange]);

  const uniqueFingerprints = new Set(leads.map(l => l.fingerprint).filter(Boolean)).size;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Leads</h1>
          <p className="text-muted-foreground">Todos os visitantes rastreados com score de qualificação IA</p>
        </div>
        <DateFilter value={dateRange} onChange={setDateRange} />
      </div>

      {/* Fingerprint metric */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3">
        <Card className="glass-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Leads</p>
              <p className="font-display text-xl font-bold">{leads.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Fingerprint className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Fingerprints Únicos</p>
              <p className="font-display text-xl font-bold">{uniqueFingerprints}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {leads.length === 0 ? (
        <Card className="glass-card border-border">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">Nenhum lead capturado ainda</p>
          </CardContent>
        </Card>
      ) : isMobile ? (
        /* Mobile: stacked cards */
        <div className="space-y-3">
          {leads.map((l) => (
            <Card key={l.id} className="glass-card border-border">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <ScoreBadge score={l.lead_score || 0} />
                  <span className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleDateString("pt-MZ")}</span>
                </div>
                {l.email && <p className="text-sm font-medium truncate">{l.email}</p>}
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline" className="border-primary/30 text-primary">{l.utm_source || "direto"}</Badge>
                  {l.utm_campaign && <span className="text-muted-foreground">{l.utm_campaign}</span>}
                </div>
                <div className="flex gap-4 text-xs text-muted-foreground">
                  {l.city && <span>{l.city}</span>}
                  {l.country && <span>{l.country}</span>}
                </div>
                {l.fingerprint && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Fingerprint className="h-3 w-3" />
                    <span className="font-mono">{l.fingerprint}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        /* Desktop: table */
        <Card className="glass-card border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead>Score</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Fingerprint</TableHead>
                <TableHead>UTM Source</TableHead>
                <TableHead>UTM Campaign</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>País</TableHead>
                <TableHead>Página</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((l) => (
                <TableRow key={l.id} className="border-border">
                  <TableCell><ScoreBadge score={l.lead_score || 0} /></TableCell>
                  <TableCell className="text-sm">{l.email || "—"}</TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">{l.fingerprint || "—"}</TableCell>
                  <TableCell><Badge variant="outline" className="border-primary/30 text-primary">{l.utm_source || "direto"}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{l.utm_campaign || "—"}</TableCell>
                  <TableCell className="text-sm">{l.city || "—"}</TableCell>
                  <TableCell className="text-sm">{l.country || "—"}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">{l.page_url || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(l.created_at).toLocaleDateString("pt-MZ")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
