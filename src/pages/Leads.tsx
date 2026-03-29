import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"leads_clicks">;

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 70 ? "bg-primary/20 text-primary" : score >= 40 ? "bg-yellow-500/20 text-yellow-400" : "bg-destructive/20 text-destructive";
  return <Badge className={color}>{score}</Badge>;
}

export default function Leads() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("leads_clicks").select("*").order("created_at", { ascending: false }).limit(200).then(({ data }) => {
      if (data) setLeads(data);
    });
  }, [user]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Leads</h1>
        <p className="text-muted-foreground">Todos os visitantes rastreados com score de qualificação IA</p>
      </div>

      {leads.length === 0 ? (
        <Card className="glass-card border-border">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">Nenhum lead capturado ainda</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="glass-card border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead>Score</TableHead>
                <TableHead>Email</TableHead>
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
