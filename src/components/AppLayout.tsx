import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet } from "react-router-dom";
import { useSidebar } from "@/components/ui/sidebar";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

function MobileHeader() {
  const { toggleSidebar } = useSidebar();

  return (
    <div className="flex items-center gap-2 border-b border-border p-4 md:hidden">
      <Button variant="ghost" size="icon" onClick={toggleSidebar} className="h-8 w-8">
        <Menu className="h-5 w-5" />
        <span className="sr-only">Menu</span>
      </Button>
      <span className="font-display font-bold neon-text">NexusTrack</span>
    </div>
  );
}

export function AppLayout() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <MobileHeader />
          <div className="p-4 md:p-6 lg:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
