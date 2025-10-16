// src/pages/EmployeeDetail.tsx 


import { useCallback } from 'react'; // Ajoute useCallback à tes imports de React

import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import apiClient from "@/api/apiClient";

// --- Notre hook et notre modal ---

import { ScheduleModal, DayData } from "@/components/ScheduleModal"; 

// --- Imports UI & Icônes ---
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SaisieModal } from "@/components/SaisieModal"; 
import { Download, Calendar as CalendarIcon, FileText, Loader2, ArrowLeft, Save, ClipboardEdit } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2 } from "lucide-react";
import * as saisiesApi from "@/api/saisies";
import { useCalendar, WeekTemplate } from "@/hooks/useCalendar"; // ✅ On importe le nouveau type
import { Input } from "@/components/ui/input"; // ✅ On importe l'Input
import { Label } from "@/components/ui/label";   // ✅ On importe le Label
import { ArrowRight } from "lucide-react";       // ✅ On importe une icône
import { toast } from "@/components/ui/use-toast";



// --- Imports FullCalendar ---
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import frLocale from '@fullcalendar/core/locales/fr';






// --- Interfaces ---
interface Employee { id: string; first_name: string; last_name: string; job_title: string; contract_type: string; statut: string; hire_date: string; }
interface Payslip { id: string; name: string; url: string; month: number; year: number; }

// ✅ NOUVEAU COMPOSANT : Le formulaire pour le modèle de semaine
// -----------------------------------------------------------------------------
interface WeekTemplateFormProps {
  template: WeekTemplate;
  setTemplate: React.Dispatch<React.SetStateAction<WeekTemplate>>;
  onApply: () => void;
}

