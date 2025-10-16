# backend_api/schemas/monthly_input.py

from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from uuid import UUID
from datetime import datetime

# --- Nouveau modèle pour la table monthly_inputs ---
class MonthlyInput(BaseModel):
    id: Optional[UUID] = None
    employee_id: UUID
    year: int
    month: int
    name: str
    description: Optional[str] = None
    amount: float
    is_socially_taxed: bool = True
    is_taxable: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    # --- AJOUTEZ CETTE CONFIGURATION ---
    model_config = ConfigDict(
        json_encoders={
            UUID: str  # Dit à Pydantic : "Quand tu trouves un UUID, transforme-le en string"
        }
    )
# --- Modèle de création (pour POST /api/employees/{id}/monthly-inputs) ---
class MonthlyInputCreate(BaseModel):
    year: int
    month: int
    name: str
    description: Optional[str] = None
    amount: float
    # On ajoute les champs booléens ici
    is_socially_taxed: bool = True
    is_taxable: bool = True


# --- Modèle de structure agrégée utilisée par le moteur de paie (ancien MonthlyInputsRequest) ---
class MonthlyInputsRequest(BaseModel):
    year: int
    month: int
    primes: list[dict] = []
    notes_de_frais: list[dict] = []
    acompte: Optional[float] = None
