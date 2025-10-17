// src/pages/employee/Expenses.tsx

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Camera, CheckCircle, Clock, CircleX } from 'lucide-react';

export default function ExpensesPage() {
  // Mock data
  const expenses = [
    { id: 1, date: '12/06/2024', type: 'Restaurant', amount: '24.50 €', status: 'reimbursed' },
    { id: 2, date: '10/06/2024', type: 'Péage', amount: '8.90 €', status: 'approved' },
    { id: 3, date: '05/06/2024', type: 'Hôtel', amount: '112.00 €', status: 'pending' },
    { id: 4, date: '01/06/2024', type: 'Carburant', amount: '55.30 €', status: 'rejected' },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'reimbursed':
        return <Badge className="bg-blue-100 text-blue-800"><CheckCircle className="mr-1 h-3 w-3"/>Remboursée</Badge>;
      case 'approved':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="mr-1 h-3 w-3"/>Approuvée</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Clock className="mr-1 h-3 w-3"/>En attente</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><CircleX className="mr-1 h-3 w-3"/>Rejetée</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Mes Notes de Frais</h1>
        <div className="flex gap-2">
          <Button variant="outline"><Camera className="mr-2 h-4 w-4" /> Scanner un reçu</Button>
          <Button><PlusCircle className="mr-2 h-4 w-4" /> Nouvelle dépense</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Suivi des dépenses</CardTitle>
          <CardDescription>Liste de vos notes de frais et leur statut de remboursement.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead className="text-right">Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.date}</TableCell>
                  <TableCell>{e.type}</TableCell>
                  <TableCell>{e.amount}</TableCell>
                  <TableCell className="text-right">{getStatusBadge(e.status)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}