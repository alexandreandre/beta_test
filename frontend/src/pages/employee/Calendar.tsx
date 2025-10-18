// src/pages/employee/Calendar.tsx

import React, { useCallback } from 'react';
import FullCalendar, { DayCellContentArg } from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import frLocale from '@fullcalendar/core/locales/fr';
import { useAuth } from '@/contexts/AuthContext';
import { useCalendar } from '@/hooks/useCalendar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { EmployeeCalendarDayCell } from '@/components/EmployeeCalendarDayCell';

export default function EmployeeCalendarPage() {
  const { user } = useAuth();
  const {
    selectedDate,
    setSelectedDate,
    plannedCalendar,
    actualHours,
    isLoading: isCalendarLoading,
  } = useCalendar(user?.id);

  const renderDayCell = useCallback((arg: DayCellContentArg) => {
    return (
      <EmployeeCalendarDayCell
        arg={arg}
        plannedCalendar={plannedCalendar}
        actualHours={actualHours}
      />
    );
  }, [plannedCalendar, actualHours]);

  return (
    <div className="space-y-6">
       <style>{`
        .fc-daygrid-day-frame {
          height: 100%;
        }
        .fc .fc-daygrid-day-cushion {
          padding: 0 !important;
          height: 120px; /* Hauteur fixe pour les cellules */
        }
      `}</style>
      <h1 className="text-3xl font-bold">Mon Calendrier</h1>
      <Card>
        <CardHeader>
          <CardTitle>
            Planning de {new Date(selectedDate.year, selectedDate.month - 1).toLocaleString('fr-FR', { month: 'long', year: 'numeric' })}
          </CardTitle>
          <CardDescription>
            Vue de votre planning prévisionnel et des heures réalisées.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isCalendarLoading ? (
            <div className="flex h-[400px] items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <FullCalendar
              key={`${selectedDate.year}-${selectedDate.month}`}
              initialDate={new Date(selectedDate.year, selectedDate.month - 1, 1)}
              plugins={[dayGridPlugin]}
              headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
              locale={frLocale}
              dayCellContent={renderDayCell}
              datesSet={(dateInfo) => {
                const currentDate = dateInfo.view.calendar.getDate();
                const newMonth = currentDate.getMonth() + 1;
                const newYear = currentDate.getFullYear();
                if (newMonth !== selectedDate.month || newYear !== selectedDate.year) {
                  setSelectedDate({ month: newMonth, year: newYear });
                }
              }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}