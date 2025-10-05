// src/pages/Payroll.tsx

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import apiClient from '../api/apiClient';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ChevronRight } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  job_title: string | null;
}

export default function Payroll() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get<Employee[]>('/api/employees');
        setEmployees(response.data);
      } catch (err) {
        setError("Erreur : Impossible de récupérer la liste des salariés.");
      } finally {
        setLoading(false);
      }
    };
    fetchEmployees();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Gestion de la Paie</h1>
        <p className="text-muted-foreground mt-2">
          Sélectionnez un salarié pour gérer ses bulletins de paie mensuels.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Liste des Salariés</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Salarié</TableHead><TableHead>Poste</TableHead><TableHead className="text-right"></TableHead></TableRow></TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={3} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>}
              {error && <TableRow><TableCell colSpan={3} className="h-24 text-center text-red-500">{error}</TableCell></TableRow>}
              {!loading && !error && employees.map((employee) => (
                <TableRow key={employee.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell>
                    <Link to={`/payroll/${employee.id}`} className="flex items-center gap-3">
                      <Avatar className="h-8 w-8"><AvatarFallback>{employee.first_name.charAt(0)}{employee.last_name.charAt(0)}</AvatarFallback></Avatar>
                      <span className="font-medium">{employee.first_name} {employee.last_name}</span>
                    </Link>
                  </TableCell>
                  <TableCell>
                     <Link to={`/payroll/${employee.id}`} className="block w-full h-full">{employee.job_title}</Link>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link to={`/payroll/${employee.id}`}><ChevronRight className="h-4 w-4" /></Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}