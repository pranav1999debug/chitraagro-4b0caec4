import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider } from "@/contexts/AppContext";
import BottomNav from "@/components/BottomNav";
import Dashboard from "./pages/Dashboard";
import Operations from "./pages/Operations";
import Customers from "./pages/Customers";
import Expenses from "./pages/Expenses";
import StaffPage from "./pages/Staff";
import StaffAttendance from "./pages/StaffAttendance";
import ProcurementPage from "./pages/Procurement";
import Payments from "./pages/Payments";
import CustomerBill from "./pages/CustomerBill";
import MonthlyReport from "./pages/MonthlyReport";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <AppProvider>
        <BrowserRouter>
          <div className="max-w-lg mx-auto min-h-screen bg-background relative">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/operations" element={<Operations />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/payments" element={<Payments />} />
              <Route path="/customers/:customerId/bill" element={<CustomerBill />} />
              <Route path="/report" element={<MonthlyReport />} />
              <Route path="/expenses" element={<Expenses />} />
              <Route path="/staff" element={<StaffPage />} />
              <Route path="/staff/:staffId/attendance" element={<StaffAttendance />} />
              <Route path="/procurement" element={<ProcurementPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            <BottomNav />
          </div>
        </BrowserRouter>
      </AppProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
