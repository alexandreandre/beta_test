// src/pages/Saisies.tsx (VERSION COMPLÈTE ET CORRIGÉE)

import { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, PlusCircle, Trash2 } from "lucide-react";

import { SaisieModal } from "@/components/SaisieModal";
import * as saisiesApi from '@/api/saisies';
import apiClient from '@/api/apiClient';

// --- Types & Interfaces ---
interface Employee { id: string; first_name: string; last_name: string; job_title: string; }
type MonthlyInput = saisiesApi.MonthlyInput;
type MonthlyInputCreate = saisiesApi.MonthlyInputCreate;

export default function Saisies() {
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [monthlyInputs, setMonthlyInputs] = useState<MonthlyInput[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // Utilisation de useCallback pour la stabilité
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [inputsRes, employeesRes] = await Promise.all([
        saisiesApi.getAllMonthlyInputs(currentYear, currentMonth), // Appel correct
        apiClient.get<Employee[]>('/api/employees')
      ]);
      setMonthlyInputs(inputsRes.data);
      setEmployees(employeesRes.data);
    } catch (error) {
      console.error(error);
      toast({ title: "Erreur", description: "Impossible de charger les données.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [currentYear, currentMonth, toast]);

  useEffect(() => { 
    fetchData(); 
  }, [fetchData]);

  const handleSaveSaisie = async (payloads: MonthlyInputCreate[]) => {
    try {
      await saisiesApi.createMonthlyInputs(payloads); // Appel correct (pluriel)
      toast({ title: "Succès", description: "Saisie(s) ajoutée(s) avec succès." });
      fetchData(); // Rafraîchir la liste
    } catch (error) {
      toast({ title: "Erreur", description: "Échec de l'ajout de la saisie.", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cette saisie ?")) return;
    try {
      await saisiesApi.deleteMonthlyInput(id); // Appel correct
      toast({ title: "Supprimée", description: "La saisie a été supprimée." });
      fetchData(); // Rafraîchir la liste
    } catch (error) {
      toast({ title: "Erreur", description: "Impossible de supprimer la saisie.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Saisies du mois</h1>
          <p className="text-muted-foreground">
            Éléments variables pour {new Date(currentYear, currentMonth - 1).toLocaleString('fr-FR', { month: 'long', year: 'numeric' })}
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" /> Nouvelle saisie
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Saisies enregistrées</CardTitle>
          <CardDescription>Liste de toutes les saisies ponctuelles pour le mois en cours.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employé</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Soumis Cotisations</TableHead>
                  <TableHead>Soumis Impôt</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyInputs.length > 0 ? (
                  monthlyInputs.map((input) => {
                    const emp = employees.find(e => e.id === input.employee_id);
                    return (
                      <TableRow key={input.id}>
                        <TableCell>{emp ? `${emp.first_name} ${emp.last_name}` : "Inconnu"}</TableCell>
                        <TableCell className="font-medium">{input.name}</TableCell>
                        <TableCell>{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(input.amount)}</TableCell>
                        <TableCell>
                          <Badge variant={input.is_socially_taxed ? "default" : "secondary"}>
                            {input.is_socially_taxed ? 'Oui' : 'Non'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={input.is_taxable ? "default" : "secondary"}>
                            {input.is_taxable ? 'Oui' : 'Non'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(input.id)} title="Supprimer">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-24">Aucune saisie enregistrée pour ce mois.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      
      <SaisieModal 
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveSaisie}
        employees={employees}
      />
    </div>
  );
}