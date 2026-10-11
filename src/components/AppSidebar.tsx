import {
  LayoutDashboard, Megaphone, Video, Film, Music2,
  LayoutGrid, Link2, Plug, Wrench, Percent, DollarSign,
  FileText, Activity, Bell, Settings, LogOut, Radar, ChevronDown, Plus, ShoppingCart, Users, Bug
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboard } from "@/contexts/DashboardContext";
import { Badge } from "@/components/ui/badge";

// Menu inspirado diretamente na UTMify
const navSections = [
  {
    title: "PRINCIPAL",
    items: [
      { label: "Resumo", icon: LayoutDashboard, href: "/" },
      { label: "Meta", icon: Megaphone, href: "/campaigns" },
      { label: "UTMs", icon: Link2, href: "/tracking-links" },
      { label: "Vendas", icon: ShoppingCart, href: "/sales" },
      { label: "Leads", icon: Users, href: "/leads" },
      { label: "Páginas", icon: FileText, href: "/pages" },
    ],
  },
  {
    title: "TRACKING & DADOS",
    items: [
      { label: "Eventos", icon: Activity, href: "/tracking" },
      { label: "Testar Tracking", icon: Bug, href: "/test-tracking" },
      { label: "Integrações", icon: Plug, href: "/integrations" },
    ],
  },
  {
    title: "CONFIGURAÇÕES",
    items: [
      { label: "Dashboards", icon: LayoutGrid, href: "/dashboards" },
      { label: "Notificações", icon: Bell, href: "/notifications" },
      { label: "Configurações", icon: Settings, href: "/settings" },
    ],
  },
];

export function AppSidebar() {
  const location = useLocation();
  const { signOut } = useAuth();
  const { current, dashboards, selectDashboard } = useDashboard();

  return (
    <aside className="w-64 border-r border-border bg-[#0a0a0c]/90 backdrop-blur-2xl flex flex-col h-screen sticky top-0 select-none z-30">
      {/* 1. Header com Logo NexusTrack */}
      <div className="p-4 flex items-center justify-between border-b border-border/40">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="h-9 w-9 rounded-xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/20 transition-transform group-hover:scale-105">
            <Radar className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-display font-bold text-base text-foreground tracking-tight">
                Nexus<span className="text-primary">Track</span>
              </span>
            </div>
            <span className="text-[10px] text-primary font-mono tracking-wider font-semibold uppercase block -mt-0.5">
              Intelligence v2
            </span>
          </div>
        </Link>
      </div>

      {/* 2. Seletor de Dashboard no estilo UTMify */}
      <div className="px-3 py-2.5 border-b border-border/40 bg-muted/10">
        <div className="flex items-center justify-between mb-1.5 px-1">
          <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase font-mono">
            Dashboard Ativa
          </span>
          <Link
            to="/dashboards"
            className="text-[11px] text-primary hover:underline flex items-center gap-0.5"
            title="Gerenciar Dashboards"
          >
            <Plus className="h-3 w-3" /> Gerir
          </Link>
        </div>

        {dashboards.length === 0 ? (
          <Link
            to="/dashboards"
            className="flex items-center justify-between p-2 rounded-lg border border-dashed border-border/60 hover:border-primary/50 text-xs text-muted-foreground hover:text-foreground transition-all group"
          >
            <span>+ Criar primeira dashboard</span>
            <Badge variant="outline" className="text-[9px]">Novo</Badge>
          </Link>
        ) : (
          <div className="relative">
            <select
              value={current?.id || ""}
              onChange={(e) => selectDashboard(e.target.value)}
              className="w-full appearance-none bg-card border border-border/80 hover:border-border text-foreground text-xs font-medium rounded-lg py-2 pl-3 pr-8 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer transition-all shadow-sm"
            >
              {dashboards.map((d) => (
                <option key={d.id} value={d.id} className="bg-card text-foreground">
                  {d.name} ({d.currency}) {d.kind === "organic" ? "• Orgânica" : ""}
                </option>
              ))}
            </select>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        )}
      </div>

      {/* 3. Navegação Vertical Estilo UTMify */}
      <nav className="flex-1 px-2.5 py-3 space-y-4 overflow-y-auto">
        {navSections.map((sec) => (
          <div key={sec.title} className="space-y-1">
            <p className="px-3 text-[10px] font-semibold text-muted-foreground/60 tracking-wider uppercase font-mono mb-1">
              {sec.title}
            </p>
            <div className="space-y-0.5">
              {sec.items.map((item) => {
                const isActive = location.pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all group relative ${
                      isActive
                        ? "bg-primary/10 text-primary font-semibold shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    }`}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-r-full" />
                    )}
                    <Icon
                      className={`h-4 w-4 shrink-0 transition-colors ${
                        isActive
                          ? "text-primary"
                          : "text-muted-foreground group-hover:text-foreground"
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* 4. Footer com Botão Sair */}
      <div className="p-3 border-t border-border/40 bg-muted/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[11px] text-muted-foreground font-mono">Status: Online</span>
        </div>
        <button
          onClick={() => signOut()}
          className="text-muted-foreground hover:text-destructive text-xs flex items-center gap-1.5 transition-colors p-1 rounded hover:bg-destructive/10"
          title="Encerrar sessão"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Sair</span>
        </button>
      </div>
    </aside>
  );
}