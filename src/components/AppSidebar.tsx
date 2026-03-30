import { BarChart3, Megaphone, ShoppingCart, Users, Settings, Plug, Bell, LogOut, Zap, FileText, Radar } from "lucide-react";
import { useLocation, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Dashboard", icon: BarChart3, href: "/" },
  { title: "Campanhas", icon: Megaphone, href: "/campaigns" },
  { title: "Páginas", icon: FileText, href: "/pages" },
  { title: "Vendas", icon: ShoppingCart, href: "/sales" },
  { title: "Leads", icon: Users, href: "/leads" },
  { title: "Tracking CAPI", icon: Radar, href: "/tracking" },
  { title: "Integrações", icon: Plug, href: "/integrations" },
  { title: "Notificações", icon: Bell, href: "/notifications" },
  { title: "Configurações", icon: Settings, href: "/settings" },
];

export function AppSidebar() {
  const location = useLocation();
  const { signOut } = useAuth();
  const { setOpenMobile } = useSidebar();

  const handleLinkClick = () => {
    setOpenMobile(false);
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-border">
        <Link to="/" className="flex items-center gap-2" onClick={handleLinkClick}>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary">
            <Zap className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-lg font-bold text-foreground">
            Nexus<span className="neon-text">Track</span>
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === item.href}
                    tooltip={item.title}
                  >
                    <Link to={item.href} onClick={handleLinkClick}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-2 border-t border-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => { handleLinkClick(); signOut(); }} tooltip="Sair">
              <LogOut className="h-4 w-4" />
              <span>Sair</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
