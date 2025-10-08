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
import { Textarea } from "@/components/ui/textarea";
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
import { ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { MonthlyInput } from "@/api/saisies";

// --- Types & Interfaces ---
interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  job_title: string;
}

interface SaisieModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    data: Omit<MonthlyInput, "id" | "created_at" | "updated_at">[]
  ) => void;
  employees: Employee[];
  mode?: "single"; // plus de mode recurring ici
}



const initialState = {
  name: "",
  description: "",
  amount: "" as number | "",
  selectedEmployees: [] as string[],
  soumise_a_csg: true,
};

export function SaisieModal({
  isOpen,
  onClose,
  onSave,
  employees,
}: SaisieModalProps) {
  const [formData, setFormData] = useState(initialState);
  const [popoverOpen, setPopoverOpen] = useState(false);

  // Réinitialiser le formulaire à chaque ouverture
  useEffect(() => {
    if (isOpen) setFormData(initialState);
  }, [isOpen]);

  const handleSave = () => {
    if (!formData.name || !formData.amount || formData.selectedEmployees.length === 0) {
      alert("Veuillez remplir le nom, le montant et sélectionner au moins un employé.");
      return;
    }

    // On crée une saisie par employé sélectionné
    const payloads = formData.selectedEmployees.map((employee_id) => ({
      employee_id,
      name: formData.name,
      description: formData.description,
      amount: Number(formData.amount),
      year: new Date().getFullYear(),
      month: new Date().getMonth() + 1,
    }));

    onSave(payloads);
    onClose();
  };

  const handleSelectAll = () => {
    if (formData.selectedEmployees.length === employees.length) {
      setFormData((prev) => ({ ...prev, selectedEmployees: [] }));
    } else {
      setFormData((prev) => ({
        ...prev,
        selectedEmployees: employees.map((e) => e.id),
      }));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-background/80 backdrop-blur-xl border-white/20 sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Ajouter une saisie du mois</DialogTitle>
          <DialogDescription>
            Cette saisie sera appliquée uniquement pour le mois en cours.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Nom / Libellé */}
          <div className="grid gap-2">
            <Label>Nom / Libellé</Label>
            <Input
              value={formData.name}
              onChange={(e) =>
                setFormData((p) => ({ ...p, name: e.target.value }))
              }
              placeholder="ex: Prime exceptionnelle"
            />
          </div>

          {/* Montant */}
          <div className="grid gap-2">
            <Label>Montant (€)</Label>
            <Input
              type="number"
              value={formData.amount}
              onChange={(e) =>
                setFormData((p) => ({
                  ...p,
                  amount: e.target.value ? parseFloat(e.target.value) : "",
                }))
              }
              placeholder="ex: 150"
            />
          </div>

          {/* Description */}
          <div className="grid gap-2">
            <Label>Description (facultatif)</Label>
            <Textarea
              value={formData.description}
              onChange={(e) =>
                setFormData((p) => ({ ...p, description: e.target.value }))
              }
              placeholder="Informations additionnelles..."
            />
          </div>
          {/* Soumise à cotisations */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="soumise_a_csg"
              checked={formData.soumise_a_csg ?? true}
              onChange={(e) =>
                setFormData((p) => ({ ...p, soumise_a_csg: e.target.checked }))
              }
              className="accent-primary h-4 w-4"
            />
            <label
              htmlFor="soumise_a_csg"
              className="text-sm text-muted-foreground select-none"
            >
              Soumise à cotisations sociales
            </label>
          </div>


          {/* Sélecteur d’employés */}
          <div className="grid gap-2">
            <Label>Appliquer à</Label>
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between">
                  {formData.selectedEmployees.length > 0
                    ? `${formData.selectedEmployees.length} employé(s) sélectionné(s)`
                    : "Sélectionner des employés..."}
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
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            formData.selectedEmployees.length === employees.length
                              ? "opacity-100"
                              : "opacity-0"
                          )}
                        />
                        {formData.selectedEmployees.length === employees.length
                          ? "Tout désélectionner"
                          : "Tout sélectionner"}
                      </CommandItem>

                      {employees.map((employee) => (
                        <CommandItem
                          key={employee.id}
                          value={`${employee.first_name} ${employee.last_name}`}
                          onSelect={() => {
                            const isSelected = formData.selectedEmployees.includes(employee.id);
                            setFormData((p) => ({
                              ...p,
                              selectedEmployees: isSelected
                                ? p.selectedEmployees.filter((id) => id !== employee.id)
                                : [...p.selectedEmployees, employee.id],
                            }));
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              formData.selectedEmployees.includes(employee.id)
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
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
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSave}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
