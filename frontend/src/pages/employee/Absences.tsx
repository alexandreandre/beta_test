// src/pages/employee/Absences.tsx

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import { PlusCircle, CheckCircle, Clock } from 'lucide-react';

export default function AbsencesPage() {
  const [date, setDate] = useState<Date | undefined>(new Date());

  // Mock data
  const balances = [
    { type: 'Congés Payés', acquired: 25, taken: 10, remaining: 15 },
    { type: 'RTT', acquired: 9, taken: 4.5, remaining: 4.5 },
    { type: 'Congé sans solde', acquired: 0, taken: 2, remaining: 0 },
  ];

  const myAbsences = [
    { id: 1, type: 'Congé Payé', from: '15/07/2024', to: '29/07/2024', status: 'validated' },
    { id: 2, type: 'RTT', from: '19/08/2024', to: '19/08/2024', status: 'pending' },
  ];

  const getStatusBadge = (status: string) => {
    if (status === 'validated') {
      return <Badge className="bg-green-100 text-green-800"><CheckCircle className="mr-1 h-3 w-3"/>Validée</Badge>;
    }
    return <Badge variant="secondary"><Clock className="mr-1 h-3 w-3"/>En attente</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Congés & Absences</h1>
        <Button><PlusCircle className="mr-2 h-4 w-4" /> Faire une demande</Button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>Mes Soldes</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-sm text-muted-foreground">Type</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pris</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-primary">Restant</p>
                </div>
              </div>
              {balances.map(b => (
                <div key={b.type} className="grid grid-cols-3 gap-4 text-center mt-2 p-2 rounded hover:bg-muted">
                  <p className="font-medium text-left">{b.type}</p>
                  <p className="text-muted-foreground">{b.taken} j</p>
                  <p className="font-bold text-xl">{b.remaining} j</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Mes Demandes Récentes</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {myAbsences.map(a => (
                  <li key={a.id} className="flex items-center justify-between p-2 rounded-md border">
                    <div>
                      <p className="font-medium">{a.type}</p>
                      <p className="text-sm text-muted-foreground">{a.from} - {a.to}</p>
                    </div>
                    {getStatusBadge(a.status)}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Calendrier de l'équipe</CardTitle></CardHeader>
          <CardContent className="flex justify-center">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              className="rounded-md border"
              // Ici, on pourrait ajouter des modificateurs pour colorer les jours
              // en fonction des absences de l'équipe.
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}