// src/App.tsx (VERSION COMPLÈTE ET CORRIGÉE)

import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';

// --- Fournisseurs de contexte et composants globaux ---
import { AuthProvider, useAuth } from './contexts/AuthContext'; // À CRÉER
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/ui/app-sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Loader2 } from 'lucide-react';

// --- Pages ---
import LoginPage from './pages/Login'; // À CRÉER
// Pages RH
import RhDashboard from "./pages/Dashboard";
import Employees from "./pages/Employees";
import EmployeeDetail from "./pages/EmployeeDetail";
import Rates from "./pages/Rates";
import Payroll from './pages/Payroll';
import PayrollDetail from './pages/PayrollDetail';
import Saisies from './pages/Saisies';
// --- Pages Salarié (NOUVEAU) ---
import { EmployeeSidebar } from '@/components/ui/employee-sidebar'; // NOUVEAU
import EmployeeDashboard from './pages/employee/Dashboard';
import ProfilePage from './pages/employee/Profile';
import PayslipsPage from './pages/employee/Payslips';
import AbsencesPage from './pages/employee/Absences';
import EmployeeCalendarPage from './pages/employee/Calendar'; // NOUVEAU
import ExpensesPage from './pages/employee/Expenses';
import DocumentsPage from './pages/employee/Documents';
// Page par défaut
import NotFound from "./pages/NotFound";

/**
 * Layout pour l'espace Salarié, avec sa propre barre de navigation.
 */
function EmployeeLayout() {
  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <EmployeeSidebar />
      <main className="flex-1 p-6 lg:p-8 overflow-auto"><Outlet /></main>
    </div>
  );
}
/**
 * Ce composant gère les routes protégées. Il vérifie si un utilisateur est connecté
 * et quel est son rôle, puis affiche la bonne interface.
 */
function ProtectedRoutes() {
  const { user, isLoading } = useAuth();

  // 1. Afficher un indicateur de chargement pendant la vérification de l'authentification
  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // 2. Si pas d'utilisateur, rediriger vers la page de connexion
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 3. Si l'utilisateur est un Salarié, afficher l'interface Salarié (sans sidebar RH)
  if (user.role === 'salarie') {
    return (
      <Routes>
        <Route element={<EmployeeLayout />}>
          <Route path="/" element={<EmployeeDashboard />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/payslips" element={<PayslipsPage />} />
          <Route path="/absences" element={<AbsencesPage />} />
          <Route path="/calendar" element={<EmployeeCalendarPage />} />
          <Route path="/expenses" element={<ExpensesPage />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    );
  }

  // 4. Si c'est un RH (ou un autre rôle admin), afficher le layout complet
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center border-b bg-background px-4 lg:px-6">
            <SidebarTrigger className="mr-4" />
            <div className="flex-1" />
            {/* Ajouter ici le profil utilisateur, notifications, etc. */}
          </header>
          <main className="flex-1 p-6 lg:p-8">
            <Routes>
              <Route path="/" element={<RhDashboard />} />
              <Route path="/employees" element={<Employees />} />
              <Route path="/employees/:employeeId" element={<EmployeeDetail />} />
              <Route path="/saisies" element={<Saisies />} />
              <Route path="/rates" element={<Rates />} />
              <Route path="/payroll" element={<Payroll />} />
              <Route path="/payroll/:employeeId" element={<PayrollDetail />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}


/**
 * Le composant racine de l'application.
 * Il met en place les fournisseurs de contexte et le routeur principal.
 */
export default function App() {
  return (
    <TooltipProvider>
      <Toaster />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/*" element={<ProtectedRoutes />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  );
}