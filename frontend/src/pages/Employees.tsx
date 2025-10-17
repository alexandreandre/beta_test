import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import apiClient from '../api/apiClient';

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Plus, Eye, Loader2, ChevronRight } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea"; // Pour les champs JSON
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFieldArray } from "react-hook-form";



// Interface pour la liste (simple)
interface EmployeeListItem {
  id: string;
  first_name: string;
  last_name: string;
  job_title: string | null;
  contract_type: string | null;
  hire_date: string | null;
}

// Schéma de validation Zod complet
const formSchema = z.object({
  // --- SECTION SALARIÉ (COMPLÉTÉE) ---
  first_name: z.string().min(2, { message: "Prénom requis." }),
  last_name: z.string().min(2, { message: "Nom requis." }),
  nir: z.string().length(15, { message: "Le NIR doit faire 15 chiffres." }),
  date_naissance: z.string().refine((d) => d, { message: "Date requise." }),
  lieu_naissance: z.string().min(2, { message: "Lieu de naissance requis." }),
  nationalite: z.string().min(2, { message: "Nationalité requise." }),
  adresse: z.object({
    rue: z.string().min(2, { message: "Rue requise." }),
    code_postal: z.string().min(5, { message: "Code postal requis." }),
    ville: z.string().min(2, { message: "Ville requise." }),
  }),
  coordonnees_bancaires: z.object({
    iban: z.string().min(14, { message: "IBAN invalide." }),
    bic: z.string().min(8, { message: "BIC invalide." }),
  }),
  

  // --- SECTION CONTRAT (COMPLÉTÉE) ---
  hire_date: z.string().refine((d) => !isNaN(Date.parse(d)), { message: "Date invalide." }),
  contract_type: z.string().min(2),
  statut: z.string().min(2),
  job_title: z.string().min(2),
  // periode_essai: z.object({
  //   duree_initiale: z.coerce.number().int().positive(),
  //   unite: z.string(),
  //   renouvellement_possible: z.boolean(),
  // }),
  is_temps_partiel: z.boolean(),
  duree_hebdomadaire: z.coerce.number().positive(),
  
  // --- SECTION RÉMUNÉRATION (COMPLÉTÉE) ---
  salaire_de_base: z.object({
    valeur: z.coerce.number().positive({ message: "Le salaire doit être positif." })
  }),
  classification_conventionnelle: z.object({
    groupe_emploi: z.string().min(1, { message: "Groupe requis." }),
    classe_emploi: z.coerce.number().int(),
    coefficient: z.coerce.number().int().positive({ message: "Coeff. requis." }),
  }),

  avantages_en_nature: z.object({
    repas: z.object({
      nombre_par_mois: z.coerce.number().int().min(0),
    }),
    logement: z.object({
      beneficie: z.boolean(),
    }),
    vehicule: z.object({
      beneficie: z.boolean(),
    }),
  }),
  
   // --- SECTION SPÉCIFICITÉS (DÉTAILLÉE) ---
  specificites_paie: z.object({
    is_alsace_moselle: z.boolean(),
    prelevement_a_la_source: z.object({
      is_personnalise: z.boolean(),
      taux: z.coerce.number().min(0).max(100).optional(),
    }),
    transport: z.object({ abonnement_mensuel_total: z.coerce.number().min(0) }),
    titres_restaurant: z.object({
      beneficie: z.boolean(),
      nombre_par_mois: z.coerce.number().int().min(0),
    }),
    mutuelle: z.object({
      lignes_specifiques: z.array(
        z.object({
          id: z.string().min(1),
          libelle: z.string().min(2),
          montant_salarial: z.coerce.number(),
          montant_patronal: z.coerce.number(),
          part_patronale_soumise_a_csg: z.boolean(),
        })
      ),
    }),
    // Prévoyance : une adhésion simple, et une liste optionnelle pour les cadres
    prevoyance: z.object({
      adhesion: z.boolean(),
      lignes_specifiques: z.array(
        z.object({
          id: z.string(),
          libelle: z.string().min(2, { message: "Libellé requis." }),
          salarial: z.coerce.number(),
          patronal: z.coerce.number(),
          forfait_social: z.coerce.number(),
        })
      ).optional(),
    }),
  }),
}).superRefine((data, ctx) => {
  // Règle de validation personnalisée pour la prévoyance
  if (data.statut?.toLowerCase() === 'cadre' && data.specificites_paie.prevoyance.adhesion) {
    if (!data.specificites_paie.prevoyance.lignes_specifiques || data.specificites_paie.prevoyance.lignes_specifiques.length === 0) {
      // Si aucune ligne n'est ajoutée pour un cadre, on ne met pas d'erreur pour l'instant,
      // mais on pourrait en ajouter une ici si c'était obligatoire.
      return;
    }
    // On vérifie chaque ligne de prévoyance
    data.specificites_paie.prevoyance.lignes_specifiques.forEach((ligne, index) => {
      if (!ligne.libelle) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Le libellé est requis.",
          path: [`specificites_paie`, `prevoyance`, `lignes_specifiques`, index, `libelle`],
        });
      }
    });
  }
});


