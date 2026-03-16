import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider } from "@/contexts/AppContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import BottomNav from "@/components/BottomNav";
import Dashboard from "./pages/Dashboard";
import Operations from "./pages/Operations";
import Customers from "./pages/Customers";
import CustomerSheet from "./pages/CustomerSheet";
import Expenses from "./pages/Expenses";
import StaffPage from "./pages/Staff";
import StaffAttendance from "./pages/StaffAttendance";
import ProcurementPage from "./pages/Procurement";
import Payments from "./pages/Payments";
import CustomerBill from "./pages/CustomerBill";
import MonthlyReport from "./pages/MonthlyReport";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import JoinFarm from "./pages/JoinFarm";
import NotFound from "./pages/NotFound";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import OfflineIndicator from "@/components/OfflineIndicator";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const AppRoutes = () => (
  <div className="max-w-lg mx-auto min-h-screen bg-background relative">
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/join" element={<ProtectedRoute><JoinFarm /></ProtectedRoute>} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/operations" element={<ProtectedRoute><Operations /></ProtectedRoute>} />
      <Route path="/customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
      <Route path="/payments" element={<ProtectedRoute><Payments /></ProtectedRoute>} />
      <Route path="/customers/:customerId/sheet" element={<ProtectedRoute><CustomerSheet /></ProtectedRoute>} />
      <Route path="/customers/:customerId/bill" element={<ProtectedRoute><CustomerBill /></ProtectedRoute>} />
      <Route path="/report" element={<ProtectedRoute><MonthlyReport /></ProtectedRoute>} />
      <Route path="/expenses" element={<ProtectedRoute><Expenses /></ProtectedRoute>} />
      <Route path="/staff" element={<ProtectedRoute><StaffPage /></ProtectedRoute>} />
      <Route path="/staff/:staffId/attendance" element={<ProtectedRoute><StaffAttendance /></ProtectedRoute>} />
      <Route path="/procurement" element={<ProtectedRoute><ProcurementPage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
    <AuthBottomNav />
  </div>
);

function AuthBottomNav() {
  const { user } = useAuth();
  useOfflineSync();
  if (!user) return null;
  return <BottomNav />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <OfflineIndicator />
      <AppProvider>
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </AppProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
