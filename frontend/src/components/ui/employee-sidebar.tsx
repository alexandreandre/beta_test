// src/components/ui/employee-sidebar.tsx

import { NavLink } from "react-router-dom";
import { Home, User, Wallet, Calendar, Receipt, FolderKanban, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

const navItems = [
  { to: "/", label: "Tableau de bord", icon: Home },
  { to: "/profile", label: "Profil", icon: User },
  { to: "/payslips", label: "Rémunération", icon: Wallet },
  { to: "/absences", label: "Congés & Absences", icon: Calendar },
  { to: "/calendar", label: "Calendrier", icon: Calendar },
  { to: "/expenses", label: "Notes de Frais", icon: Receipt },
  { to: "/documents", label: "Mes Documents", icon: FolderKanban },
];

export function EmployeeSidebar() {
  const { logout, user } = useAuth();

  const baseStyle = "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary";
  const activeStyle = "bg-muted text-primary";

  return (
    <div className="hidden border-r bg-muted/40 md:block">
      <div className="flex h-full max-h-screen flex-col gap-2">
        <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
          <a href="/" className="flex items-center gap-2 font-semibold">
            <span className="">Mon Espace</span>
          </a>
        </div>
        <div className="flex-1">
          <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
            {navItems.map((item) => (
              <NavLink
                key={item.label}
                to={item.to}
                end // 'end' est important pour que la route "/" ne soit active que pour le tableau de bord
                className={({ isActive }) => `${baseStyle} ${isActive ? activeStyle : ''}`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="mt-auto p-4">
          <Button size="sm" className="w-full" onClick={logout}><LogOut className="mr-2 h-4 w-4"/>Se déconnecter</Button>
        </div>
      </div>
    </div>
  );
}