import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { DashboardProvider } from "@/contexts/DashboardContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Index from "./pages/Index";
import DashboardsPage from "./pages/DashboardsPage";
import TrackingLinks from "./pages/TrackingLinks";
import Campaigns from "./pages/Campaigns";
import Pages from "./pages/Pages";
import Sales from "./pages/Sales";
import Leads from "./pages/Leads";
import Tracking from "./pages/Tracking";
import Integrations from "./pages/Integrations";
import Notifications from "./pages/Notifications";
import SettingsPage from "./pages/SettingsPage";
import TrackingTest from "./pages/TrackingTest";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <DashboardProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/" element={<Index />} />
                <Route path="/dashboards" element={<DashboardsPage />} />
                <Route path="/tracking-links" element={<TrackingLinks />} />
                <Route path="/campaigns" element={<Campaigns />} />
                <Route path="/pages" element={<Pages />} />
                <Route path="/sales" element={<Sales />} />
                <Route path="/leads" element={<Leads />} />
                <Route path="/tracking" element={<Tracking />} />
                <Route path="/test-tracking" element={<TrackingTest />} />
                <Route path="/integrations" element={<Integrations />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </DashboardProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;