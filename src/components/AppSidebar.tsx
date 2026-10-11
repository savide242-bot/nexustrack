import { Bug,
  BarChart3, Megaphone, FileText, ShoppingCart, Users,
  Radar, Plug, Bell, Settings, LayoutDashboard, Link2
} from "lucide-react";
import { Bug, NavLink } from "@/components/NavLink";
import { Bug, useLocation } from "react-router-dom";
import { Bug, DashboardSelector } from "@/components/dashboard-v2/DashboardSelector";

const navItems = [
  { title: "Visão Geral", icon: BarChart3, href: "/" },
  { title: "Dashboards", icon: LayoutDashboard, href: "/dashboards" },
  { title: "Links UTM (Tracking)", icon: Link2, href: "/tracking-links" },
  { title: "Campanhas", icon: Megaphone, href: "/campaigns" },
  { title: "Páginas", icon: FileText, href: "/pages" },
  { title: "Vendas", icon: ShoppingCart, href: "/sales" },
  { title: "Leads", icon: Users, href: "/leads" },
  { title: "Tracking CAPI", icon: Radar, href: "/tracking" },
  { title: "Testar Tracking", icon: Bug, href: "/test-tracking" },
  { title: "Integrações", icon: Plug, href: "/integrations" },
  { title: "Notificações", icon: Bell, href: "/notifications" },
  { title: "Configurações", icon: Settings, href: "/settings" },
];

export function AppSidebar() {
  const location = useLocation();

  return (
    <aside className="w-64 border-r border-border bg-card/50 backdrop-blur-xl flex flex-col h-screen sticky top-0">
      {/* Brand Logo */}
      <div className="p-5 flex items-center gap-3 border-b border-border">
        <div className="h-9 w-9 rounded-xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/20">
          <Radar className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h2 className="font-display font-bold text-lg text-foreground tracking-tight leading-none">
            NexusTrack
          </h2>
          <span className="text-[10px] text-primary font-mono tracking-wider font-semibold uppercase">
            Intelligence v2
          </span>
        </div>
      </div>

      {/* Seletor Dinâmico de Dashboards */}
      <div className="pt-3 pb-1 border-b border-border/50">
        <DashboardSelector />
      </div>

      {/* Navigation List */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <NavLink
              key={item.href}
              href={item.href}
              icon={item.icon}
              active={isActive}
            >
              {item.title}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-4 border-t border-border text-[11px] text-muted-foreground flex justify-between items-center">
        <span>NexusTrack SaaS</span>
        <span className="text-primary font-mono font-bold">PRO</span>
      </div>
    </aside>
  );
}