// src/App.tsx

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/ui/app-sidebar";

// Import de toutes vos pages
import Dashboard from "./pages/Dashboard";
import Employees from "./pages/Employees";
import EmployeeDetail from "./pages/EmployeeDetail"; // <-- 1. IMPORTEZ LA PAGE DE DÉTAIL
import Rates from "./pages/Rates";
import NotFound from "./pages/NotFound";
import Payroll from './pages/Payroll';
import PayrollDetail from './pages/PayrollDetail';

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <SidebarProvider>
          <div className="min-h-screen flex w-full">
            <AppSidebar />
            <div className="flex-1 flex flex-col">
              <header className="h-14 flex items-center border-b bg-background px-4 lg:px-6">
                <SidebarTrigger className="mr-4" />
                <div className="flex-1" />
              </header>
              <main className="flex-1 p-6 lg:p-8">
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/employees" element={<Employees />} />
                  
                  {/* --- 2. AJOUTEZ LA ROUTE DYNAMIQUE ICI --- */}
                  <Route path="/employees/:employeeId" element={<EmployeeDetail />} />
                  
                  <Route path="/rates" element={<Rates />} />
                  <Route path="/payroll" element={<Payroll />} />
                  <Route path="/payroll/:employeeId" element={<PayrollDetail />} />

                  {/* La route "fourre-tout" doit toujours être en dernier */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </main>
            </div>
          </div>
        </SidebarProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;