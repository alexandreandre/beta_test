import { useState } from "react";
import { 
  LayoutDashboard, 
  Users, 
  Calculator, 
  Calendar, 
  TrendingUp,
  UsersRound,
  ClipboardCheck,
  User,
  FileText,
  FolderOpen,
  Plus,
  LogOut
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

// Mock user for demo - in real app this would come from auth context
const mockUser = {
  name: "Marie Dupont",
  role: "rh", // "rh" | "manager" | "employee"
  initials: "MD",
  email: "marie.dupont@entreprise.fr"
};

const menuItems = {
  rh: [
    { title: "Tableau de Bord", url: "/", icon: LayoutDashboard },
    { title: "Salariés", url: "/employees", icon: Users },
    { title: "Paie", url: "/payroll", icon: Calculator },
    { title: "Congés & Absences", url: "/leaves", icon: Calendar },
    { title: "Suivi des Taux", url: "/rates", icon: TrendingUp },
  ],
  manager: [
    { title: "Mon Équipe", url: "/team", icon: UsersRound },
    { title: "Demandes à valider", url: "/leave-requests", icon: ClipboardCheck },
  ],
  employee: [
    { title: "Mon Espace", url: "/", icon: User },
    { title: "Mes Bulletins de paie", url: "/payslips", icon: FileText },
    { title: "Mes Documents", url: "/documents", icon: FolderOpen },
    { title: "Faire une demande de congé", url: "/request-leave", icon: Plus },
  ]
};

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const currentPath = location.pathname;
  
  const userRole = mockUser.role as keyof typeof menuItems;
  const items = menuItems[userRole] || [];

  const isActive = (path: string) => {
    if (path === "/") {
      return currentPath === "/";
    }
    return currentPath.startsWith(path);
  };

  const getNavClassName = (path: string) => {
    const baseClasses = "flex items-center gap-3 rounded-lg px-3 py-2 transition-all duration-200 hover:bg-primary/10";
    return isActive(path) 
      ? `${baseClasses} bg-primary text-primary-foreground shadow-sm` 
      : `${baseClasses} text-muted-foreground hover:text-foreground`;
  };

  return (
    <Sidebar className={collapsed ? "w-16" : "w-64"} collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-lg">
            HR
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <h2 className="text-lg font-semibold">PeachyHR</h2>
              <p className="text-xs text-muted-foreground">Gestion RH & Paie</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-4">
        <SidebarGroup>
          <SidebarGroupLabel className={collapsed ? "sr-only" : ""}>
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} className={getNavClassName(item.url)}>
                      <item.icon className="h-5 w-5 flex-shrink-0" />
                      {!collapsed && <span className="font-medium">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <Separator className="mb-4" />
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs font-medium">
              {mockUser.initials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{mockUser.name}</p>
              <p className="text-xs text-muted-foreground capitalize">{mockUser.role}</p>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}