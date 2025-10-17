// src/pages/employee/Dashboard.tsx

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { FileText, Calendar, Receipt, ArrowRight, Bell, Megaphone } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export default function EmployeeDashboard() {
  const { user } = useAuth();

  // Mock data
  const actions = [
    { id: 1, text: "Vous avez 2 notes de frais en attente de soumission.", link: "/expenses" },
    { id: 2, text: "Il vous reste 3 jours de congés à poser avant le 31/12.", link: "/absences" },
    { id: 3, text: "Votre entretien annuel est à planifier.", link: "#" },
  ];

  const news = [
    { id: 1, title: "Événement d'entreprise : Barbecue d'été le 12 Juillet !", content: "N'oubliez pas de vous inscrire avant la fin de la semaine..." },
    { id: 2, title: "Bienvenue à Clara, notre nouvelle commerciale", content: "Clara a rejoint l'équipe commerciale ce lundi. N'hésitez pas à aller la saluer !" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Bonjour, {user?.email.split('@')[0]} !</h1>
          <p className="text-muted-foreground">Ravi de vous revoir.</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Colonne de gauche : Actions et Accès Rapide */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center"><Bell className="mr-2 h-5 w-5 text-primary" /> Mes Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {actions.map(action => (
                  <li key={action.id}>
                    <Link to={action.link} className="flex items-center justify-between p-3 -m-3 rounded-lg hover:bg-muted">
                      <span className="text-sm font-medium">{action.text}</span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-3">
            <Button asChild className="h-24 text-base flex-col gap-2"><Link to="/absences"><Calendar className="h-6 w-6"/> Demander une absence</Link></Button>
            <Button asChild className="h-24 text-base flex-col gap-2"><Link to="/expenses"><Receipt className="h-6 w-6"/> Déclarer une note de frais</Link></Button>
            <Button asChild className="h-24 text-base flex-col gap-2"><Link to="/payslips"><FileText className="h-6 w-6"/> Mon dernier bulletin</Link></Button>
          </div>
        </div>

        {/* Colonne de droite : Soldes et Actualités */}
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-lg">Mes Soldes Actuels</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-baseline">
                <span className="text-muted-foreground">Congés Payés</span>
                <strong className="text-2xl font-bold">15 j</strong>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-muted-foreground">RTT</span>
                <strong className="text-2xl font-bold">4.5 j</strong>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center"><Megaphone className="mr-2 h-5 w-5" /> Actualités de l'entreprise</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {news.map(item => (
                <div key={item.id}>
                  <p className="font-semibold text-sm">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.content}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}