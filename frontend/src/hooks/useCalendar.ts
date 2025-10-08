// src/hooks/useCalendar.ts

import { useState, useEffect, useCallback } from 'react';
import { useToast } from "@/components/ui/use-toast";
import * as calendarApi from '@/api/calendar';

// On reprend les types de données depuis notre fichier d'API
type PlannedEventData = calendarApi.PlannedEventData;
type ActualHoursData = calendarApi.ActualHoursData;

/**
 * Hook personnalisé pour gérer toute la logique du calendrier d'un employé.
 * @param employeeId L'ID de l'employé pour lequel charger le calendrier.
 */
export function useCalendar(employeeId: string | undefined) {
  
  const { toast } = useToast();
  
  // --- ÉTATS ---
  const [selectedDate, setSelectedDate] = useState({ 
    month: new Date().getMonth() + 1, 
    year: new Date().getFullYear() 
  });
  console.log('%c[HOOK RENDER] État de selectedDate au début du rendu:', 'color: orange; font-weight: bold;', selectedDate);

  // On stocke les deux ensembles de données séparément
  const [plannedCalendar, setPlannedCalendar] = useState<PlannedEventData[]>([]);
  const [actualHours, setActualHours] = useState<ActualHoursData[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // --- LOGIQUE D'ACCÈS AUX DONNÉES ---

  // Fonction pour charger toutes les données du calendrier depuis l'API
  const fetchAllCalendarData = useCallback(async () => {
    if (!employeeId) return;
    setIsLoading(true);
    try {
      const [plannedRes, actualRes] = await Promise.all([
        calendarApi.getPlannedCalendar(employeeId, selectedDate.year, selectedDate.month),
        calendarApi.getActualHours(employeeId, selectedDate.year, selectedDate.month)
      ]);

      const plannedDataFromApi = plannedRes.data.calendrier_prevu;
      const actualDataFromApi = actualRes.data.calendrier_reel;
      
      const daysInMonth = new Date(selectedDate.year, selectedDate.month, 0).getDate();
      
      // 1. On crée un calendrier de base complet pour le mois
      const baseCalendar: PlannedEventData[] = [];
      for (let i = 1; i <= daysInMonth; i++) {
        const date = new Date(selectedDate.year, selectedDate.month - 1, i);
        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
        baseCalendar.push({ 
            jour: i, 
            type: isWeekend ? 'weekend' : 'travail', 
            heures_prevues: null
        });
      }

      // 2. On fusionne les données de l'API avec notre base.
      // Si des données existent dans l'API, elles écrasent les valeurs par défaut.
      const finalPlannedCalendar = baseCalendar.map(defaultDay => {
          const apiDay = plannedDataFromApi.find(p => p.jour === defaultDay.jour);
          return apiDay ? { ...defaultDay, ...apiDay } : defaultDay;
      });

      const finalActualHours = baseCalendar.map(defaultDay => {
          const apiDay = actualDataFromApi.find(a => a.jour === defaultDay.jour);
          // On garde le type du calendrier prévu pour la cohérence
          return {
              jour: defaultDay.jour,
              type: defaultDay.type,
              heures_faites: apiDay ? apiDay.heures_faites : null
          };
      });

      // 3. On met à jour les états avec des calendriers toujours complets.
      setPlannedCalendar(finalPlannedCalendar);
      setActualHours(finalActualHours);

    } catch (error) {
      console.error(error);
      toast({ title: "Erreur", description: "Impossible de charger les données du calendrier.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
}, [employeeId, selectedDate, toast]);
  // Effet qui recharge les données chaque fois que l'employé ou la date sélectionnée change
  useEffect(() => {
    fetchAllCalendarData();
  }, [fetchAllCalendarData]);

  // Fonction pour sauvegarder toutes les modifications en une seule fois

  // src/hooks/useCalendar.ts

  const saveAllCalendarData = async () => {
      if (!employeeId) return;

      console.log("%c--- [WORKFLOW-PAIE | Étape 1] Déclenchement Frontend ---", "color: blue; font-weight: bold;");
      setIsSaving(true);
      try {
        console.log("  -> Action: Sauvegarde des données brutes (planned & actual)...");
        await Promise.all([
          calendarApi.updatePlannedCalendar(employeeId, selectedDate.year, selectedDate.month, plannedCalendar),
          calendarApi.updateActualHours(employeeId, selectedDate.year, selectedDate.month, actualHours)
        ]);
        console.log("  -> Succès: Données brutes enregistrées.");

        console.log("%c--- [WORKFLOW-PAIE | Étape 2] Demande de calcul au Backend ---", "color: blue; font-weight: bold;");
        await calendarApi.calculatePayrollEvents(employeeId, selectedDate.year, selectedDate.month);
        console.log("  -> Succès: Le backend a terminé le calcul.");
        
        toast({ title: "Succès", description: "Calendrier et événements de paie sauvegardés et calculés." });

      } catch (error) {
        console.error(error);
        toast({ title: "Erreur", description: "La sauvegarde ou le calcul a échoué.", variant: "destructive" });
      } finally {
        setIsSaving(false);
      }
    };

  const updateDayData = (updatedDay: { jour: number; type: string; heures_prevues: number | null; heures_faites: number | null; }) => {
    console.log('[HOOK] Mise à jour de l\'état avec :', updatedDay);
    setPlannedCalendar(prev =>
      prev.map(p =>
        p.jour === updatedDay.jour
          ? { ...p, type: updatedDay.type, heures_prevues: updatedDay.heures_prevues }
          : p
      )
    );
    setActualHours(prev =>
      prev.map(a =>
        a.jour === updatedDay.jour
          ? { ...a, type: updatedDay.type, heures_faites: updatedDay.heures_faites }
          : a
      )
    );
  };


  // --- On expose tous les états et fonctions dont l'interface aura besoin ---
  return {
    selectedDate,
    setSelectedDate,
    plannedCalendar,
    setPlannedCalendar,
    actualHours,
    setActualHours,
    isLoading,
    isSaving,
    saveAllCalendarData,
    updateDayData,
  };
}