// src/components/SaisieModal.tsx (VERSION FINALE ET DÉFINITIVE)

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import * as saisiesApi from "@/api/saisies";

// --- Types & Interfaces ---
interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  job_title: string;
}

type PrimeFromCatalogue = saisiesApi.PrimeFromCatalogue;
type MonthlyInputCreate = saisiesApi.MonthlyInputCreate; // Le type pour notre payload

interface SaisieModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: MonthlyInputCreate[]) => void; // <-- CORRECTION APPLIQUÉE ICI
  employees: Employee[];
  employeeScopeId?: string;
}

const initialState = {
  name: "",
  amount: "" as number | "",
  description: "",
  selectedEmployees: [] as string[],
  is_socially_taxed: true,
  is_taxable: true,
};

export function SaisieModal({ isOpen, onClose, onSave, employees, employeeScopeId }: SaisieModalProps) {
  const [formData, setFormData] = useState(initialState);
  const [primesCatalogue, setPrimesCatalogue] = useState<PrimeFromCatalogue[]>([]);
  const [isCustomPrime, setIsCustomPrime] = useState(true);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [employeePopoverOpen, setEmployeePopoverOpen] = useState(false);

  useEffect(() => {
    saisiesApi.getPrimesCatalogue().then(res => setPrimesCatalogue(res.data));
  }, []);

  useEffect(() => {
    if (isOpen) {
      setFormData(initialState);
      setIsCustomPrime(true);
      if (employeeScopeId) {
        setFormData(prev => ({ ...prev, selectedEmployees: [employeeScopeId] }));
      }
    }
  }, [isOpen, employeeScopeId]);

  const handleSave = () => {
    if (!formData.name || !formData.amount || formData.selectedEmployees.length === 0) {
      alert("Veuillez remplir le nom, le montant et sélectionner au moins un employé.");
      return;
    }
    const payloads: MonthlyInputCreate[] = formData.selectedEmployees.map(empId => ({
      employee_id: empId,
      name: formData.name,
      description: formData.description,
      amount: Number(formData.amount),
      is_socially_taxed: formData.is_socially_taxed,
      is_taxable: formData.is_taxable,
      year: new Date().getFullYear(),
      month: new Date().getMonth() + 1,
    }));
    onSave(payloads);
  };
  
  const handlePrimeSelect = (prime: PrimeFromCatalogue) => {
    setFormData(prev => ({
      ...prev,
      name: prime.libelle,
      is_socially_taxed: prime.soumise_a_cotisations,
      is_taxable: prime.soumise_a_impot,
    }));
    setIsCustomPrime(false);
  };
  
  const handleCustomInputChange = (value: string) => {
    setFormData(prev => ({ ...prev, name: value }));
    // Si l'utilisateur tape un nom qui ne correspond à aucune prime du catalogue, on active les cases
    const isStandardPrime = primesCatalogue.some(p => p.libelle === value);
    setIsCustomPrime(!isStandardPrime);
  };

  const handleSelectAll = () => {
    if (formData.selectedEmployees.length === employees.length) {
        setFormData(prev => ({ ...prev, selectedEmployees: [] }));
    } else {
        setFormData(prev => ({ ...prev, selectedEmployees: employees.map(e => e.id) }));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-background/80 backdrop-blur-xl border-white/20 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter une Saisie du Mois</DialogTitle>
          <DialogDescription>
            {employeeScopeId ? "Cette saisie ponctuelle ne s'appliquera que pour le mois en cours." : "Créez une saisie pour un ou plusieurs employés."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          
          <div className="grid gap-2">
            <Label>Nom / Type de Saisie</Label>
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger asChild>
                 <Input 
                   placeholder="Sélectionnez ou saisissez un nom..."
                   value={formData.name}
                   onChange={e => handleCustomInputChange(e.target.value)}
                   onClick={() => setPopoverOpen(true)}
                 />
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                  <CommandInput placeholder="Rechercher une prime..." />
                  <CommandList>
                    <CommandEmpty>Aucune prime trouvée. Le nom saisi sera utilisé.</CommandEmpty>
                    <CommandGroup heading="Primes Standard">
                      {primesCatalogue.map((prime) => (
                        <CommandItem key={prime.id} value={prime.libelle} onSelect={() => {
                          handlePrimeSelect(prime);
                          setPopoverOpen(false);
                        }}>
                          <Check className={cn("mr-2 h-4 w-4", formData.name === prime.libelle && !isCustomPrime ? "opacity-100" : "opacity-0")}/>
                          {prime.libelle}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid gap-2">
            <Label>Montant (€)</Label>
            <Input type="number" value={formData.amount} onChange={e => setFormData(p => ({ ...p, amount: e.target.value ? parseFloat(e.target.value) : '' }))} />
          </div>
          
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="flex items-center space-x-2">
              <Checkbox id="is_socially_taxed" checked={formData.is_socially_taxed} disabled={!isCustomPrime} onCheckedChange={(c) => setFormData(p => ({ ...p, is_socially_taxed: !!c }))}/>
              <Label htmlFor="is_socially_taxed" className={cn("cursor-pointer", !isCustomPrime && "text-muted-foreground")}>Soumise à cotisations</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="is_taxable" checked={formData.is_taxable} disabled={!isCustomPrime} onCheckedChange={(c) => setFormData(p => ({ ...p, is_taxable: !!c }))}/>
              <Label htmlFor="is_taxable" className={cn("cursor-pointer", !isCustomPrime && "text-muted-foreground")}>Soumise à impôt</Label>
            </div>
          </div>
          
          {!employeeScopeId && (
             <div className="grid gap-2">
              <Label>Appliquer à</Label>
              <Popover open={employeePopoverOpen} onOpenChange={setEmployeePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                    {formData.selectedEmployees.length > 0 ? `${formData.selectedEmployees.length} employé(s) sélectionné(s)`: "Sélectionner des employés..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <Command>
                    <CommandInput placeholder="Rechercher un employé..." />
                    <CommandList>
                      <CommandEmpty>Aucun employé trouvé.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem onSelect={handleSelectAll} className="cursor-pointer">
                          <Check className={cn("mr-2 h-4 w-4", formData.selectedEmployees.length === employees.length ? "opacity-100" : "opacity-0")}/>
                          {formData.selectedEmployees.length === employees.length ? "Tout désélectionner" : "Tout sélectionner"}
                        </CommandItem>
                        {employees.map((employee) => (
                          <CommandItem key={employee.id} value={`${employee.first_name} ${employee.last_name}`} onSelect={() => {
                            const isSelected = formData.selectedEmployees.includes(employee.id);
                            setFormData((p) => ({...p, selectedEmployees: isSelected ? p.selectedEmployees.filter((id) => id !== employee.id) : [...p.selectedEmployees, employee.id]}));
                          }}>
                            <Check className={cn("mr-2 h-4 w-4", formData.selectedEmployees.includes(employee.id) ? "opacity-100" : "opacity-0")}/>
                            <div>
                              <p>{employee.first_name} {employee.last_name}</p>
                              <p className="text-xs text-muted-foreground">{employee.job_title}</p>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          )}

        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSave}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}