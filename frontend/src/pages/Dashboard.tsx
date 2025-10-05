import { useState, useEffect } from "react";
import apiClient from '../api/apiClient'; // Assurez-vous que ce chemin est correct

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Users, AlertCircle, TrendingUp, CheckCircle2, Clock, Loader2, Euro } from "lucide-react";

// Le type de données qui correspond à la réponse de votre API
interface ContributionRate {
  id: string;
  libelle: string;
  salarial: number | { deductible?: number; non_deductible?: number } | null;
  patronal: number | { [key: string]: number } | null;
  status: 'green' | 'orange' | 'red';
}

interface DashboardData {
  rates: ContributionRate[];
  last_check: string | null;
}

// NOUVELLE FONCTION : Pour afficher proprement le taux salarial
const formatSalarialRate = (salarial: ContributionRate['salarial']) => {
  if (salarial === null || salarial === undefined) return 'N/A';
  if (typeof salarial === 'number') return `${(salarial * 100).toFixed(2)}%`;
  if (typeof salarial === 'object') {
    const ded = salarial.deductible ? `${(salarial.deductible * 100).toFixed(2)}%` : '...';
    const non_ded = salarial.non_deductible ? `${(salarial.non_deductible * 100).toFixed(2)}%` : '...';
    return `D: ${ded} / ND: ${non_ded}`;
  }
  return 'N/A';
};

// NOUVELLE FONCTION : Pour afficher proprement le taux patronal
const formatPatronalRate = (patronal: ContributionRate['patronal']) => {
  if (patronal === null || patronal === undefined) return 'N/A';
  if (typeof patronal === 'number') return `${(patronal * 100).toFixed(2)}%`;
  if (typeof patronal === 'object') return 'Variable'; // Cas des taux multiples (ex: FNAL)
  return 'N/A';
};

const getStatusBadge = (status: ContributionRate['status']) => {
  const styles = {
    green: "bg-green-100 text-green-800",
    orange: "bg-orange-100 text-orange-800",
    red: "bg-red-100 text-red-800",
  };
  const text = { green: "À jour", orange: "Récent", red: "Obsolète" };
  return <Badge variant="default" className={styles[status]}>{text[status]}</Badge>;
};


export default function Dashboard() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get<DashboardData>('/api/dashboard/contribution-rates');
        setDashboardData(response.data);
        setError(null);
      } catch (err) {
        setError("Erreur : Impossible de charger les données du tableau de bord.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  if (error) return <div className="text-red-600 p-8">{error}</div>;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Tableau de Bord</h1>
        <p className="text-muted-foreground mt-2">Vue d'ensemble de votre gestion RH et paie</p>
      </div>

      {/* CORRIGÉ : Remplacement des KPICard par des Card standards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card><CardHeader><CardTitle className="text-sm font-medium">Effectif Total</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">247</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm font-medium">Masse Salariale</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">890K €</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm font-medium">Congés en Attente</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">12</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm font-medium">Contrats Actifs</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">243</div></CardContent></Card>
      </div>

      {/* Suivi des Taux de Cotisations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" />Suivi des Taux de Cotisations</CardTitle>
          <p className="text-sm text-muted-foreground">
            {loading ? 'Vérification...' : `Dernière vérification le ${dashboardData?.last_check ? new Date(dashboardData.last_check).toLocaleString('fr-FR') : 'N/A'}`}
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {dashboardData?.rates.map((rate) => (
                <TooltipProvider key={rate.id}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Card className="p-4 flex flex-col justify-between hover:border-primary transition-colors">
                        <div className="flex justify-between items-start">
                          <p className="font-semibold text-sm pr-2">{rate.libelle}</p>
                          {getStatusBadge(rate.status)}
                        </div>
                        <div className="mt-4 grid grid-cols-2 text-xs text-muted-foreground">
                          {/* CORRIGÉ : Utilisation des nouvelles fonctions de formatage */}
                          <div><p className="font-medium text-foreground">Salarial</p><p>{formatSalarialRate(rate.salarial)}</p></div>
                          <div><p className="font-medium text-foreground">Patronal</p><p>{formatPatronalRate(rate.patronal)}</p></div>
                        </div>
                      </Card>
                    </TooltipTrigger>
                    <TooltipContent><p>Source des données pour cette cotisation</p></TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}