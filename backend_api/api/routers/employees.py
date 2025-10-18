# backend_api/api/routers/employees.py

import json
import traceback
from datetime import date
from typing import List
from fastapi import APIRouter, HTTPException

from core.config import supabase, PATH_TO_PAYROLL_ENGINE
from schemas.employee import FullEmployee, NewFullEmployee
from schemas.payslip import ContractResponse

router = APIRouter(
    prefix="/api/employees",
    tags=["Employees"]
)

@router.get("", response_model=List[FullEmployee])
def get_employees():
    """ Récupère la liste de tous les salariés. """
    try:
        print("DEBUG: Tentative de récupération de la liste des employés...")
        response = supabase.table('employees').select("*").order('last_name').execute()
        print("DEBUG: Réponse BRUTE de Supabase (get_employees):", response)
        if not response.data:
            print("WARN: Aucune donnée d'employé retournée. Vérifiez les Row Level Security (RLS) policies sur la table 'employees' dans Supabase.")
        print("DEBUG: Données extraites (response.data):", response.data)
        return response.data
    except Exception as e:
        print("ERROR: Exception dans get_employees:")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erreur interne du serveur: {str(e)}")

@router.get("/{employee_id}", response_model=FullEmployee)
def get_employee_details(employee_id: str):
    """ Récupère les détails complets d'un seul salarié. """
    try:
        print(f"DEBUG: Tentative de récupération de l'employé ID: {employee_id}")
        response = supabase.table('employees').select("*").eq('id', employee_id).single().execute()
        print(f"DEBUG: Réponse BRUTE de Supabase pour l'employé {employee_id}:", response)
        if not response.data:
            print(f"WARN: Employé {employee_id} non trouvé ou accès non autorisé (RLS).")
            raise HTTPException(status_code=404, detail="Employé non trouvé.")
        return response.data
    except Exception as e:
        print(f"ERROR: Exception dans get_employee_details pour l'ID {employee_id}:")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erreur interne du serveur: {str(e)}")

@router.post("", response_model=FullEmployee, status_code=201)
async def create_employee(employee_data: NewFullEmployee):
    """
    Crée un nouvel employé, l'ajoute à la BDD et génère le fichier contrat.json
    pour le moteur de paie.
    """
    try:
        print("DEBUG: Début de la création d'un nouvel employé.")
        folder_name = f"{employee_data.last_name.upper()}_{employee_data.first_name.capitalize()}"

        # 1. Préparer les données pour l'insertion en base de données
        db_insert_data = employee_data.model_dump()
        db_insert_data['employee_folder_name'] = folder_name

        # Convertir les dates en chaînes de caractères pour Supabase
        if isinstance(db_insert_data.get('date_naissance'), date):
            db_insert_data['date_naissance'] = db_insert_data['date_naissance'].isoformat()
        if isinstance(db_insert_data.get('hire_date'), date):
            db_insert_data['hire_date'] = db_insert_data['hire_date'].isoformat()

        # 2. Insérer les données dans Supabase
        print("DEBUG: Données prêtes pour l'insertion BDD:", db_insert_data)
        response = supabase.table('employees').insert(db_insert_data).execute()
        print("DEBUG: Réponse BRUTE de Supabase (insert):", response)
        new_employee_db = response.data[0]
        print("DEBUG: Nouvel employé inséré avec succès dans la BDD:", new_employee_db)

        # 3. Générer le fichier contrat.json pour le moteur de paie
        employee_path = PATH_TO_PAYROLL_ENGINE / "data" / "employes" / folder_name
        employee_path.mkdir(exist_ok=True, parents=True)
        print(f"DEBUG: Création du dossier pour le moteur de paie: {employee_path}")

        contrat_json_content = {
            "salarie": {
                "nom": employee_data.last_name,
                "prenom": employee_data.first_name,
                "nir": employee_data.nir,
                "date_naissance": employee_data.date_naissance.isoformat(),
                "lieu_naissance": employee_data.lieu_naissance,
                "nationalite": employee_data.nationalite,
                "adresse": employee_data.adresse,
                "coordonnees_bancaires": employee_data.coordonnees_bancaires,
            },
            "contrat": {
                "date_entree": employee_data.hire_date.isoformat(),
                "type_contrat": employee_data.contract_type,
                "statut": employee_data.statut,
                "emploi": employee_data.job_title,
                "periode_essai": employee_data.periode_essai,
                "temps_travail": {
                    "is_temps_partiel": employee_data.is_temps_partiel,
                    "duree_hebdomadaire": employee_data.duree_hebdomadaire
                },
            },
            "remuneration": {
                "salaire_de_base": employee_data.salaire_de_base,
                "classification_conventionnelle": employee_data.classification_conventionnelle,
                "elements_variables": employee_data.elements_variables,
                "avantages_en_nature": employee_data.avantages_en_nature,
            },
            "specificites_paie": employee_data.specificites_paie,
        }

        (employee_path / "contrat.json").write_text(
            json.dumps(contrat_json_content, indent=2, ensure_ascii=False),
            encoding='utf-8'
        )
        print(f"DEBUG: Fichier contrat.json généré avec succès.")

        return new_employee_db
    except Exception as e:
        print("ERROR: Exception dans create_employee:")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erreur interne : {str(e)}")

@router.get("/{employee_id}/contract", response_model=ContractResponse)
def get_employee_contract_url(employee_id: str):
    """ Génère une URL sécurisée pour le contrat PDF d'un salarié. """
    try:
        print(f"DEBUG: Récupération du nom de dossier pour l'employé {employee_id}.")
        emp_response = supabase.table('employees').select("employee_folder_name").eq('id', employee_id).single().execute()
        print(f"DEBUG: Réponse BRUTE de Supabase (get folder_name):", emp_response)
        if not emp_response.data:
            raise HTTPException(status_code=404, detail="Employé non trouvé.")
        folder_name = emp_response.data['employee_folder_name']

        path_to_file = f"{folder_name}/contrat.pdf"

        # Vérifier si le fichier existe avant de générer l'URL
        print(f"DEBUG: Vérification de l'existence du fichier '{path_to_file}' dans le bucket 'contrats'.")
        files_in_folder = supabase.storage.from_("contrats").list(folder_name)
        if not any(f['name'] == 'contrat.pdf' for f in files_in_folder):
            print(f"WARN: Le fichier contrat.pdf n'existe pas pour l'employé {employee_id}.")
            return {"url": None}

        print("DEBUG: Génération de l'URL signée...")
        signed_url_response = supabase.storage.from_("contrats").create_signed_url(path_to_file, 3600)
        print("DEBUG: URL signée générée avec succès.")
        return {"url": signed_url_response['signedURL']}
    except Exception as e:
        print(f"ERROR: Exception dans get_employee_contract_url pour l'ID {employee_id}:")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erreur interne du serveur: {str(e)}")
