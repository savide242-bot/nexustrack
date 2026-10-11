import { useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { AppSidebar, SidebarNavContent } from "@/components/AppSidebar";
import { useDashboard } from "@/contexts/DashboardContext";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Menu, MoreVertical, LayoutDashboard, Megaphone, Link2, Settings,
  Radar, LayoutGrid, X
} from "lucide-react";
import { RevenueProgress } from "@/components/RevenueProgress";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";

function ShortcutsBridge() {
  useKeyboardShortcuts();
  return null;
}

export function AppLayout() {
  const location = useLocation();
  const { current } = useDashboard();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Itens da barra de navegação inferior estilo UTMify (fotos 1-5)
  const bottomNavItems = [
    { label: "Resumo", icon: LayoutDashboard, href: "/" },
    { label: "Meta", icon: Megaphone, href: "/campaigns" },
    { label: "UTMs", icon: Link2, href: "/tracking-links" },
    { label: "Dashboards", icon: LayoutGrid, href: "/dashboards" },
  ];

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <ShortcutsBridge />

      {/* 1. Sidebar Fixa apenas no Desktop (hidden no mobile) */}
      <AppSidebar />

      {/* 2. Conteúdo Principal */}
      <div className="flex-1 flex flex-col min-w-0 w-full">
        {/* Header no Mobile (Idêntico ao topo da UTMify nas fotos) */}
        <header className="flex md:hidden items-center justify-between px-4 py-3 border-b border-border bg-[#0a0a0c]/90 backdrop-blur-xl sticky top-0 z-20">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg gradient-primary flex items-center justify-center">
              <Radar className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-sm tracking-tight">
              Nexus<span className="text-primary">Track</span>
            </span>
          </Link>

          {/* Nome da Dashboard Ativa no Centro */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border/80 bg-muted/20 text-xs font-semibold">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            <span className="truncate max-w-[120px]">{current?.name || "Principal"}</span>
            <span className="text-[10px] text-muted-foreground font-mono">({current?.currency || "MZN"})</span>
          </div>

          {/* Botão de 3 Pontinhos / Menu no Topo */}
          <Sheet open={mobileDrawerOpen} onOpenChange={setMobileDrawerOpen}>
            <SheetTrigger asChild>
              <button
                className="p-1.5 rounded-lg border border-border bg-card/60 text-muted-foreground hover:text-foreground"
                aria-label="Abrir Menu"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72 bg-[#0a0a0c] border-r border-border">
              <SidebarNavContent onItemClick={() => setMobileDrawerOpen(false)} />
            </SheetContent>
          </Sheet>
        </header>

        {/* Header no Desktop */}
        <header className="hidden md:flex items-center justify-between border-b border-border/50 px-6 py-2.5 bg-card/20">
          <div className="text-xs text-muted-foreground font-mono">
            Dashboard: <strong className="text-foreground">{current?.name || "Principal"}</strong> ({current?.currency || "MZN"})
          </div>
          <RevenueProgress />
        </header>

        {/* Área de Visualização das Páginas */}
        <main className="flex-1 p-3.5 pb-24 md:p-6 md:pb-6 overflow-x-hidden">
          <Outlet />
        </main>

        {/* 3. Barra de Navegação Inferior no Mobile (Fotos 1 a 5 da UTMify) */}
        <nav className="flex md:hidden fixed bottom-0 left-0 right-0 border-t border-border/60 bg-[#0a0a0c]/95 backdrop-blur-2xl z-30 px-2 py-1.5 justify-around items-center shadow-2xl">
          {bottomNavItems.map((item) => {
            const isActive = location.pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg text-[10px] font-medium transition-all ${
                  isActive
                    ? "text-primary font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className={`h-5 w-5 mb-0.5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}

          {/* Botão "Menu" com 3 tracinhos para abrir o menu completo */}
          <Sheet open={mobileDrawerOpen} onOpenChange={setMobileDrawerOpen}>
            <SheetTrigger asChild>
              <button
                className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg text-[10px] font-medium transition-all ${
                  mobileDrawerOpen ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Menu className="h-5 w-5 mb-0.5" />
                <span>Menu</span>
              </button>
            </SheetTrigger>
          </Sheet>
        </nav>
      </div>
    </div>
  );
}