function WeekTemplateForm({ template, setTemplate, onApply }: WeekTemplateFormProps) {
  const days = [
    { label: 'Lundi', key: 1 }, { label: 'Mardi', key: 2 }, { label: 'Mercredi', key: 3 },
    { label: 'Jeudi', key: 4 }, { label: 'Vendredi', key: 5 },
  ];

  const handleInputChange = (dayKey: number, value: string) => {
    setTemplate(prev => ({ ...prev, [dayKey]: value }));
  };

  return (
    <Card className="mb-4 bg-muted/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Modèle de semaine type</CardTitle>
        <CardDescription className="text-xs">Définissez les heures prévues, puis appliquez-les à tout le mois.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col md:flex-row items-center gap-4">
        <div className="grid grid-cols-5 gap-3 flex-grow">
          {days.map(day => (
            <div key={day.key} className="grid gap-1.5">
              <Label htmlFor={`template-day-${day.key}`} className="text-xs">{day.label}</Label>
              <Input
                id={`template-day-${day.key}`} type="number" placeholder="h"
                value={template[day.key] || ''}
                onChange={(e) => handleInputChange(day.key, e.target.value)}
                className="h-9"
              />
            </div>
          ))}
        </div>
        <Button onClick={onApply} className="w-full md:w-auto mt-4 md:mt-0">
          <ArrowRight className="mr-2 h-4 w-4"/>
          Appliquer au mois
        </Button>
      </CardContent>
    </Card>
  );
}
// -----------------------------------------------------------------------------
export default function EmployeeDetail() {
  const { employeeId } = useParams<{ employeeId: string }>();
  console.log("[SAISIES][CTX] employeeId =", employeeId);
  
  // --- Le hook gère toute la logique du calendrier ---
  const { 
    selectedDate, 
    setSelectedDate,
    plannedCalendar, 
    setPlannedCalendar,
    actualHours,
    setActualHours,
    isLoading: isCalendarLoading, 
    isSaving,
    saveAllCalendarData,
    updateDayData,
    weekTemplate,       
    setWeekTemplate, 
    applyWeekTemplate,  
  } = useCalendar(employeeId);

  // --- États spécifiques à la page (hors calendrier) ---
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [contractUrl, setContractUrl] = useState<string | null>(null);
  const [isPageLoading, setIsPageLoading] = useState(true);
  
  // --- États pour contrôler la dialogue ---
  const [showModal, setShowModal] = useState(false);
  const [selectedDayData, setSelectedDayData] = useState<DayData | null>(null);
  const [saisieModalOpen, setSaisieModalOpen] = useState(false);

  const [isLoadingSaisies, setIsLoadingSaisies] = useState(true);
  const [employeeSaisies, setEmployeeSaisies] = useState<any[]>([]);


  const fetchSaisies = useCallback(async () => {
    if (!employeeId) return;
    setIsLoadingSaisies(true);
    try {
      const res = await saisiesApi.getEmployeeMonthlyInputs(employeeId, selectedDate.year, selectedDate.month);
      setEmployeeSaisies(res.data || []);
    } catch (err) {
      console.error("❌ Erreur lors du chargement des saisies :", err);
    } finally {
      setIsLoadingSaisies(false);
    }
  }, [employeeId, selectedDate]); // Les dépendances sont correctes

  const handleDeleteSaisie = async (id: string) => {
    if (!confirm("Supprimer cette saisie ?")) return;
    try {
      await saisiesApi.deleteEmployeeMonthlyInput(employeeId!, id);
      toast({ title: "Supprimée", description: "La saisie a été supprimée." });
      fetchSaisies();
    } catch (error) {
      toast({ title: "Erreur", description: "Impossible de supprimer la saisie.", variant: "destructive" });
    }
  };

  // Charger les saisies à chaque changement de mois ou employé
  useEffect(() => {
    if (employeeId) fetchSaisies();
  }, [employeeId, selectedDate]);



  

  // Effet pour charger les données générales de la page (infos employé, bulletins...)
  useEffect(() => {

    if (!employeeId) return;
    const fetchPageData = async () => {
      setIsPageLoading(true);
      try {
        const [employeeRes, payslipsRes, contractRes] = await Promise.all([
          apiClient.get(`/api/employees/${employeeId}`),
          apiClient.get(`/api/employees/${employeeId}/payslips`),
          apiClient.get(`/api/employees/${employeeId}/contract`),
        ]);
        setEmployee(employeeRes.data);
        setPayslips(payslipsRes.data);
        setContractUrl(contractRes.data.url);
      } catch (err) {
        console.error("Erreur lors du chargement des données de la page", err);
      } finally {
        setIsPageLoading(false);
      }
    };
    fetchPageData();
  }, [employeeId]);



  

  // --- Gestionnaires d'événements pour connecter le calendrier et la dialogue ---

  const handleDateClick = (arg: { date: Date } | { event: { start: Date } }) => {
    const clickedDate = 'date' in arg ? arg.date : arg.event.start;
    const dayOfMonth = clickedDate.getDate();
    
    const planned = plannedCalendar.find(e => e.jour === dayOfMonth);
    const actual = actualHours.find(e => e.jour === dayOfMonth);
    
    // On combine les données du prévu et du réel pour les envoyer à la dialogue
    setSelectedDayData({
        jour: dayOfMonth,
        type: planned?.type || 'travail',
        heures_prevues: planned?.heures_prevues || null,
        heures_faites: actual?.heures_faites || null,
    });
    setShowModal(true);
  };
  
  const handleModalSave = (updatedDay: DayData) => {
    // AJOUTEZ CETTE LIGNE DE DÉBOGAGE
    console.log('[DETAIL PAGE] Données reçues du modal :', updatedDay);
    updateDayData(updatedDay);
    setShowModal(false);
};
  // AJOUTER CETTE FONCTION
  const handleSaveSaisie = async (data: any[]) => { // Le type 'any' est temporaire pour correspondre au modal
      try {
        // Le modal envoie un tableau de payloads, un pour chaque employé sélectionné
        await saisiesApi.createMonthlyInputs(data);
        toast({ title: "Succès", description: "Saisie(s) enregistrée(s) avec succès." });
        fetchSaisies(); // Recharger la liste
      } catch (err) {
        toast({ title: "Erreur", description: "Échec de l'enregistrement.", variant: "destructive" });
      }
  };

  // --- Transformation des données pour l'affichage dans FullCalendar ---
  const calendarEvents = useMemo(() => {
    const plannedEvents = plannedCalendar.map(event => ({
        id: `planned-${event.jour}`,
        title: event.heures_prevues ? `${event.heures_prevues}h` : '',
        start: new Date(selectedDate.year, selectedDate.month - 1, event.jour),
        allDay: true,
        display: 'background',
        color: event.type === 'weekend' ? '#f3f4f6' : (event.type === 'ferie' || event.type === 'conge') ? '#dbeafe' : 'transparent',
    }));
    const actualEvents = actualHours.filter(event => event.heures_faites && event.heures_faites > 0).map(event => ({
        id: `actual-${event.jour}`,
        title: `${event.heures_faites}h`,
        start: new Date(selectedDate.year, selectedDate.month - 1, event.jour),
        allDay: true,
        backgroundColor: '#16a34a',
        borderColor: '#16a34a',
    }));
    const allEvents = [...plannedEvents, ...actualEvents];
    
    // AJOUTEZ CETTE LIGNE DE DÉBOGAGE
    console.log('[DISPLAY] Événements préparés pour FullCalendar :', allEvents);

    return allEvents;
  }, [plannedCalendar, actualHours, selectedDate]);

  if (isPageLoading) return <div className="flex items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin"/></div>;
  if (!employee) return <div className="text-center p-8">Employé non trouvé.</div>;

  
  return (
    <div className="space-y-6">
      <Link to="/employees" className="flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-2 h-4 w-4" /> Retour à la liste des salariés
      </Link>

      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <Avatar className="h-16 w-16"><AvatarFallback className="text-xl">{employee.first_name.charAt(0)}{employee.last_name.charAt(0)}</AvatarFallback></Avatar>
          <div>
            <CardTitle className="text-2xl">{employee.first_name} {employee.last_name}</CardTitle>
            <CardDescription>{employee.job_title}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
            <div className="text-sm text-muted-foreground grid grid-cols-2 md:grid-cols-3 gap-4">
                <div><strong>Type de contrat:</strong> {employee.contract_type}</div>
                <div><strong>Statut:</strong> {employee.statut}</div>
                <div><strong>Date d'entrée:</strong> {new Date(employee.hire_date).toLocaleDateString('fr-FR')}</div>
            </div>
        </CardContent>
      </Card>
      
      <Tabs defaultValue="calendrier">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="contrat"><FileText className="mr-2 h-4 w-4"/>Contrat</TabsTrigger>
          <TabsTrigger value="bulletins"><Download className="mr-2 h-4 w-4"/>Bulletins</TabsTrigger>
          <TabsTrigger value="saisie"><ClipboardEdit className="mr-2 h-4 w-4"/>Saisie du mois</TabsTrigger>
          <TabsTrigger value="calendrier"><CalendarIcon className="mr-2 h-4 w-4"/>Calendrier</TabsTrigger>
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
        
        <TabsContent value="saisie" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row justify-between items-center">
              <div>
                <CardTitle>Saisies de {new Date(selectedDate.year, selectedDate.month - 1).toLocaleString("fr-FR", { month: "long" })}</CardTitle>
                <CardDescription>Primes, acomptes et autres variables pour la paie de ce mois.</CardDescription>
              </div>
              <Button onClick={() => setSaisieModalOpen(true)}>+ Ajouter une saisie</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Soumis à cotisations</TableHead>
                    <TableHead>Soumis à impôt</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingSaisies ? (
                    <TableRow><TableCell colSpan={5} className="text-center h-24"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
                  ) : employeeSaisies.length > 0 ? employeeSaisies.map((saisie) => (
                    <TableRow key={saisie.id}>
                      <TableCell className="font-medium">{saisie.name}</TableCell>
                      <TableCell>{saisie.amount.toFixed(2)} €</TableCell>
                      <TableCell>{saisie.is_socially_taxed ? 'Oui' : 'Non'}</TableCell>
                      <TableCell>{saisie.is_taxable ? 'Oui' : 'Non'}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteSaisie(saisie.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center h-24">Aucune saisie pour ce mois.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        
        <TabsContent value="calendrier" className="mt-4">
          <Card>
             <CardHeader className="flex flex-row justify-between items-center">
                <div>
                  <CardTitle>Calendrier de {new Date(selectedDate.year, selectedDate.month - 1).toLocaleString('fr-FR', { month: 'long', year: 'numeric' })}</CardTitle>
                  <CardDescription>Cliquez sur un jour pour éditer le planning et les heures réalisées.</CardDescription>
                </div>
                <Button onClick={saveAllCalendarData} disabled={isSaving}>
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                  Enregistrer
                </Button>
             </CardHeader>
             <CardContent className="h-[80vh] p-0 md:p-4">
                {/* ✅ NOUVEAU : On insère notre composant de formulaire ici */}
                <WeekTemplateForm
                  template={weekTemplate}
                  setTemplate={setWeekTemplate}
                  onApply={applyWeekTemplate}
                />
                {isCalendarLoading ? <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div> : (
                  <FullCalendar
                    key={`${selectedDate.year}-${selectedDate.month}`} 
                    initialDate={new Date(selectedDate.year, selectedDate.month - 1, 1)}
                    plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                    headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }}
                    locale={frLocale}
                    events={calendarEvents}
                    height="100%"
                    selectable={true}
                    dateClick={handleDateClick}
                    eventClick={handleDateClick}

                    datesSet={(dateInfo) => {
                      // CORRECTION : On utilise `view.calendar.getDate()` qui renvoie une date
                      // garantie d'être dans le mois actuellement affiché.
                      const currentDate = dateInfo.view.calendar.getDate();
                      const newMonth = currentDate.getMonth() + 1;
                      const newYear = currentDate.getFullYear();
                      
                      // --- DÉBOGAGE (gardons-le pour l'instant) ---
                      console.log(`[DATESET] State AVANT la mise à jour:`, selectedDate);
                      console.log(`[DATESET] Nouvelle date DÉTECTÉE:`, { month: newMonth, year: newYear });

                      if (newMonth !== selectedDate.month || newYear !== selectedDate.year) {
                        console.log(`[DATESET] MISE À JOUR DE L'ÉTAT demandée.`);
                        setSelectedDate({ month: newMonth, year: newYear });
                      } else {
                        console.log(`[DATESET] Pas de mise à jour, la date est la même.`);
                      }
                    }}
                  />
                )}
             </CardContent>
           </Card>
        </TabsContent>
      </Tabs>

      {/* On utilise notre composant ScheduleModal et on lui passe les bons props */}
      <ScheduleModal 
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        dayData={selectedDayData}
        onSave={handleModalSave}
        selectedDate={selectedDate}
      />
      <SaisieModal
        isOpen={saisieModalOpen}
        onClose={() => setSaisieModalOpen(false)}
        onSave={handleSaveSaisie}
        employees={employee ? [employee] : []} // Le modal attend un tableau d'employés
        employeeScopeId={employee?.id} // On spécifie que le scope est cet employé
      />


    </div>
  );
}