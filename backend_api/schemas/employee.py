# backend_api/schemas/employee.py

from pydantic import BaseModel
from datetime import date
from typing import Any, Dict

class FullEmployee(BaseModel):
    id: str
    employee_folder_name: str
    # Section Salarié
    first_name: str
    last_name: str
    nir: str | None = None
    date_naissance: date | None = None
    lieu_naissance: str | None = None
    nationalite: str | None = None
    adresse: Dict[str, Any] | None = None
    coordonnees_bancaires: Dict[str, Any] | None = None
    # Section Contrat
    hire_date: date | None = None
    contract_type: str | None = None
    statut: str | None = None
    job_title: str | None = None
    periode_essai: Dict[str, Any] | None = None
    is_temps_partiel: bool | None = None
    duree_hebdomadaire: float | None = None
    # Section Rémunération
    salaire_de_base: Dict[str, Any] | None = None
    classification_conventionnelle: Dict[str, Any] | None = None
    elements_variables: Dict[str, Any] | None = None
    avantages_en_nature: Dict[str, Any] | None = None
    # Section Spécificités
    specificites_paie: Dict[str, Any] | None = None

class NewFullEmployee(BaseModel):
    # Salarié
    first_name: str
    last_name: str
    nir: str
    date_naissance: date
    lieu_naissance: str
    nationalite: str
    adresse: Dict[str, Any]
    coordonnees_bancaires: Dict[str, Any]
    # Contrat
    hire_date: date
    contract_type: str
    statut: str
    job_title: str
    periode_essai: Dict[str, Any] | None = None
    is_temps_partiel: bool
    duree_hebdomadaire: float
    # Rémunération
    salaire_de_base: Dict[str, Any]
    classification_conventionnelle: Dict[str, Any]
    elements_variables: Dict[str, Any] | None = None
    avantages_en_nature: Dict[str, Any] | None = None
    # Spécificités
    specificites_paie: Dict[str, Any]