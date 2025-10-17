// src/pages/employee/Payslips.tsx

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Download, BarChart2, PieChart } from 'lucide-react';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip as RechartsTooltip } from 'recharts';

// Mock data
const payslips = [
  { id: '1', month: 'Juin 2024', net: '2,543.12 €', url: '#' },
  { id: '2', month: 'Mai 2024', net: '2,538.45 €', url: '#' },
  { id: '3', month: 'Avril 2024', net: '2,890.60 €', url: '#' },
  { id: '4', month: 'Mars 2024', net: '2,510.90 €', url: '#' },
  { id: '5', month: 'Février 2024', net: '2,512.33 €', url: '#' },
  { id: '6', month: 'Janvier 2024', net: '2,509.88 €', url: '#' },
];

const salaryEvolutionData = [
  { name: 'Jan', net: 2510 }, { name: 'Fév', net: 2512 }, { name: 'Mar', net: 2511 },
  { name: 'Avr', net: 2891 }, { name: 'Mai', net: 2538 }, { name: 'Juin', net: 2543 },
];

export default function PayslipsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Ma Rémunération</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><BarChart2 className="mr-2 h-5 w-5" />Évolution du Net à Payer (6 derniers mois)</CardTitle>
        </CardHeader>
        <CardContent className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={salaryEvolutionData}>
              <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}€`} />
              <RechartsTooltip cursor={{ fill: 'hsl(var(--muted))' }} contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }} />
              <Bar dataKey="net" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Mes Bulletins de Paie</CardTitle>
            <CardDescription>Historique de vos bulletins disponibles en téléchargement.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mois</TableHead>
                  <TableHead>Net à Payer</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payslips.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.month}</TableCell>
                    <TableCell>{p.net}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" asChild>
                        <a href={p.url} download><Download className="h-4 w-4" /></a>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center"><PieChart className="mr-2 h-5 w-5" />Répartition du Brut (Juin 2024)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Un graphique camembert montrant la répartition (salaire de base, primes, etc.) sera bientôt disponible ici.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}