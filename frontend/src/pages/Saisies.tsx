// src/pages/Saisies.tsx

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, PlusCircle, Trash } from "lucide-react";

import { SaisieModal } from "@/components/SaisieModal";
import * as saisiesApi from '@/api/saisies';
import apiClient from '@/api/apiClient';

interface Employee { id: string; first_name: string; last_name: string; job_title: string; }
type MonthlyInput = saisiesApi.MonthlyInput;

export default function Saisies() {
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [monthlyInputs, setMonthlyInputs] = useState<MonthlyInput[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // --- Récupération du mois et de l'année courants
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // --- Chargement des données ---
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [inputsRes, employeesRes] = await Promise.all([
        saisiesApi.getAllMonthlyInputs(currentYear, currentMonth),
        apiClient.get<Employee[]>('/api/employees')
      ]);
      setMonthlyInputs(inputsRes.data);
      setEmployees(employeesRes.data);
    } catch (error) {
      console.error(error);
      toast({ title: "Erreur", description: "Impossible de charger les saisies.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSaveSaisie = async (payloads: any[]) => {
    try {
      // payloads est DÉJÀ un tableau d’objets (avec year & month venant du modal)
      await saisiesApi.createMonthlyInput(payloads);
      toast({ title: "Succès", description: "Saisie ajoutée avec succès." });
      fetchData();
    } catch (error) {
      toast({ title: "Erreur", description: "Échec de l'ajout de la saisie.", variant: "destructive" });
    }
  };


  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cette saisie ?")) return;
    try {
      await saisiesApi.deleteMonthlyInput(id);
      toast({ title: "Supprimée", description: "La saisie a été supprimée." });
      fetchData();
    } catch (error) {
      toast({ title: "Erreur", description: "Impossible de supprimer la saisie.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Saisies du mois</h1>
          <p className="text-muted-foreground">Éléments variables du mois de {currentMonth}/{currentYear}</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" /> Nouvelle saisie
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Saisies enregistrées</CardTitle>
          <CardDescription>
            Liste de toutes les saisies ponctuelles du mois.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-48">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employé</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Soumise à CSG</TableHead>
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
                        <TableCell>{input.description || "-"}</TableCell>
                        <TableCell>
                          {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(input.amount)}
                        </TableCell>
                        <TableCell>
                          {input.soumise_a_csg
                            ? <Badge variant="success">Oui</Badge>
                            : <Badge variant="secondary">Non</Badge>}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
                            onClick={() => handleDelete(input.id)}
                            title="Supprimer"
                          >
                            <Trash className="h-4 w-4" />
                          </Button>

                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center h-24">
                      Aucune saisie enregistrée pour ce mois.
                    </TableCell>
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
        mode="single"
      />
    </div>
  );
}
