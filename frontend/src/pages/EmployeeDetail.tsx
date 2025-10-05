import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import apiClient from "@/api/apiClient";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Download, Calendar, FileText, Loader2, ArrowLeft } from "lucide-react";

// Interfaces pour typer les données reçues de l'API
interface Employee { id: string; first_name: string; last_name: string; job_title: string; contract_type: string; statut: string; hire_date: string; }
interface Payslip { 
  id: string;
  name: string; 
  url: string; 
  month: number;
  year: number; 
}
interface CalendarEvent { day: number; type?: string; heures_prevues?: number; heures_faites?: number; }
interface CalendarData { planned: CalendarEvent[]; actual: CalendarEvent[]; }

export default function EmployeeDetail() {
  const { employeeId } = useParams<{ employeeId: string }>();
  
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [contractUrl, setContractUrl] = useState<string | null>(null);
  const [calendarData, setCalendarData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // --- DÉBOGAGE 1 ---
    console.log(`useEffect a démarré. ID de l'employé depuis l'URL : ${employeeId}`);
    
    if (!employeeId) {
      console.error("ERREUR: ID de l'employé manquant dans l'URL.");
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      console.log("--- DÉBOGAGE 2: Lancement de la récupération des données ---");
      try {
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();

        const [employeeRes, payslipsRes, contractRes, calendarRes] = await Promise.all([
          apiClient.get(`/api/employees/${employeeId}`),
          apiClient.get(`/api/employees/${employeeId}/payslips`),
          apiClient.get(`/api/employees/${employeeId}/contract`),
          apiClient.get(`/api/employees/${employeeId}/calendar-data?year=${currentYear}&month=${currentMonth}`)
        ]);
        
        // --- DÉBOGAGE 3 : Affichage des réponses brutes de l'API ---
        console.log("--- RÉPONSES BRUTES DE L'API ---");
        console.log("1. Réponse Employé:", employeeRes);
        console.log("2. Réponse Bulletins:", payslipsRes);
        console.log("3. Réponse Contrat:", contractRes);
        console.log("4. Réponse Calendrier:", calendarRes);
        console.log("---------------------------------");

        setEmployee(employeeRes.data);
        setPayslips(payslipsRes.data);
        setContractUrl(contractRes.data.url);
        setCalendarData(calendarRes.data);

      } catch (err) {
        // --- DÉBOGAGE 4 : Capture de l'erreur exacte ---
        console.error("--- ❌ ERREUR FATALE DANS fetchData ❌ ---", err);
        setError("Impossible de charger les données de l'employé.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [employeeId]);
  
  // --- DÉBOGAGE 5 : État du composant avant le rendu ---
  console.log("État du composant avant rendu:", { loading, error, employee: !!employee });

  if (loading) return <div className="flex items-center justify-center h-48"><Loader2 className="h-8 w-8 animate-spin"/></div>;
  if (error) return <div className="text-red-500 text-center p-8">{error}</div>;
  if (!employee) return <div className="text-center p-8">Employé non trouvé ou erreur de chargement.</div>;

  return (
    <div className="space-y-6">
      <Link to="/employees" className="flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-2 h-4 w-4" /> Retour à la liste des salariés
      </Link>

      {/* Résumé du salarié */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <Avatar className="h-16 w-16"><AvatarFallback className="text-xl">{employee?.first_name?.charAt(0)}{employee?.last_name?.charAt(0)}</AvatarFallback></Avatar>
          <div>
            <CardTitle className="text-2xl">{employee?.first_name} {employee?.last_name}</CardTitle>
            <CardDescription>{employee?.job_title}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
            <div className="text-sm text-muted-foreground grid grid-cols-3 gap-4">
                <div><strong>Type de contrat:</strong> {employee?.contract_type}</div>
                <div><strong>Statut:</strong> {employee?.statut}</div>
                <div><strong>Date d'entrée:</strong> {employee?.hire_date ? new Date(employee.hire_date).toLocaleDateString('fr-FR') : 'N/A'}</div>
            </div>
        </CardContent>
      </Card>
      
      <Tabs defaultValue="contrat">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="contrat"><FileText className="mr-2 h-4 w-4"/>Contrat</TabsTrigger>
          <TabsTrigger value="bulletins"><Download className="mr-2 h-4 w-4"/>Bulletins</TabsTrigger>
          <TabsTrigger value="calendrier"><Calendar className="mr-2 h-4 w-4"/>Calendrier</TabsTrigger>
        </TabsList>

        <TabsContent value="contrat" className="mt-4">
          <Card>
             <CardHeader><CardTitle>Contrat de Travail</CardTitle></CardHeader>
             <CardContent style={{ height: '70vh' }}>
                {contractUrl ? (
                   <iframe src={contractUrl} width="100%" height="100%" className="border rounded-md" title="Contrat de travail" />
                ) : <p className="text-sm text-muted-foreground">Aucun fichier de contrat trouvé.</p>}
             </CardContent>
           </Card>
        </TabsContent>

        <TabsContent value="bulletins" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Bulletins de Paie</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {payslips.length > 0 ? payslips.map(p => (
                  // CORRIGÉ : Utilisation de p.id pour la clé unique
                  <li key={p.id} className="flex justify-between items-center p-2 rounded-md hover:bg-muted">
                    <span className="capitalize">
                      {new Date(p.year, p.month - 1).toLocaleString('fr-FR', { month: 'long', year: 'numeric' })}
                    </span>
                    <Button variant="outline" size="sm" asChild>
                       <a href={p.url} download={p.name}><Download className="mr-2 h-4 w-4"/> Télécharger</a>
                    </Button>
                  </li>
                )) : <p className="text-sm text-muted-foreground">Aucun bulletin de paie trouvé.</p>}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="calendrier" className="mt-4">
          <Card>
             <CardHeader><CardTitle>Calendrier de {new Date().toLocaleString('fr-FR', { month: 'long', year: 'numeric' })}</CardTitle></CardHeader>
             <CardContent className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-2">Heures Prévues</h3>
                  <Table><TableHeader><TableRow><TableHead>Jour</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Heures</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {calendarData?.planned.map(e => <TableRow key={`p-${e.day}`}><TableCell>{e.day}</TableCell><TableCell>{e.type}</TableCell><TableCell className="text-right">{e.heures_prevues ?? '-'}</TableCell></TableRow>)}
                    </TableBody>
                  </Table>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Heures Faites</h3>
                   <Table><TableHeader><TableRow><TableHead>Jour</TableHead><TableHead className="text-right">Heures</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {calendarData?.actual.map(e => <TableRow key={`a-${e.day}`}><TableCell>{e.day}</TableCell><TableCell className="text-right">{e.heures_faites ?? '0'}</TableCell></TableRow>)}
                    </TableBody>
                  </Table>
                </div>
             </CardContent>
           </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}