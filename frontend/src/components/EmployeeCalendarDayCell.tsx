// src/components/EmployeeCalendarDayCell.tsx

import { DayCellContentArg } from '@fullcalendar/react';
import { PlannedEventData, ActualHoursData } from '@/api/calendar';
import { cn } from '@/lib/utils';

interface EmployeeCalendarDayCellProps {
  arg: DayCellContentArg;
  plannedCalendar: PlannedEventData[];
  actualHours: ActualHoursData[];
}

export function EmployeeCalendarDayCell({ arg, plannedCalendar, actualHours }: EmployeeCalendarDayCellProps) {
  const dayNumber = arg.dayNumberText.replace('日', '');
  const dayData = plannedCalendar.find(d => d.jour === parseInt(dayNumber, 10));
  const actualDayData = actualHours.find(d => d.jour === parseInt(dayNumber, 10));

  if (arg.isOther) return <div className="p-1 text-muted-foreground/50">{dayNumber}</div>;
  if (!dayData) return <div className="p-1">{dayNumber}</div>;

  const type = dayData.type;
  const plannedHours = dayData.heures_prevues;
  const actualHoursVal = actualDayData?.heures_faites;

  const typeDisplay: { [key: string]: { label: string; className: string } } = {
    travail: { label: 'Travail', className: 'bg-blue-100 text-blue-800' },
    conge: { label: 'Congé', className: 'bg-green-100 text-green-800' },
    ferie: { label: 'Férié', className: 'bg-yellow-100 text-yellow-800' },
    arret_maladie: { label: 'Arrêt Maladie', className: 'bg-orange-100 text-orange-800' },
    weekend: { label: 'Weekend', className: 'bg-gray-100 text-gray-500' },
  };

  const typeInfo = typeDisplay[type] || { label: type, className: 'bg-gray-200' };

  return (
    <div className={cn("flex flex-col h-full w-full p-1.5 text-xs", arg.isToday && "bg-blue-50")}>
      <div className="flex justify-between items-center">
        <span className="font-bold">{dayNumber}</span>
        <span className={cn("px-1.5 py-0.5 rounded-full text-[10px] font-semibold", typeInfo.className)}>
          {typeInfo.label}
        </span>
      </div>
      {type === 'travail' && (
        <div className="mt-auto text-left space-y-1">
          {plannedHours !== null && (
            <div>
              <span className="text-muted-foreground">Prévu: </span>
              <span className="font-bold">{plannedHours}h</span>
            </div>
          )}
          {actualHoursVal !== null && (
            <div>
              <span className="text-muted-foreground">Fait: </span>
              <span className="font-bold text-primary">{actualHoursVal}h</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}