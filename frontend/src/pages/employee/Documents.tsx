// src/pages/employee/Documents.tsx

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Download, Building, UserRound } from 'lucide-react';

export default function DocumentsPage() {
  // Mock data
  const rhDocuments = [
    { id: 1, name: 'Contrat de travail.pdf', date: '01/01/2023', url: '#' },
    { id: 2, name: 'Avenant - Télétravail.pdf', date: '01/06/2023', url: '#' },
    { id: 3, name: 'Attestation employeur.pdf', date: '15/05/2024', url: '#' },
  ];

  const companyDocuments = [
    { id: 1, name: 'Règlement intérieur.pdf', url: '#' },
    { id: 2, name: 'Charte Télétravail.pdf', url: '#' },
    { id: 3, name: 'Guide d\'accueil du salarié.pdf', url: '#' },
  ];

  const DocumentRow = ({ doc }: { doc: { name: string, url: string, date?: string } }) => (
    <li className="flex items-center justify-between p-3 rounded-md hover:bg-muted">
      <div className="flex items-center gap-3">
        <FileText className="h-5 w-5 text-muted-foreground" />
        <div>
          <p className="font-medium">{doc.name}</p>
          {doc.date && <p className="text-xs text-muted-foreground">Ajouté le {doc.date}</p>}
        </div>
      </div>
      <Button variant="ghost" size="icon" asChild>
        <a href={doc.url} download><Download className="h-4 w-4" /></a>
      </Button>
    </li>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Mes Documents</h1>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center"><UserRound className="mr-2 h-5 w-5" />Mes Documents RH</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {rhDocuments.map(doc => <DocumentRow key={doc.id} doc={doc} />)}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center"><Building className="mr-2 h-5 w-5" />Documents Entreprise</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {companyDocuments.map(doc => <DocumentRow key={doc.id} doc={doc} />)}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}