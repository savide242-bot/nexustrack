import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Copy, Check, Megaphone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type Campaign = Tables<"campaigns">;

export default function Campaigns() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const fetchCampaigns = async () => {
    if (!user) return;
    const { data } = await supabase.from("campaigns").select("*").order("created_at", { ascending: false });
    if (data) setCampaigns(data);
  };

  useEffect(() => { fetchCampaigns(); }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    const { error } = await supabase.from("campaigns").insert({ name, domain, user_id: user.id });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Campanha criada!" });
      setOpen(false);
      setName("");
      setDomain("");
      fetchCampaigns();
    }
    setLoading(false);
  };

  const getTrackingScript = (campaignId: string) => {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "your-project";
    return `<script>
(function(){
  var cid="${campaignId}";
  var u=new URLSearchParams(location.search);
  var fp=btoa(navigator.userAgent+screen.width+screen.height+new Date().getTimezoneOffset());
  var d={
    campaign_id:cid,
    fingerprint:fp,
    utm_source:u.get("utm_source"),
    utm_medium:u.get("utm_medium"),
    utm_campaign:u.get("utm_campaign"),
    utm_content:u.get("utm_content"),
    utm_term:u.get("utm_term"),
    referrer:document.referrer,
    page_url:location.href,
    fbc:u.get("fbclid")||null,
    fbp:document.cookie.match(/_fbp=([^;]+)/)?.[1]||null
  };
  fetch("https://${projectId}.supabase.co/functions/v1/track",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(d)
  });
  document.addEventListener("click",function(e){
    var t=e.target.closest("a,button,[data-cta]");
    if(t){
      fetch("https://${projectId}.supabase.co/functions/v1/track-cta",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({campaign_id:cid,button_id:t.id||"",button_text:t.innerText||"",page_url:location.href})
      });
    }
  });
})();
</script>`;
  };

  const copyScript = (id: string) => {
    navigator.clipboard.writeText(getTrackingScript(id));
    setCopied(id);
    toast({ title: "Script copiado!" });
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Campanhas</h1>
          <p className="text-muted-foreground">Gerencie campanhas e copie o script de rastreio</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary text-primary-foreground"><Plus className="mr-2 h-4 w-4" />Nova Campanha</Button>
          </DialogTrigger>
          <DialogContent className="glass-card border-border">
            <DialogHeader>
              <DialogTitle className="font-display">Nova Campanha</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label>Nome da Campanha</Label>
                <Input placeholder="Ex: Black Friday 2026" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Domínio (opcional)</Label>
                <Input placeholder="www.seusite.com" value={domain} onChange={(e) => setDomain(e.target.value)} />
              </div>
              <Button type="submit" className="w-full gradient-primary text-primary-foreground" disabled={loading}>
                {loading ? "Criando..." : "Criar Campanha"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {campaigns.length === 0 ? (
        <Card className="glass-card border-border">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Megaphone className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">Nenhuma campanha ainda. Crie a primeira!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {campaigns.map((c) => (
            <Card key={c.id} className="glass-card border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="font-display text-lg">{c.name}</CardTitle>
                <Badge variant={c.is_active ? "default" : "secondary"} className={c.is_active ? "bg-primary/20 text-primary" : ""}>
                  {c.is_active ? "Ativa" : "Inativa"}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                {c.domain && <p className="text-sm text-muted-foreground">{c.domain}</p>}
                <p className="text-xs text-muted-foreground">ID: {c.id.slice(0, 8)}...</p>
                <Button variant="outline" size="sm" onClick={() => copyScript(c.id)} className="w-full border-primary/30 text-primary hover:bg-primary/10">
                  {copied === c.id ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                  {copied === c.id ? "Copiado!" : "Copiar Script de Rastreio"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
