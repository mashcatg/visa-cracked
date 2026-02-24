import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, RequireAuth, RequireAdmin } from "@/lib/auth";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import DashboardPage from "./pages/DashboardPage";
import InterviewRoom from "./pages/InterviewRoom";
import InterviewReportPage from "./pages/InterviewReportPage";
import AdminPage from "./pages/AdminPage";
import NotFound from "./pages/NotFound";
import PublicReportPage from "./pages/PublicReportPage";
import PaymentResult from "./pages/PaymentResult";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/dashboard" element={<RequireAuth><DashboardPage /></RequireAuth>} />
              <Route path="/interview/:id/room" element={<RequireAuth><InterviewRoom /></RequireAuth>} />
              <Route path="/interview/:id/report" element={<RequireAuth><InterviewReportPage /></RequireAuth>} />
              <Route path="/mock/:id/public" element={<PublicReportPage />} />
              <Route path="/payment/success" element={<PaymentResult />} />
              <Route path="/payment/fail" element={<PaymentResult />} />
              <Route path="/payment/cancel" element={<PaymentResult />} />
              <Route path="/admin/*" element={<RequireAuth><RequireAdmin><AdminPage /></RequireAdmin></RequireAuth>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
