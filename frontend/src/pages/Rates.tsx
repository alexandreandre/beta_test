import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { StatusBadge } from "@/components/ui/status-badge";
import { Info, Calendar, TrendingUp } from "lucide-react";

// Mock data - in real app would come from API
const contributionRates = [
  {
    id: "1",
    libelle: "Assurance maladie",
    salarial: 0.75,
    patronal: 13.0,
    status: "success",
    lastUpdate: "2024-01-01",
    source: "URSSAF"
  },
  {
    id: "2", 
    libelle: "Assurance vieillesse",
    salarial: 6.90,
    patronal: 8.55,
    status: "success", 
    lastUpdate: "2024-01-01",
    source: "CNAV"
  },
  {
    id: "3",
    libelle: "Allocations familiales",
    salarial: 0.0,
    patronal: 5.25,
    status: "warning",
    lastUpdate: "2023-11-15",
    source: "CAF"
  },
  {
    id: "4",
    libelle: "Assurance chômage",
    salarial: 2.40,
    patronal: 4.05,
    status: "success",
    lastUpdate: "2024-01-01", 
    source: "Pôle emploi"
  },
  {
    id: "5",
    libelle: "FNAL",
    salarial: 0.0,
    patronal: 0.10,
    status: "danger",
    lastUpdate: "2023-08-20",
    source: "URSSAF"
  },
  {
    id: "6",
    libelle: "Contribution solidarité autonomie",
    salarial: 0.0,
    patronal: 0.30,
    status: "success",
    lastUpdate: "2024-01-01",
    source: "URSSAF"
  }
];

const getStatusVariant = (status: string) => {
  switch (status) {
    case "success":
      return "success";
    case "warning":
      return "warning";
    case "danger":
      return "danger";
    default:
      return "default";
  }
};

const getStatusText = (status: string) => {
  switch (status) {
    case "success":
      return "À jour";
    case "warning":
      return "À vérifier";
    case "danger":
      return "Obsolète";
    default:
      return "Inconnu";
  }
};

const getLastUpdateText = (date: string) => {
  const updateDate = new Date(date);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - updateDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return "Hier";
  if (diffDays < 30) return `Il y a ${diffDays} jours`;
  if (diffDays < 365) return `Il y a ${Math.ceil(diffDays / 30)} mois`;
  return `Il y a ${Math.ceil(diffDays / 365)} an(s)`;
};

export default function Rates() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Suivi des Taux de Cotisation</h1>
        <p className="text-muted-foreground mt-2">
          Surveillance des taux de cotisations sociales et leur actualité
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="kpi-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Taux à jour</p>
                <p className="text-2xl font-bold text-green-600">
                  {contributionRates.filter(r => r.status === "success").length}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="kpi-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">À vérifier</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {contributionRates.filter(r => r.status === "warning").length}
                </p>
              </div>
              <Calendar className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="kpi-card">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Obsolètes</p>
                <p className="text-2xl font-bold text-red-600">
                  {contributionRates.filter(r => r.status === "danger").length}
                </p>
              </div>
              <Info className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rates Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <TooltipProvider>
          {contributionRates.map((rate, index) => (
            <Tooltip key={rate.id}>
              <TooltipTrigger asChild>
                <Card className="hr-card cursor-pointer hover:shadow-lg transition-all duration-200">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg leading-tight">{rate.libelle}</CardTitle>
                      <StatusBadge variant={getStatusVariant(rate.status)}>
                        {getStatusText(rate.status)}
                      </StatusBadge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Taux salarial</span>
                        <span className="font-semibold">{rate.salarial}%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Taux patronal</span>
                        <span className="font-semibold">{rate.patronal}%</span>
                      </div>
                      <div className="pt-2 border-t border-border">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-muted-foreground">Dernière MAJ</span>
                          <span className="font-medium">{getLastUpdateText(rate.lastUpdate)}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-2">
                  <p className="font-semibold">{rate.libelle}</p>
                  <p className="text-sm">Source: {rate.source}</p>
                  <p className="text-sm">Mis à jour le: {new Date(rate.lastUpdate).toLocaleDateString('fr-FR')}</p>
                </div>
              </TooltipContent>
            </Tooltip>
          ))}
        </TooltipProvider>
      </div>
    </div>
  );
}