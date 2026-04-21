import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Users, Fingerprint, Download, Flame } from "lucide-react";
import { DateFilter, getDefaultRange, type DateRange } from "@/components/DateFilter";
import { useIsMobile } from "@/hooks/use-mobile";
import { ScoreBar } from "@/components/leads/ScoreBar";
import { LeadDetailModal } from "@/components/leads/LeadDetailModal";
import { EmptyState } from "@/components/EmptyState";
import { downloadCSV } from "@/lib/format";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"leads_clicks">;

export default function Leads() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [convertedIds, setConvertedIds] = useState<Set<string>>(new Set());
  const [hotIds, setHotIds] = useState<Set<string>>(new Set());
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultRange);

  // Filters
  const [country, setCountry] = useState<string>("all");
  const [utm, setUtm] = useState<string>("all");
  const [minScore, setMinScore] = useState<string>("0");
  const [onlyConverted, setOnlyConverted] = useState(false);
  const [onlyHot, setOnlyHot] = useState(false);

  // Detail modal
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const from = dateRange.from.toISOString();
    const to = dateRange.to.toISOString();

    (async () => {
      const [{ data: leadsData }, { data: salesData }, { data: flagsData }] = await Promise.all([
        supabase.from("leads_clicks").select("*").gte("created_at", from).lte("created_at", to).order("created_at", { ascending: false }).limit(500),
        supabase.from("sales").select("lead_id").not("lead_id", "is", null),
        supabase.from("lead_flags").select("lead_id").eq("user_id", user.id).eq("is_hot", true),
      ]);

      setLeads(leadsData || []);
      setConvertedIds(new Set((salesData || []).map((s) => s.lead_id as string).filter(Boolean)));
      setHotIds(new Set((flagsData || []).map((f) => f.lead_id as string)));
    })();
  }, [user, dateRange]);

  // Distinct dropdown values
  const countries = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => l.country && set.add(l.country));
    return [...set].sort();
  }, [leads]);
  const utms = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => l.utm_source && set.add(l.utm_source));
    return [...set].sort();
  }, [leads]);

  const filtered = useMemo(() => {
    const min = Number(minScore) || 0;
    return leads.filter((l) => {
      if (country !== "all" && l.country !== country) return false;
      if (utm !== "all" && (l.utm_source || "") !== utm) return false;
      if ((l.lead_score || 0) < min) return false;
      if (onlyConverted && !convertedIds.has(l.id)) return false;
      if (onlyHot && !hotIds.has(l.id)) return false;
      return true;
    });
  }, [leads, country, utm, minScore, onlyConverted, onlyHot, convertedIds, hotIds]);

  const uniqueFingerprints = new Set(filtered.map((l) => l.fingerprint).filter(Boolean)).size;

  const toggleHot = async (leadId: string) => {
    if (!user) return;
    const isHot = hotIds.has(leadId);
    const next = new Set(hotIds);
    if (isHot) {
      next.delete(leadId);
      setHotIds(next);
      const { error } = await supabase.from("lead_flags").delete().eq("user_id", user.id).eq("lead_id", leadId);
      if (error) { toast.error("Erro ao remover marcação"); setHotIds(hotIds); }
    } else {
      next.add(leadId);
      setHotIds(next);
      const { error } = await supabase.from("lead_flags").upsert({ user_id: user.id, lead_id: leadId, is_hot: true }, { onConflict: "user_id,lead_id" });
      if (error) { toast.error("Erro ao marcar como hot"); setHotIds(hotIds); }
      else toast.success("Lead marcado como hot 🔥");
    }
  };

  const handleExport = () => {
    if (filtered.length === 0) { toast.error("Sem leads para exportar"); return; }
    const rows = filtered.map((l) => ({
      created_at: l.created_at,
      score: l.lead_score || 0,
      converted: convertedIds.has(l.id) ? "yes" : "no",
      hot: hotIds.has(l.id) ? "yes" : "no",
      email: l.email || "",
      phone: l.phone || "",
      name: l.name || "",
      country: l.country || "",
      city: l.city || "",
      utm_source: l.utm_source || "",
      utm_medium: l.utm_medium || "",
      utm_campaign: l.utm_campaign || "",
      page_url: l.page_url || "",
      fingerprint: l.fingerprint || "",
    }));
    downloadCSV(`leads_${new Date().toISOString().split("T")[0]}.csv`, rows);
    toast.success(`${rows.length} leads exportados`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Leads</h1>
          <p className="text-muted-foreground">Todos os visitantes rastreados com score de qualificação IA</p>
        </div>
        <DateFilter value={dateRange} onChange={setDateRange} />
      </div>

      {/* Metrics */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <Card className="glass-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"><Users className="h-5 w-5 text-primary" /></div>
            <div><p className="text-xs text-muted-foreground">Total filtrado</p><p className="font-display text-xl font-bold">{filtered.length}</p></div>
          </CardContent>
        </Card>
        <Card className="glass-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"><Fingerprint className="h-5 w-5 text-primary" /></div>
            <div><p className="text-xs text-muted-foreground">Fingerprints únicos</p><p className="font-display text-xl font-bold">{uniqueFingerprints}</p></div>
          </CardContent>
        </Card>
        <Card className="glass-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"><Flame className="h-5 w-5 text-primary" /></div>
            <div><p className="text-xs text-muted-foreground">Marcados hot</p><p className="font-display text-xl font-bold">{hotIds.size}</p></div>
          </CardContent>
        </Card>
        <Card className="glass-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"><Users className="h-5 w-5 text-primary" /></div>
            <div><p className="text-xs text-muted-foreground">Convertidos</p><p className="font-display text-xl font-bold">{filtered.filter((l) => convertedIds.has(l.id)).length}</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="glass-card border-border">
        <CardContent className="p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <Select value={country} onValueChange={setCountry}>
            <SelectTrigger><SelectValue placeholder="País" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os países</SelectItem>
              {countries.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={utm} onValueChange={setUtm}>
            <SelectTrigger><SelectValue placeholder="UTM Source" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as origens</SelectItem>
              {utms.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="number" min={0} max={100} value={minScore} onChange={(e) => setMinScore(e.target.value)} placeholder="Score mínimo" />
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={onlyConverted} onCheckedChange={setOnlyConverted} />
            <span>Só convertidos</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={onlyHot} onCheckedChange={setOnlyHot} />
            <span>Só hot 🔥</span>
          </label>
          <Button variant="outline" onClick={handleExport} className="gap-2">
            <Download className="h-4 w-4" /> CSV
          </Button>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        leads.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Sem leads ainda"
            description="Cria uma página em /pages e instala o script de tracking no teu site. Cada visitante aparecerá aqui com score, geo e timeline."
            ctaLabel="Criar primeira página"
            ctaHref="/pages"
          />
        ) : (
          <EmptyState
            icon={Users}
            title="Nenhum lead corresponde aos filtros"
            description="Ajusta o país, UTM source ou score mínimo no painel de filtros acima."
          />
        )
      ) : isMobile ? (
        <div className="space-y-3">
          {filtered.map((l) => {
            const isHot = hotIds.has(l.id);
            const converted = convertedIds.has(l.id);
            return (
              <Card key={l.id} className="glass-card border-border">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <ScoreBar score={l.lead_score || 0} />
                    <button onClick={() => toggleHot(l.id)} className={`p-1 rounded ${isHot ? "text-orange-400" : "text-muted-foreground"}`}>
                      <Flame className="h-4 w-4" />
                    </button>
                  </div>
                  <button onClick={() => setOpenLeadId(l.id)} className="block w-full text-left">
                    {l.email && <p className="text-sm font-medium truncate">{l.email}</p>}
                    <div className="flex flex-wrap items-center gap-2 text-xs mt-1">
                      <Badge variant="outline" className="border-primary/30 text-primary">{l.utm_source || "direto"}</Badge>
                      {converted && <Badge className="bg-primary/20 text-primary">Convertido</Badge>}
                      <span className="text-muted-foreground">{new Date(l.created_at).toLocaleDateString("pt-MZ")}</span>
                    </div>
                    {(l.city || l.country) && <p className="text-xs text-muted-foreground mt-1">{[l.city, l.country].filter(Boolean).join(", ")}</p>}
                  </button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="glass-card border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="w-[150px]">Score</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>UTM Source</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>País</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="w-[60px]">🔥</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((l) => {
                const isHot = hotIds.has(l.id);
                const converted = convertedIds.has(l.id);
                return (
                  <TableRow key={l.id} className="border-border cursor-pointer hover:bg-secondary/20" onClick={() => setOpenLeadId(l.id)}>
                    <TableCell><ScoreBar score={l.lead_score || 0} /></TableCell>
                    <TableCell className="text-sm">{l.email || "—"}</TableCell>
                    <TableCell><Badge variant="outline" className="border-primary/30 text-primary">{l.utm_source || "direto"}</Badge></TableCell>
                    <TableCell className="text-sm">{l.city || "—"}</TableCell>
                    <TableCell className="text-sm">{l.country || "—"}</TableCell>
                    <TableCell>{converted ? <Badge className="bg-primary/20 text-primary">Convertido</Badge> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(l.created_at).toLocaleDateString("pt-MZ")}</TableCell>
                    <TableCell onClick={(e) => { e.stopPropagation(); toggleHot(l.id); }}>
                      <button className={`p-1 rounded ${isHot ? "text-orange-400" : "text-muted-foreground hover:text-orange-400"}`}>
                        <Flame className="h-4 w-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <LeadDetailModal leadId={openLeadId} open={!!openLeadId} onOpenChange={(o) => !o && setOpenLeadId(null)} />
    </div>
  );
}
