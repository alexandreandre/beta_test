// src/hooks/useCalendar.ts

import { useState, useEffect, useCallback } from 'react';
import { useToast } from "@/components/ui/use-toast";
import * as calendarApi from '@/api/calendar';
import { DayData } from '@/components/ScheduleModal';

// On reprend les types de données depuis notre fichier d'API
type PlannedEventData = calendarApi.PlannedEventData;
type ActualHoursData = calendarApi.ActualHoursData;

/**
 * Hook personnalisé pour gérer toute la logique du calendrier d'un employé.
 * @param employeeId L'ID de l'employé pour lequel charger le calendrier.
 */

export type WeekTemplate = {
  [key: number]: string; // Clé 1-5 pour Lun-Ven, valeur en string pour l'input
};



export function useCalendar(employeeId: string | undefined) {
  const [weekTemplate, setWeekTemplate] = useState<WeekTemplate>({
    1: '8', // Lundi
    2: '8', // Mardi
    3: '8', // Mercredi
    4: '8', // Jeudi
    5: '7', // Vendredi
  });
  
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

  const [editingDay, setEditingDay] = useState<number | null>(null);

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

  // ✅ NOUVELLE FONCTION : Logique pour appliquer le modèle
  const applyWeekTemplate = () => {
    const newPlannedCalendar = plannedCalendar.map(day => {
      const date = new Date(selectedDate.year, selectedDate.month - 1, day.jour);
      const dayOfWeek = date.getDay(); // 0=Dim, 1=Lun, ..., 6=Sam

      // Si c'est un jour de semaine défini dans le modèle (et que ce n'est pas un férié/congé existant)
      if (dayOfWeek >= 1 && dayOfWeek <= 5 && !['ferie', 'conge'].includes(day.type)) {
        const hoursString = weekTemplate[dayOfWeek];
        const hours = hoursString && hoursString.trim() !== '' ? parseFloat(hoursString) : null;

        return {
          ...day,
          type: hours !== null && hours > 0 ? 'travail' : 'weekend',
          heures_prevues: hours,
        };
      }

      // Sinon (weekend ou jour déjà marqué), on ne change rien
      return day;
    });

    setPlannedCalendar(newPlannedCalendar);
    toast({ title: "Modèle appliqué", description: "Le calendrier prévisionnel a été mis à jour." });
  };
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

  const updateDayData = (updatedDay: Partial<DayData>) => {
      if (updatedDay.jour === undefined) return;
  
      // Mise à jour du calendrier prévisionnel
      setPlannedCalendar(prev =>
          prev.map(p => {
              if (p.jour !== updatedDay.jour) return p;
              // On fusionne uniquement les champs pertinents pour le prévisionnel
              const newPlannedData: Partial<PlannedEventData> = {};
              if (updatedDay.type !== undefined) newPlannedData.type = updatedDay.type;
              if (updatedDay.heures_prevues !== undefined) newPlannedData.heures_prevues = updatedDay.heures_prevues;
              return { ...p, ...newPlannedData };
          })
      );
  
      // Mise à jour des heures réelles (heures_faites et type pour la cohérence)
      setActualHours(prev =>
          prev.map(a => {
              if (a.jour !== updatedDay.jour) return a;
              const newActualData: Partial<ActualHoursData> = {};
              if (updatedDay.type !== undefined) newActualData.type = updatedDay.type;
              if (updatedDay.heures_faites !== undefined) newActualData.heures_faites = updatedDay.heures_faites;
              return { ...a, ...newActualData };
          })
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
    weekTemplate,       
    setWeekTemplate,   
    applyWeekTemplate, 
    editingDay,
    setEditingDay,
  };
}