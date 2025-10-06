// src/pages/EmployeeDetail.tsx 

import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import apiClient from "@/api/apiClient";

// --- Notre hook et notre modal ---
import { useCalendar } from "@/hooks/useCalendar"; 
import { ScheduleModal, DayData } from "@/components/ScheduleModal"; 

// --- Imports UI & Icônes ---
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Download, Calendar as CalendarIcon, FileText, Loader2, ArrowLeft, Save } from "lucide-react";

// --- Imports FullCalendar ---
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import frLocale from '@fullcalendar/core/locales/fr';

// --- Interfaces ---
interface Employee { id: string; first_name: string; last_name: string; job_title: string; contract_type: string; statut: string; hire_date: string; }
interface Payslip { id: string; name: string; url: string; month: number; year: number; }

export default function EmployeeDetail() {
  const { employeeId } = useParams<{ employeeId: string }>();
  
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
  } = useCalendar(employeeId);

  // --- États spécifiques à la page (hors calendrier) ---
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [contractUrl, setContractUrl] = useState<string | null>(null);
  const [isPageLoading, setIsPageLoading] = useState(true);
  
  // --- États pour contrôler la dialogue ---
  const [showModal, setShowModal] = useState(false);
  const [selectedDayData, setSelectedDayData] = useState<DayData | null>(null);

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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="contrat"><FileText className="mr-2 h-4 w-4"/>Contrat</TabsTrigger>
          <TabsTrigger value="bulletins"><Download className="mr-2 h-4 w-4"/>Bulletins</TabsTrigger>
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
    </div>
  );
}