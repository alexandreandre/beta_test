// src/components/CalendarDayCell.tsx

import { DayCellContentArg } from '@fullcalendar/core';
import { PlannedEventData, ActualHoursData } from '@/api/calendar';
import { DayData } from '@/components/ScheduleModal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Calendar, Clock } from 'lucide-react';

interface CalendarDayCellProps {
  arg: DayCellContentArg;
  plannedCalendar: PlannedEventData[];
  actualHours: ActualHoursData[];
  updateDayData: (day: Partial<DayData>) => void;
  // --- NOUVELLES PROPS POUR LA SÉLECTION ---
  selectedDays?: number[];
  onDaySelect?: (dayNumber: number, isCtrlOrMetaKey: boolean) => void;
  selectedDate: { month: number; year: number };
}

const typeColors: { [key: string]: string } = {
  travail: "bg-transparent text-foreground",
  conge: "bg-blue-100 text-blue-800",
  ferie: "bg-purple-100 text-purple-800",
  arret_maladie: "bg-amber-100 text-amber-800",
  weekend: "bg-gray-100 text-gray-500",
};

export function CalendarDayCell({ arg, plannedCalendar, actualHours, updateDayData, selectedDays = [], onDaySelect, selectedDate }: CalendarDayCellProps) {
  const dayNumber = arg.date.getDate();

  const plannedDay = plannedCalendar.find(d => d.jour === dayNumber);
  const actualDay = actualHours.find(d => d.jour === dayNumber);

  // Vérifie si le jour de la cellule appartient au mois actuellement sélectionné.
  const isCurrentMonth = arg.date.getMonth() + 1 === selectedDate.month && arg.date.getFullYear() === selectedDate.year;

  const isSelected = isCurrentMonth && selectedDays.includes(dayNumber);

  // Pour les jours hors du mois courant, on affiche juste le numéro grisé.
  if (!isCurrentMonth) {
    return (
      <div className="flex h-full items-start justify-start p-2">
        <span className="text-muted-foreground/30">{arg.dayNumberText}</span>
      </div>);
  }

  const handleCellClick = (e: React.MouseEvent<HTMLDivElement>) => {
    onDaySelect?.(dayNumber, e.ctrlKey || e.metaKey);
  };

  const handleTypeChange = (newType: string) => {
    // Si le jour n'existe pas encore dans le calendrier, on le crée
    const currentPlanned = plannedCalendar.find(d => d.jour === dayNumber);
    const currentActual = actualHours.find(d => d.jour === dayNumber);
    if (!currentPlanned || !currentActual) {
      // On peut initialiser avec des valeurs par défaut si besoin
    }

    const isWorkDay = newType === 'travail';
    updateDayData({
      jour: dayNumber,
      type: newType,
      heures_prevues: isWorkDay ? (plannedDay.heures_prevues ?? 8) : null,
    });
  };

  const handlePlannedHoursChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    updateDayData({
      jour: dayNumber,
      heures_prevues: value ? parseFloat(value) : null,
    });
  };

  const handleActualHoursChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    updateDayData({
      jour: dayNumber,
      heures_faites: value ? parseFloat(value) : null,
    });
  };

  const isToday = arg.isToday;

  // Si les données ne sont pas chargées pour ce jour (cas improbable mais sécuritaire)
  if (!plannedDay || !actualDay) {
    return (
      <div className="flex h-full items-start justify-start p-2">
        <span className="text-muted-foreground">{arg.dayNumberText}</span>
      </div>
    );
  }

  return (
    <div 
      className={cn(
        "flex flex-col h-full p-1.5 rounded-md transition-all duration-200 border-2 group cursor-pointer",
        "hover:border-primary/30 hover:shadow-lg hover:bg-card",
        isSelected ? "border-primary bg-primary/5" : "border-transparent"
      )}
      onClick={handleCellClick}
    >
      <div className="flex items-center justify-between mb-1">
        <div className={cn(
          "font-bold text-xs rounded-full h-6 w-6 flex items-center justify-center transition-all", 
          isToday ? "bg-primary text-primary-foreground" : "text-foreground group-hover:text-primary"
        )}>
          {arg.dayNumberText}
        </div>
        <Select value={plannedDay.type} onValueChange={handleTypeChange}>
            <SelectTrigger className="h-6 text-xs focus:ring-0 focus:ring-offset-0 border-0 bg-transparent hover:bg-muted/50 rounded-md w-auto p-0">
              <SelectValue asChild>
                <Badge variant="outline" className={cn("text-xs font-normal border-0", typeColors[plannedDay.type])}>
                  {plannedDay.type === 'travail' ? 'Travail' : plannedDay.type === 'conge' ? 'Congé' : plannedDay.type === 'ferie' ? 'Férié' : plannedDay.type === 'arret_maladie' ? 'Arrêt' : 'Weekend'}
                </Badge>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="travail">Travail</SelectItem>
              <SelectItem value="conge">Congé</SelectItem>
              <SelectItem value="ferie">Férié</SelectItem>
              <SelectItem value="arret_maladie">Arrêt Maladie</SelectItem>
              <SelectItem value="weekend">Weekend</SelectItem>
            </SelectContent>
          </Select>
      </div>

      <div className="flex-grow flex flex-col justify-end gap-1.5 mt-1">
        <div className="relative flex items-center group/input">
          <Calendar className="absolute left-1 h-3 w-3 text-muted-foreground group-hover/input:text-primary" />
          <Input id={`planned-${dayNumber}`} type="number" placeholder="–" value={plannedDay.heures_prevues ?? ''} onChange={handlePlannedHoursChange} disabled={plannedDay.type !== 'travail'} 
            className="h-7 text-xs p-1 pl-5 bg-transparent border-0 rounded-md focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:ring-offset-0 disabled:opacity-40 disabled:cursor-not-allowed" 
          />
        </div>

        <div className="relative flex items-center group/input">
          <Clock className="absolute left-1 h-3 w-3 text-muted-foreground group-hover/input:text-teal-500" />
          <Input id={`actual-${dayNumber}`} type="number" placeholder="–" value={actualDay.heures_faites ?? ''} onChange={handleActualHoursChange} 
            className="h-7 text-xs p-1 pl-5 bg-teal-500/5 border-0 rounded-md focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-teal-500 focus-visible:ring-offset-0" 
          />
        </div>
      </div>
    </div>
  );
}