const getContractBadge = (type: string) => {
  const variants = { CDI: "bg-blue-100 text-blue-800", CDD: "bg-purple-100 text-purple-800" };
  return <Badge variant="default" className={variants[type as keyof typeof variants] || "bg-gray-100 text-gray-800"}>{type}</Badge>;
};

export default function Employees() {
  const [employees, setEmployees] = useState<EmployeeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const navigate = useNavigate();
  // Formulaire avec toutes les valeurs par défaut
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      first_name: "", last_name: "", nir: "", date_naissance: "",
      lieu_naissance: "", nationalite: "Française",
      adresse: { rue: "", code_postal: "", ville: "" },
      coordonnees_bancaires: { iban: "", bic: "" },
      hire_date: new Date().toISOString().split('T')[0],
      contract_type: "CDI", statut: "Non-Cadre", job_title: "",
      // periode_essai: { duree_initiale: 2, unite: "mois", renouvellement_possible: true },
      is_temps_partiel: false,
      duree_hebdomadaire: 39, 
      salaire_de_base: {
        valeur: 2365.66
      },
      classification_conventionnelle: {
        groupe_emploi: "C",
        classe_emploi: 6,
        coefficient: 240
      },
      avantages_en_nature: {
        repas: { nombre_par_mois: 0 },
        logement: { beneficie: false },
        vehicule: { beneficie: false },
      },
      
      specificites_paie: {
        is_alsace_moselle: false,
        prelevement_a_la_source: {
          is_personnalise: false,
          taux: 0,
        },
        transport: {
          abonnement_mensuel_total: 0,
        },
        titres_restaurant: {
          beneficie: true,
          nombre_par_mois: 0,
        },
        mutuelle: {
          lignes_specifiques: [
            { id: "mutuelle_1", libelle: "", montant_salarial: 0, montant_patronal: 0, part_patronale_soumise_a_csg: true },
          ],
        },
        prevoyance: {
          adhesion: true,
          lignes_specifiques: [],
        },
      },
    },
  });
  const { fields: mutuelleFields, append: appendMutuelle, remove: removeMutuelle } = useFieldArray({
    control: form.control,
    name: "specificites_paie.mutuelle.lignes_specifiques",
  });

  const { fields: prevoyanceFields, append: appendPrevoyance, remove: removePrevoyance } = useFieldArray({
    control: form.control,
    name: "specificites_paie.prevoyance.lignes_specifiques",
  });

  const isCadre = form.watch("statut")?.toLowerCase() === 'cadre';

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<EmployeeListItem[]>('/api/employees');
      setEmployees(response.data);
      setError(null);
    } catch (err) {
      setError("Erreur : Impossible de récupérer la liste des salariés.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEmployees(); }, []);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
  console.log("Validation réussie, données brutes du formulaire :", values);

  // On prépare le payload final pour le backend
  const payload = {
    ...values,
    specificites_paie: {
      ...values.specificites_paie,
      // On met à jour la section mutuelle pour inclure "adhesion"
      mutuelle: {
        adhesion: (values.specificites_paie.mutuelle.lignes_specifiques?.length || 0) > 0,
        lignes_specifiques: values.specificites_paie.mutuelle.lignes_specifiques,
      },
      // On met à jour la section prévoyance avec la logique conditionnelle
      prevoyance: {
        adhesion: values.specificites_paie.prevoyance.adhesion,
        lignes_specifiques: 
          (values.specificites_paie.prevoyance.adhesion && values.statut?.toLowerCase() === 'cadre') 
          ? values.specificites_paie.prevoyance.lignes_specifiques
          : [], // On envoie une liste vide si non-cadre ou si l'adhésion n'est pas cochée
      },
    }
  };

  console.log("Payload final envoyé au backend :", payload);

  try {
    await apiClient.post('/api/employees', payload);
    setIsDialogOpen(false);
    form.reset();
    await fetchEmployees();
  } catch (error: any) {
    console.error("Erreur lors de l'envoi au backend :", error.response?.data || error.message);
    alert("Erreur de validation. Vérifiez la console du navigateur (F12) pour les détails.");
  }
};

  // Cette fonction est appelée UNIQUEMENT si la validation échoue
  const onValidationErrors = (errors: any) => {
    console.log("%c❌ Validation Échouée !", "color: red; font-weight: bold;");
    console.log("Champs en erreur :", errors);
  };

  const filteredEmployees = employees.filter(emp => `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold">Gestion des Salariés</h1><p className="text-muted-foreground mt-2">{loading ? 'Chargement...' : `${employees.length} salariés`}</p></div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4"/>Nouveau Contrat</Button></DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Créer un nouveau contrat</DialogTitle>
              <DialogDescription>Remplissez tous les champs pour générer le contrat complet.</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit, onValidationErrors)}>
                <Tabs defaultValue="salarie" className="w-full">
                  <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="salarie">Salarié</TabsTrigger>
                    <TabsTrigger value="contrat">Contrat</TabsTrigger>
                    <TabsTrigger value="remuneration">Rémunération</TabsTrigger>
                    <TabsTrigger value="avantages">Avantages</TabsTrigger> {/* <-- AJOUTEZ CETTE LIGNE */}
                    <TabsTrigger value="specifiques">Spécificités</TabsTrigger>
                  </TabsList>
                  <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                    <TabsContent value="salarie">
                      <FormField name="first_name" render={({ field }) => (<FormItem><FormLabel>Prénom</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField name="last_name" render={({ field }) => (<FormItem><FormLabel>Nom</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField name="nir" render={({ field }) => (<FormItem><FormLabel>N° de Sécurité Sociale</FormLabel><FormControl><Input placeholder="ex: 1850701123456" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField name="date_naissance" render={({ field }) => (<FormItem><FormLabel>Date de naissance</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField name="lieu_naissance" render={({ field }) => (<FormItem><FormLabel>Lieu de naissance</FormLabel><FormControl><Input placeholder="ex: 75001 Paris" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField name="nationalite" render={({ field }) => (<FormItem><FormLabel>Nationalité</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                      
                      <h3 className="font-semibold pt-4">Adresse</h3>
                      <FormField name="adresse.rue" render={({ field }) => (<FormItem><FormLabel>Rue</FormLabel><FormControl><Input placeholder="1 Rue de la Paix" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <div className="grid grid-cols-2 gap-4">
                        <FormField name="adresse.code_postal" render={({ field }) => (<FormItem><FormLabel>Code Postal</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField name="adresse.ville" render={({ field }) => (<FormItem><FormLabel>Ville</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                      </div>

                      <h3 className="font-semibold pt-4">Coordonnées bancaires</h3>
                      <FormField name="coordonnees_bancaires.iban" render={({ field }) => (<FormItem><FormLabel>IBAN</FormLabel><FormControl><Input placeholder="FR76..." {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField name="coordonnees_bancaires.bic" render={({ field }) => (<FormItem><FormLabel>BIC</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    </TabsContent>

                    <TabsContent value="contrat">
                      <div className="space-y-4">
                        <FormField name="hire_date" render={({ field }) => (<FormItem><FormLabel>Date d'entrée</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField name="job_title" render={({ field }) => (<FormItem><FormLabel>Intitulé du poste</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <div className="grid grid-cols-2 gap-4">
                          <FormField name="contract_type" render={({ field }) => (<FormItem><FormLabel>Type de contrat</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                          <FormField name="statut" render={({ field }) => (<FormItem><FormLabel>Statut</FormLabel><FormControl><Input placeholder="Non-Cadre" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                        <div className="grid grid-cols-2 gap-4 items-end">
                            <FormField name="duree_hebdomadaire" render={({ field }) => (<FormItem><FormLabel>Durée hebdo. (heures)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField
                                control={form.control}
                                name="is_temps_partiel"
                                render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                    <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                    <div className="space-y-1 leading-none">
                                    <FormLabel>Contrat à temps partiel</FormLabel>
                                    </div>
                                </FormItem>
                                )}
                            />
                        </div>
                        {/* <h3 className="font-semibold pt-4">Période d'essai</h3> */}
                        {/* <div className="grid grid-cols-3 gap-4">
                          <FormField name="periode_essai.duree_initiale" render={({ field }) => (<FormItem><FormLabel>Durée</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                          <FormField name="periode_essai.unite" render={({ field }) => (<FormItem><FormLabel>Unité</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger></FormControl>
                                <SelectContent><SelectItem value="jours">Jours</SelectItem><SelectItem value="semaines">Semaines</SelectItem><SelectItem value="mois">Mois</SelectItem></SelectContent>
                            </Select>
                          <FormMessage /></FormItem>)} />
                          {/* ... Ajoutez le champ pour 'renouvellement_possible' si nécessaire */}
                        {/* </div> */}
                      </div>
                    </TabsContent>

                    <TabsContent value="remuneration">
                      <div className="space-y-4">
                        <FormField 
                          name="salaire_de_base.valeur" 
                          control={form.control} 
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Salaire de base mensuel (€)</FormLabel>
                              <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} 
                        />
                        
                        <h3 className="font-semibold pt-4">Classification Conventionnelle</h3>
                        <div className="grid grid-cols-3 gap-4">
                          <FormField 
                            name="classification_conventionnelle.groupe_emploi" 
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Groupe</FormLabel>
                                <FormControl><Input {...field} /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )} 
                          />
                          <FormField 
                            name="classification_conventionnelle.classe_emploi" 
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Classe</FormLabel>
                                <FormControl><Input type="number" {...field} /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )} 
                          />
                          <FormField 
                            name="classification_conventionnelle.coefficient" 
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Coefficient</FormLabel>
                                <FormControl><Input type="number" {...field} /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )} 
                          />
                        </div>
                      </div>
                    </TabsContent>
                    <TabsContent value="avantages">
                      <div className="space-y-4">
                        <FormField
                          name="avantages_en_nature.repas.nombre_par_mois"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nombre de repas fournis par mois</FormLabel>
                              <FormControl><Input type="number" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} 
                        />
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            name="avantages_en_nature.logement.beneficie"
                            render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4">
                                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                <FormLabel>Bénéficie d'un logement de fonction</FormLabel>
                            </FormItem>
                            )}
                          />
                          <FormField
                            name="avantages_en_nature.vehicule.beneficie"
                            render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4">
                                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                <FormLabel>Bénéficie d'un véhicule de fonction</FormLabel>
                            </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    </TabsContent>
                    <TabsContent value="specifiques">
                      <div className="space-y-6">
                        {/* Prélèvement à la Source */}
                        <div>
                          <h3 className="font-semibold mb-2">Prélèvement à la Source (PAS)</h3>
                          <FormField
                            control={form.control}
                            name="specificites_paie.prelevement_a_la_source.is_personnalise"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                <FormLabel>Appliquer un taux personnalisé</FormLabel>
                              </FormItem>
                            )}
                          />
                          {/* Ce champ n'apparaît que si la case est cochée */}
                          {form.watch("specificites_paie.prelevement_a_la_source.is_personnalise") && (
                            <FormField
                              name="specificites_paie.prelevement_a_la_source.taux"
                              render={({ field }) => (
                                <FormItem className="mt-2 ml-7">
                                  <FormLabel>Taux personnalisé (%)</FormLabel>
                                  <FormControl><Input type="number" step="0.1" {...field} /></FormControl>
                                </FormItem>
                              )}
                            />
                          )}
                        </div>

                        {/* Indemnités */}
                        <div>
                          <h3 className="font-semibold mb-2">Indemnités & Avantages</h3>
                          <div className="space-y-4">
                            <FormField
                              name="specificites_paie.transport.abonnement_mensuel_total"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Abonnement transport mensuel total (€)</FormLabel>
                                  <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              name="specificites_paie.titres_restaurant.nombre_par_mois"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Nombre de titres-restaurant par mois</FormLabel>
                                  <FormControl><Input type="number" {...field} /></FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                        
                         {/* Couvertures Sociales */}
                        <div className="space-y-6">
                          {/* Section Mutuelle */}
                          <div>
                            <div className="flex justify-between items-center mb-2">
                              <h3 className="font-semibold">Mutuelle</h3>
                              <Button type="button" variant="outline" size="sm" onClick={() => appendMutuelle({ id: `mutuelle_${mutuelleFields.length + 1}`, libelle: '', montant_salarial: 0, montant_patronal: 0, part_patronale_soumise_a_csg: true })}>
                                <Plus className="mr-2 h-4 w-4" /> Ajouter une ligne
                              </Button>
                            </div>
                            <div className="space-y-4 rounded-md border p-4">
                              {mutuelleFields.map((field, index) => (
                                <div key={field.id} className="space-y-2 border-b pb-4 last:border-b-0">
                                  <FormField name={`specificites_paie.mutuelle.lignes_specifiques.${index}.libelle`} render={({ field }) => (<FormItem><FormLabel>Libellé</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                                  <div className="grid grid-cols-2 gap-4">
                                    <FormField name={`specificites_paie.mutuelle.lignes_specifiques.${index}.montant_salarial`} render={({ field }) => (<FormItem><FormLabel>Montant Salarial (€)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)} />
                                    <FormField name={`specificites_paie.mutuelle.lignes_specifiques.${index}.montant_patronal`} render={({ field }) => (<FormItem><FormLabel>Montant Patronal (€)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)} />
                                  </div>
                                  <FormField name={`specificites_paie.mutuelle.lignes_specifiques.${index}.part_patronale_soumise_a_csg`} render={({ field }) => (<FormItem className="flex flex-row items-center space-x-3 pt-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>Part patronale soumise à CSG</FormLabel></FormItem>)} />
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Section Prévoyance */}
                          <div>
                            <h3 className="font-semibold mb-2">Prévoyance</h3>
                            <div className="space-y-4 rounded-md border p-4">
                              <FormField name="specificites_paie.prevoyance.adhesion" render={({ field }) => (<FormItem className="flex flex-row items-center space-x-3"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>Adhésion Prévoyance</FormLabel></FormItem>)} />
                              
                              {/* Affichage conditionnel si Adhésion ET Cadre */}
                              {form.watch("specificites_paie.prevoyance.adhesion") && isCadre && (
                                <div className="pl-6 border-l-2 ml-2 space-y-4">
                                  <div className="flex justify-between items-center">
                                    <h4 className="text-sm font-medium">Lignes de Prévoyance (Cadre)</h4>
                                    <Button type="button" variant="outline" size="sm" onClick={() => appendPrevoyance({ id: `prevoyance_${prevoyanceFields.length + 1}`, libelle: '', salarial: 0, patronal: 0, forfait_social: 0 })}>
                                      <Plus className="mr-2 h-4 w-4" /> Ajouter
                                    </Button>
                                  </div>
                                  {prevoyanceFields.map((field, index) => (
                                    <div key={field.id} className="space-y-2 border-b pb-4 last:border-b-0">
                                      <FormField name={`specificites_paie.prevoyance.lignes_specifiques.${index}.libelle`} render={({ field }) => (<FormItem><FormLabel>Libellé</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                                      <div className="grid grid-cols-3 gap-4">
                                        <FormField name={`specificites_paie.prevoyance.lignes_specifiques.${index}.salarial`} render={({ field }) => (<FormItem><FormLabel>Taux Salarial (%)</FormLabel><FormControl><Input type="number" step="0.0001" {...field} /></FormControl></FormItem>)} />
                                        <FormField name={`specificites_paie.prevoyance.lignes_specifiques.${index}.patronal`} render={({ field }) => (<FormItem><FormLabel>Taux Patronal (%)</FormLabel><FormControl><Input type="number" step="0.0001" {...field} /></FormControl></FormItem>)} />
                                        <FormField name={`specificites_paie.prevoyance.lignes_specifiques.${index}.forfait_social`} render={({ field }) => (<FormItem><FormLabel>Forfait Social (%)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl></FormItem>)} />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </TabsContent>
                  </div>
                </Tabs>
                <DialogFooter>
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Enregistrer le contrat
                  </Button>
                </DialogFooter>
              </form>
            </Form>
                      </DialogContent>
        </Dialog>
      </div>
      
      <Card>
        <CardContent className="pt-6">
          <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" /><Input placeholder="Rechercher..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Liste des Salariés</CardTitle></CardHeader>
        <CardContent>
          <Table className="table-fixed">
            <TableHeader><TableRow><TableHead className="w-[40%]">Salarié</TableHead><TableHead className="w-[30%]">Poste</TableHead><TableHead className="w-[25%]">Contrat</TableHead><TableHead className="w-[5%]"></TableHead></TableRow></TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={4} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>}
              {error && <TableRow><TableCell colSpan={4} className="h-24 text-center text-destructive">{error}</TableCell></TableRow>}
              {!loading && !error && filteredEmployees.map((employee) => (
                <TableRow key={employee.id} onClick={() => navigate(`/employees/${employee.id}`)} className="cursor-pointer hover:bg-muted/50">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8"><AvatarFallback>{employee.first_name.charAt(0)}{employee.last_name.charAt(0)}</AvatarFallback></Avatar>
                      <div>
                        <p className="font-medium">{employee.first_name} {employee.last_name}</p>
                        <p className="text-xs text-muted-foreground">Entrée: {employee.hire_date ? new Date(employee.hire_date).toLocaleDateString('fr-FR') : 'N/A'}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{employee.job_title || 'N/A'}</TableCell>
                  <TableCell>{employee.contract_type ? getContractBadge(employee.contract_type) : 'N/A'}</TableCell>
                  <TableCell className="text-right">
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}