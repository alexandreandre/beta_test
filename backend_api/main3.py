# backend_api/main.py

# ==============================================================================
# 1. IMPORTATIONS
# ==============================================================================

# --- Bibliothèques standard ---
import os
import sys
import json
import subprocess
import traceback
from pathlib import Path
from datetime import datetime, timezone, timedelta, date
from typing import List, Any, Dict, Optional
from uuid import UUID
# --- Bibliothèques tierces ---
import requests
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict
from supabase import create_client, Client
import payroll_analyzer
from enum import Enum 
import calendar
from collections import defaultdict
from pydantic import BaseModel, ConfigDict

print("--- LECTURE DU FICHIER main.py ---")

# ==============================================================================
# 2. CONFIGURATION INITIALE DE L'APPLICATION
# ==============================================================================

# --- Chargement des variables d'environnement ---
load_dotenv()

# --- Initialisation de l'application FastAPI ---
app = FastAPI(title="API du SaaS RH")

# --- Configuration CORS (Cross-Origin Resource Sharing) ---
print("--- CONFIGURATION CORS ---")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Connexion à Supabase ---
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
if not supabase_url or not supabase_key:
    raise RuntimeError("Variables d'environnement SUPABASE manquantes.")
supabase: Client = create_client(supabase_url, supabase_key)

# --- Constantes ---
# Chemin vers le fichier actuel (main.py)
# -> /Users/alex/Desktop/Client_MAJI/SIRH/beta_test/backend_api/main.py
CURRENT_FILE_PATH = Path(__file__).resolve()

# Chemin vers le dossier qui contient main.py (backend_api)
# -> /Users/alex/Desktop/Client_MAJI/SIRH/beta_test/backend_api
API_DIR = CURRENT_FILE_PATH.parent

# Chemin vers le dossier parent qui contient backend_api ET Bulletin_de_paie
# -> /Users/alex/Desktop/Client_MAJI/SIRH/beta_test
PROJECT_ROOT = API_DIR.parent

# On construit le chemin absolu et fiable vers le moteur de paie
PATH_TO_PAYROLL_ENGINE = PROJECT_ROOT / "backend_calculs"

print(f"INFO: Chemin calculé pour le moteur de paie : {PATH_TO_PAYROLL_ENGINE}")
print("--- INITIALISATION TERMINÉE ---")

# ==============================================================================
# 3. MODÈLES DE DONNÉES (PYDANTIC)
# ==============================================================================

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

class ContributionRate(BaseModel):
    id: str
    libelle: str
    salarial: float | dict | str | None = None
    patronal: float | dict | str | None = None
    status: str

class DashboardRatesResponse(BaseModel):
    rates: List[ContributionRate]
    last_check: str | None = None

class PayslipRequest(BaseModel):
    employee_id: str
    year: int
    month: int

class ContractResponse(BaseModel):
    url: str | None = None

class CalendarData(BaseModel):
    day: int
    type: str
    hours: float | None = None

class CalendarResponse(BaseModel):
    planned: List[CalendarData]
    actual: List[CalendarData]

class PayslipInfo(BaseModel):
    id: str
    name: str
    month: int
    year: int
    url: str



class PlannedCalendarEntry(BaseModel):
    jour: int
    type: str
    heures_prevues: float | None = None

class PlannedCalendarRequest(BaseModel):
    year: int
    month: int
    calendrier_prevu: List[PlannedCalendarEntry]

class ActualHoursEntry(BaseModel):
    jour: int
    heures_faites: float | None = None
    type: str | None = None 

class ActualHoursRequest(BaseModel):
    year: int
    month: int
    calendrier_reel: List[ActualHoursEntry]

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


# --- Modèle de structure agrégée utilisée par le moteur de paie (ancien MonthlyInputsRequest) ---
class MonthlyInputsRequest(BaseModel):
    year: int
    month: int
    primes: list[dict] = []
    notes_de_frais: list[dict] = []
    acompte: Optional[float] = None

# ==============================================================================
# 4. ENDPOINTS DE L'API
# ==============================================================================

# --- Points de terminaison de base et de test ---

@app.get("/")
def read_root():
    """ Point de terminaison racine pour vérifier que l'API est en ligne. """
    print("DEBUG: Requête reçue sur GET /")
    return {"message": "API du SaaS RH fonctionnelle !"}

@app.post("/api/test-cors")
async def test_cors_endpoint(request: Request):
    """ Point de terminaison pour tester la configuration CORS. """
    print("--- ✅ REQUÊTE REÇUE SUR /api/test-cors ---")
    try:
        data = await request.json()
        print(f"--- ✅ CORPS DE LA REQUÊTE : {data} ---")
        return {"status": "ok", "received_data": data}
    except Exception as e:
        print(f"--- ❌ ERREUR LORS DE LA LECTURE DU CORPS : {e} ---")
        raise HTTPException(status_code=400, detail="Corps de la requête invalide.")

# --- Gestion des employés ---

@app.get("/api/employees", response_model=List[FullEmployee])
def get_employees():
    """ Récupère la liste de tous les salariés. """
    try:
        response = supabase.table('employees').select("*").order('last_name').execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/employees/{employee_id}", response_model=FullEmployee)
def get_employee_details(employee_id: str):
    """ Récupère les détails complets d'un seul salarié. """
    try:
        response = supabase.table('employees').select("*").eq('id', employee_id).single().execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Employé non trouvé.")
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/employees", response_model=FullEmployee, status_code=201)
async def create_employee(employee_data: NewFullEmployee):
    """
    Crée un nouvel employé, l'ajoute à la BDD et génère le fichier contrat.json
    pour le moteur de paie.
    """
    try:
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
        response = supabase.table('employees').insert(db_insert_data).execute()
        new_employee_db = response.data[0]

        # 3. Générer le fichier contrat.json pour le moteur de paie
        employee_path = PATH_TO_PAYROLL_ENGINE / "data" / "employes" / folder_name
        employee_path.mkdir(exist_ok=True, parents=True)

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

        return new_employee_db
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erreur interne : {str(e)}")

# --- Tableau de bord ---

@app.get("/api/dashboard/contribution-rates", response_model=DashboardRatesResponse)
def get_contribution_rates():
    """ Récupère les taux de cotisation et vérifie leur fraîcheur. """
    try:
        chemin_cotisations = PATH_TO_PAYROLL_ENGINE / "data" / "cotisations.json"
        data = json.loads(chemin_cotisations.read_text(encoding="utf-8"))
        last_scraped_str = data.get("meta", {}).get("last_scraped")
        rates_with_status = []

        if last_scraped_str:
            last_scraped_date = datetime.fromisoformat(last_scraped_str.replace("Z", "+00:00"))
            now = datetime.now(timezone.utc)
            delta = now - last_scraped_date

            for rate in data.get("cotisations", []):
                if delta > timedelta(days=7):
                    status = "red"
                elif delta > timedelta(days=1):
                    status = "orange"
                else:
                    status = "green"
                rate["status"] = status
                rates_with_status.append(rate)

        return {"rates": rates_with_status, "last_check": last_scraped_str}

    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Fichier cotisations.json introuvable.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))




# saas-rh-backend/main.py -> Remplacer la fonction

def parse_if_json_string(value: Any) -> Any:
    """Tente de parser une chaîne de caractères en JSON. Si ça échoue, retourne la chaîne originale."""
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return value
    return value

@app.post("/api/actions/generate-payslip")
def generate_payslip(request: PayslipRequest):
    """
    Workflow de génération de paie "juste à temps", 100% basé sur la BDD,
    avec une gestion propre des fichiers temporaires.
    """
    files_to_cleanup = []
    try:
        employee_id = request.employee_id
        year = request.year
        month = request.month

        # --- ÉTAPE 1 : RÉCUPÉRER TOUTES LES DONNÉES DEPUIS SUPABASE ---
        
        employee_data = supabase.table('employees').select("*").eq('id', employee_id).single().execute().data
        if not employee_data:
            raise HTTPException(status_code=404, detail="Employé non trouvé.")

        employee_folder_name = employee_data['employee_folder_name']
        duree_hebdo = employee_data.get('duree_hebdomadaire')
        if not duree_hebdo:
            raise HTTPException(status_code=400, detail="Durée hebdomadaire non définie.")

        dates_to_process = []
        for i in [-1, 0, 1]:
            d = date(year, month, 15)
            m_offset, y_offset = (d.month + i, d.year)
            if m_offset == 0: m_offset, y_offset = (12, y_offset - 1)
            elif m_offset == 13: m_offset, y_offset = (1, y_offset + 1)
            dates_to_process.append({'year': y_offset, 'month': m_offset})
        
        schedule_res = supabase.table('employee_schedules').select("year, month, planned_calendar, actual_hours") \
            .eq('employee_id', employee_id) \
            .in_('year', [d['year'] for d in dates_to_process]) \
            .in_('month', [d['month'] for d in dates_to_process]) \
            .execute()

        prev_month, prev_year = (month - 1, year) if month > 1 else (12, year - 1)
        cumuls_res = supabase.table('employee_schedules').select("cumuls").match({'employee_id': employee_id, 'year': prev_year, 'month': prev_month}).maybe_single().execute()
        saisies_res = supabase.table('monthly_inputs').select("name, amount").match({'employee_id': employee_id, 'year': year, 'month': month}).execute()

        # --- ÉTAPE 2 : PRÉPARATION ET CALCUL EN MÉMOIRE ---

        db_data_map = {(row['year'], row['month']): row for row in schedule_res.data}
        planned_data_all_months, actual_data_all_months = [], []
        for date_info in dates_to_process:
            y, m = date_info['year'], date_info['month']
            db_row = db_data_map.get((y, m))
            planned_list = (db_row.get('planned_calendar') or {}).get('calendrier_prevu', []) if db_row else []
            actual_list = (db_row.get('actual_hours') or {}).get('calendrier_reel', []) if db_row else []
            for entry in planned_list:
                new_entry = entry.copy(); new_entry.update({'annee': y, 'mois': m}); planned_data_all_months.append(new_entry)
            for entry in actual_list:
                new_entry = entry.copy(); new_entry.update({'annee': y, 'mois': m}); actual_data_all_months.append(new_entry)

        payroll_events_list = payroll_analyzer.analyser_horaires_du_mois(planned_data_all_months, actual_data_all_months, duree_hebdo, year, month, employee_folder_name)
        payroll_events_json = { "periode": {"annee": year, "mois": month}, "calendrier_analyse": payroll_events_list }
        
        saisies_data = { "periode": {"mois": month, "annee": year}, "primes": [] }
        for row in saisies_res.data:
            saisies_data["primes"].append({"prime_id": row['name'].replace(" ", "_"), "montant": row['amount']})
        
        previous_cumuls_data = (cumuls_res.data or {}).get('cumuls') if cumuls_res else None
        if previous_cumuls_data is None:
            previous_cumuls_data = { "periode": {"annee_en_cours": year, "dernier_mois_calcule": 0}, "cumuls": { "brut_total": 0.0, "heures_remunerees": 0.0, "reduction_generale_patronale": 0.0, "net_imposable": 0.0, "impot_preleve_a_la_source": 0.0, "heures_supplementaires_remunerees": 0.0 } }
        
        # --- ÉTAPE 3 : ÉCRIRE LES FICHIERS TEMPORAIRES ET EXÉCUTER ---
        
        employee_path = PATH_TO_PAYROLL_ENGINE / "data" / "employes" / employee_folder_name
        
        for sub_dir in ["evenements_paie", "saisies", "cumuls", "bulletins", "calendriers", "horaires"]:
            (employee_path / sub_dir).mkdir(parents=True, exist_ok=True)

        def write_temp_json(path: Path, data: dict):
            path.write_text(json.dumps(data, indent=2, ensure_ascii=False, default=str), encoding='utf-8')
            files_to_cleanup.append(path)

        contrat_json_content = {
            "salarie": {"nom": employee_data.get('last_name'),"prenom": employee_data.get('first_name'),"nir": employee_data.get('nir'),"date_naissance": employee_data.get('date_naissance'),"lieu_naissance": employee_data.get('lieu_naissance'),"nationalite": employee_data.get('nationalite'),"adresse": parse_if_json_string(employee_data.get('adresse')),"coordonnees_bancaires": parse_if_json_string(employee_data.get('coordonnees_bancaires')),},
            "contrat": {"date_entree": employee_data.get('hire_date'),"type_contrat": employee_data.get('contract_type'),"statut": employee_data.get('statut'),"emploi": employee_data.get('job_title'),"periode_essai": parse_if_json_string(employee_data.get('periode_essai')),"temps_travail": {"is_temps_partiel": employee_data.get('is_temps_partiel'), "duree_hebdomadaire": employee_data.get('duree_hebdomadaire')}},
            "remuneration": {"salaire_de_base": parse_if_json_string(employee_data.get('salaire_de_base')),"classification_conventionnelle": parse_if_json_string(employee_data.get('classification_conventionnelle')),"elements_variables": parse_if_json_string(employee_data.get('elements_variables')),"avantages_en_nature": parse_if_json_string(employee_data.get('avantages_en_nature')),},
            "specificites_paie": parse_if_json_string(employee_data.get('specificites_paie', {})),
        }
        write_temp_json(employee_path / "contrat.json", contrat_json_content)
        
        # Récupérer et écrire les fichiers bruts dont le script final pourrait avoir besoin
        write_temp_json(employee_path / "calendriers" / f"{month:02d}.json", (db_data_map.get((year, month)) or {}).get('planned_calendar') or {})
        write_temp_json(employee_path / "horaires" / f"{month:02d}.json", (db_data_map.get((year, month)) or {}).get('actual_hours') or {})

        # Écrire les fichiers calculés et de saisie
        write_temp_json(employee_path / "evenements_paie" / f"{month:02d}.json", payroll_events_json)
        events_res_M_minus_1 = supabase.table('employee_schedules').select("payroll_events").match({'employee_id': employee_id, 'year': prev_year, 'month': prev_month}).maybe_single().execute()
        payroll_events_M_minus_1 = (events_res_M_minus_1.data or {}).get('payroll_events') if events_res_M_minus_1 else {}
        write_temp_json(employee_path / "evenements_paie" / f"{prev_month:02d}.json", payroll_events_M_minus_1)
        write_temp_json(employee_path / "saisies" / f"{month:02d}.json", saisies_data)
        write_temp_json(employee_path / "cumuls" / f"{prev_month:02d}.json", previous_cumuls_data)

        script_path = str(PATH_TO_PAYROLL_ENGINE / "generateur_fiche_paie.py")
        command = [sys.executable, script_path, employee_folder_name, str(year), str(month)]
        proc = subprocess.run(command, capture_output=True, text=True, cwd=PATH_TO_PAYROLL_ENGINE, check=False)

        if proc.returncode != 0:
            raise HTTPException(status_code=500, detail=f"Le script de paie a échoué: {proc.stderr}")

        # --- ÉTAPE 4 : RÉCOLTER, SAUVEGARDER, ET NETTOYER ---
        payslip_json_data = json.loads(proc.stdout)
        
        new_cumuls_path = employee_path / "cumuls" / f"{month:02d}.json"
        new_cumuls_json = json.loads(new_cumuls_path.read_text(encoding="utf-8")) if new_cumuls_path.exists() else {}
        files_to_cleanup.append(new_cumuls_path)
        
        pdf_name = f"Bulletin_{employee_folder_name}_{month:02d}-{year}.pdf"
        local_pdf_path = employee_path / "bulletins" / pdf_name
        storage_path = f"{employee_folder_name}/{pdf_name}"
        files_to_cleanup.append(local_pdf_path)

        with open(local_pdf_path, 'rb') as f:
            supabase.storage.from_("payslips").upload(path=storage_path, file=f.read(), file_options={"x-upsert": "true"})

        signed_url_response = supabase.storage.from_("payslips").create_signed_url(storage_path, 3600, options={'download': True})
        pdf_url = signed_url_response['signedURL']

        supabase.table('payslips').upsert({
            "employee_id": employee_id, "month": month, "year": year, "name": pdf_name,
            "payslip_data": payslip_json_data, "pdf_storage_path": storage_path, "url": pdf_url
        }).execute()
       
        supabase.table('employee_schedules').update({"cumuls": new_cumuls_json, "payroll_events": payroll_events_json}).match({'employee_id': employee_id, 'year': year, 'month': month}).execute()

        return { "status": "success", "message": "Bulletin généré avec succès.", "download_url": pdf_url }

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        for path in files_to_cleanup:
            try:
                if path.exists(): path.unlink()
            except Exception as e:
                print(f"Erreur lors du nettoyage du fichier {path}: {e}", file=sys.stderr)

@app.delete("/api/payslips/{payslip_id}", status_code=204)
def delete_payslip(payslip_id: str):
    """ Supprime un bulletin de paie de la BDD et du stockage. """
    try:
        # 1. Récupérer le chemin du fichier PDF avant de supprimer l'entrée de la BDD
        payslip_to_delete = supabase.table('payslips').select("pdf_storage_path").eq('id', payslip_id).single().execute().data
        
        # 2. Supprimer l'entrée de la base de données
        supabase.table('payslips').delete().eq('id', payslip_id).execute()
        
        # 3. Si un fichier est associé, le supprimer du stockage
        if payslip_to_delete and payslip_to_delete.get('pdf_storage_path'):
            path = payslip_to_delete['pdf_storage_path']
            # Le nom du bucket doit être correct, ici "payslips"
            supabase.storage.from_('payslips').remove([path])
            
        return # FastAPI renverra automatiquement un statut 204 No Content

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
# --- Gestion des documents (Bulletins, Contrats, Calendriers) ---

@app.get("/api/employees/{employee_id}/payslips", response_model=List[PayslipInfo])
def get_employee_payslips(employee_id: str):
    """ Récupère la liste des bulletins générés pour un salarié. """
    try:
        payslips_db = supabase.table('payslips').select("id, month, year, pdf_storage_path").eq('employee_id', employee_id).execute().data
        if not payslips_db:
            return []

        paths_to_sign = [p['pdf_storage_path'] for p in payslips_db if p.get('pdf_storage_path')]
        if not paths_to_sign:
            return []

        # Générer les URLs de téléchargement en une seule fois
        signed_urls_response = supabase.storage.from_("payslips").create_signed_urls(paths_to_sign, 3600, options={'download': True})

        if isinstance(signed_urls_response, dict) and signed_urls_response.get('error'):
            raise Exception(f"Erreur Supabase Storage: {signed_urls_response.get('message')}")

        url_map = {path: url['signedURL'] for path, url in zip(paths_to_sign, signed_urls_response) if url.get('signedURL')}

        response_data = []
        for p in payslips_db:
            storage_path = p.get('pdf_storage_path')
            if storage_path in url_map:
                file_name = storage_path.split('/')[-1]
                response_data.append({
                    "id": p['id'],
                    "name": file_name,
                    "month": p['month'],
                    "year": p['year'],
                    "url": url_map[storage_path]
                })
        return response_data
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/employees/{employee_id}/contract", response_model=ContractResponse)
def get_employee_contract_url(employee_id: str):
    """ Génère une URL sécurisée pour le contrat PDF d'un salarié. """
    try:
        emp_response = supabase.table('employees').select("employee_folder_name").eq('id', employee_id).single().execute()
        if not emp_response.data:
            raise HTTPException(status_code=404, detail="Employé non trouvé.")
        folder_name = emp_response.data['employee_folder_name']

        path_to_file = f"{folder_name}/contrat.pdf"

        # Vérifier si le fichier existe avant de générer l'URL
        files_in_folder = supabase.storage.from_("contrats").list(folder_name)
        if not any(f['name'] == 'contrat.pdf' for f in files_in_folder):
            return {"url": None}

        signed_url_response = supabase.storage.from_("contrats").create_signed_url(path_to_file, 3600)
        return {"url": signed_url_response['signedURL']}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/employees/{employee_id}/calendar-data", response_model=CalendarResponse)
def get_employee_calendar(employee_id: str, year: int, month: int):
    """ Récupère les heures prévues et réelles pour le calendrier d'un salarié. """
    try:
        emp_response = supabase.table('employees').select("employee_folder_name").eq('id', employee_id).single().execute()
        if not emp_response.data:
            raise HTTPException(status_code=404, detail="Employé non trouvé.")
        folder_name = emp_response.data['employee_folder_name']

        employee_path = PATH_TO_PAYROLL_ENGINE / "data" / "employes" / folder_name

        # Charger les heures prévues
        planned_path = employee_path / "calendriers" / f"{month:02d}.json"
        planned_data = []
        if planned_path.exists():
            planned_data = json.loads(planned_path.read_text(encoding="utf-8")).get('calendrier_prevu', [])

        # Charger les heures réelles
        actual_path = employee_path / "horaires" / f"{month:02d}.json"
        actual_data = []
        if actual_path.exists():
            actual_data = json.loads(actual_path.read_text(encoding="utf-8")).get('calendrier_reel', [])

        return {"planned": planned_data, "actual": actual_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Points de terminaison de débogage ---

@app.get("/api/debug-storage/{employee_id}/{year}/{month}")
def debug_storage_file(employee_id: str, year: int, month: int):
    """
    Interroge directement l'API Supabase Storage pour obtenir les métadonnées
    d'un fichier PDF à des fins de diagnostic.
    """
    try:
        print(f"\n--- DÉBOGAGE ULTIME POUR {employee_id} - {month}/{year} ---")

        # Récupérer le nom du dossier de l'employé
        emp_response = supabase.table('employees').select("employee_folder_name").eq('id', employee_id).single().execute()
        if not emp_response.data:
            raise HTTPException(status_code=404, detail="Employé non trouvé.")
        folder_name = emp_response.data['employee_folder_name']

        # Reconstruire le chemin du fichier dans le stockage
        pdf_name = f"Bulletin_{folder_name}_{month:02d}-{year}.pdf"
        storage_path = f"{folder_name}/{pdf_name}"

        # Construire l'URL directe de l'API Supabase Storage
        file_url = f"{supabase_url}/storage/v1/object/info/payslips/{storage_path}"
        print(f"DEBUG: URL de l'API Storage interrogée : {file_url}")

        # Préparer les en-têtes d'authentification avec la clé de service
        headers = {
            "apikey": supabase_key,
            "Authorization": f"Bearer {supabase_key}"
        }

        # Effectuer l'appel direct à l'API de stockage
        response = requests.get(file_url, headers=headers)

        print("--- RÉPONSE BRUTE DE L'API SUPABASE STORAGE ---")
        print(f"Status Code: {response.status_code}")
        print(f"Headers: {response.headers}")
        print(f"Body: {response.text}")
        print("---------------------------------------------")

        return response.json()
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    


@app.get("/api/employees/{employee_id}/planned-calendar", response_model=PlannedCalendarRequest)
def get_planned_calendar(employee_id: str, year: int, month: int):
    """ Récupère le calendrier prévu depuis la table employee_schedules. """
    try:
        response = supabase.table('employee_schedules').select("planned_calendar") \
            .match({'employee_id': employee_id, 'year': year, 'month': month}) \
            .maybe_single().execute()

        # --- DÉBOGAGE AJOUTÉ ---
        print(f"DEBUG (planned): Réponse brute de Supabase: {response}")

        # --- CORRECTION DE ROBUSTESSE AJOUTÉE ---
        # On vérifie si l'objet response lui-même est None avant toute autre chose
        if response is None:
            print("AVERTISSEMENT (planned): La réponse de Supabase est None. On retourne un calendrier vide.")
            return {"year": year, "month": month, "calendrier_prevu": []}

        if not response.data or not response.data.get('planned_calendar'):
            return {"year": year, "month": month, "calendrier_prevu": []}
            
        return {
            "year": year, 
            "month": month, 
            "calendrier_prevu": response.data['planned_calendar'].get('calendrier_prevu', [])
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erreur interne: {str(e)}")

@app.post("/api/employees/{employee_id}/planned-calendar", status_code=200)
def update_planned_calendar(employee_id: str, payload: PlannedCalendarRequest):
    """ Met à jour (ou crée) le calendrier prévu dans la table employee_schedules. """
    try:
        json_content = {
            "periode": {"mois": payload.month, "annee": payload.year},
            "calendrier_prevu": [entry.model_dump() for entry in payload.calendrier_prevu]
        }
        
        # Upsert fait tout le travail : crée la ligne si elle n'existe pas, ou la met à jour si elle existe.
        supabase.table('employee_schedules').upsert({
            "employee_id": employee_id,
            "year": payload.year,
            "month": payload.month,
            "planned_calendar": json_content
        }, on_conflict="employee_id, year, month").execute()

        return {"status": "success", "message": "Planning prévisionnel enregistré."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- GESTION DES HEURES RÉELLES ---

@app.get("/api/employees/{employee_id}/actual-hours", response_model=ActualHoursRequest)
def get_actual_hours(employee_id: str, year: int, month: int):
    """ Récupère les heures réelles depuis la table employee_schedules. """
    try:
        response = supabase.table('employee_schedules').select("actual_hours") \
            .match({'employee_id': employee_id, 'year': year, 'month': month}) \
            .maybe_single().execute()

        # --- DÉBOGAGE AJOUTÉ ---
        print(f"DEBUG (actual): Réponse brute de Supabase: {response}")

        # --- CORRECTION DE ROBUSTESSE AJOUTÉE ---
        if response is None:
            print("AVERTISSEMENT (actual): La réponse de Supabase est None. On retourne un calendrier vide.")
            return {"year": year, "month": month, "calendrier_reel": []}
            
        if not response.data or not response.data.get('actual_hours'):
            return {"year": year, "month": month, "calendrier_reel": []}
            
        return {
            "year": year, 
            "month": month, 
            "calendrier_reel": response.data['actual_hours'].get('calendrier_reel', [])
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erreur interne: {str(e)}")
    
@app.post("/api/employees/{employee_id}/actual-hours", status_code=200)
def update_actual_hours(employee_id: str, payload: ActualHoursRequest):
    """ Met à jour (ou crée) les heures réelles dans la table employee_schedules. """
    try:
        json_content = {
            "periode": {"mois": payload.month, "annee": payload.year},
            "calendrier_reel": [entry.model_dump() for entry in payload.calendrier_reel]
        }
        
        supabase.table('employee_schedules').upsert({
            "employee_id": employee_id,
            "year": payload.year,
            "month": payload.month,
            "actual_hours": json_content
        }, on_conflict="employee_id, year, month").execute()

        return {"status": "success", "message": "Heures réelles enregistrées."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
# --- Ajoutez ce modèle Pydantic ---
class PayrollEventsResponse(BaseModel):
    status: str
    events_count: int




@app.post("/api/employees/{employee_id}/calculate-payroll-events", status_code=200)
def calculate_payroll_events(employee_id: str, request_body: dict):
    """
    Déclenche le calcul des événements de paie pour un employé sur une période donnée.
    """
    try:
        year = int(request_body.get('year'))
        month = int(request_body.get('month'))

        print(f"\n--- Début du calcul de paie pour l'employé {employee_id} ({month}/{year}) ---", file=sys.stderr)

        # 1. Récupération des données du contrat
        employee_res = supabase.table('employees').select("employee_folder_name, duree_hebdomadaire").eq('id', employee_id).single().execute()
        if not employee_res.data:
            raise HTTPException(status_code=404, detail="Employé non trouvé.")
        employee_name = employee_res.data['employee_folder_name']
        duree_hebdo = employee_res.data.get('duree_hebdomadaire')
        if not duree_hebdo:
            raise HTTPException(status_code=400, detail="La durée hebdomadaire du contrat n'est pas définie.")

        # 2. Récupération des horaires (M-1, M, M+1)
        dates_to_process = []
        for i in [-1, 0, 1]:
            d = date(year, month, 15)
            target_month, target_year = (d.month + i, d.year)
            if target_month == 0: target_month, target_year = (12, target_year - 1)
            elif target_month == 13: target_month, target_year = (1, target_year + 1)
            dates_to_process.append({'year': target_year, 'month': target_month})
        
        schedule_res = supabase.table('employee_schedules').select("year, month, planned_calendar, actual_hours") \
            .eq('employee_id', employee_id) \
            .in_('year', [d['year'] for d in dates_to_process]) \
            .in_('month', [d['month'] for d in dates_to_process]) \
            .execute()

        ### ESPION 1 : VÉRIFIE LES DONNÉES BRUTES REÇUES DE SUPABASE ###
        print("\n" + "="*20 + " ESPION 1 : DONNÉES BRUTES DE SUPABASE " + "="*20)
        # Utilise json.dumps pour un affichage propre, en gérant les erreurs si l'objet n'est pas sérialisable
        try:
            print(json.dumps(schedule_res.data, indent=2))
        except TypeError:
            print(schedule_res.data)
        print("="*67 + "\n")
        
        print(f"-> Données de {len(schedule_res.data)} mois récupérées depuis Supabase.", file=sys.stderr)

        # 3. Préparation et enrichissement des données
        db_data_map = {(row['year'], row['month']): row for row in schedule_res.data}
        planned_data_all_months, actual_data_all_months = [], []
        for date_info in dates_to_process:
            y, m = date_info['year'], date_info['month']
            db_row = db_data_map.get((y, m))
            if db_row:
                planned_list = (db_row.get('planned_calendar') or {}).get('calendrier_prevu', [])
                actual_list = (db_row.get('actual_hours') or {}).get('calendrier_reel', [])
                for entry in planned_list: entry.update({'annee': y, 'mois': m})
                for entry in actual_list: entry.update({'annee': y, 'mois': m})
                planned_data_all_months.extend(planned_list)
                actual_data_all_months.extend(actual_list)
        
        ### ESPION 2 : VÉRIFIE LES DONNÉES PRÊTES POUR L'ANALYSE (DÉJÀ EN PLACE) ###
        print("\n" + "="*20 + " ESPION 2 : DONNÉES PRÊTES POUR L'ANALYSEUR " + "="*20)
        print("Contenu de la variable 'planned_data_all_months' :")
        print(json.dumps(planned_data_all_months, indent=2))
        print("="*75 + "\n")


        # --- 4. Appel de l'analyseur avec les données prêtes ---
        payroll_events_list = payroll_analyzer.analyser_horaires_du_mois(
            planned_data_all_months=planned_data_all_months,
            actual_data_all_months=actual_data_all_months,
            duree_hebdo_contrat=duree_hebdo,
            annee=year,
            mois=month,
            employee_name=employee_name
        )
        print(f"-> Analyse terminée : {len(payroll_events_list)} événements de paie générés.", file=sys.stderr)

        # --- 5. Sauvegarde du résultat ---
        result_json = {"periode": {"annee": year, "mois": month}, "calendrier_analyse": payroll_events_list}
        supabase.table('employee_schedules').update({"payroll_events": result_json}) \
            .match({'employee_id': employee_id, 'year': year, 'month': month}) \
            .execute()
        print(f"-> Résultat sauvegardé avec succès.", file=sys.stderr)

        return {"status": "success", "message": f"{len(payroll_events_list)} événements de paie calculés."}

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    
    
    
@app.get("/api/employees/{employee_id}/monthly-inputs")
def get_monthly_inputs(employee_id: str, year: int, month: int):
    """
    Récupère les saisies ponctuelles du mois pour un employé.
    """
    response = (
        supabase.table('monthly_inputs')
        .select("*")
        .match({'employee_id': employee_id, 'year': year, 'month': month})
        .order('created_at', desc=True)
        .execute()
    )

    if not response.data:
        return {
            "year": year,
            "month": month,
            "primes": [],
            "notes_de_frais": [],
            "acompte": None
        }

    # Regroupe les saisies sous forme structurée comme attendue par le moteur
    primes = []
    notes_de_frais = []
    autres = []

    for row in response.data:
        nom = row.get("name", "")
        entry = {"prime_id": nom.replace(" ", "_"), "montant": float(row["amount"])}
        if "prime" in nom.lower():
            primes.append(entry)
        elif "frais" in nom.lower():
            notes_de_frais.append(entry)
        else:
            autres.append(entry)


    return {
        "year": year,
        "month": month,
        "primes": primes,
        "notes_de_frais": notes_de_frais,
        "autres": autres if autres else [],
        "acompte": None,
    }


@app.get("/api/monthly-inputs")
def list_monthly_inputs(year: int, month: int):
    """Retourne toutes les saisies ponctuelles du mois, tous salariés confondus"""
    response = supabase.table('monthly_inputs') \
        .select("*") \
        .match({"year": year, "month": month}) \
        .order("created_at", desc=True) \
        .execute()
    return response.data


# saas-rh-backend/main.py -> Remplacer la fonction

# --- Remplace l'endpoint de création par celui-ci ---
@app.post("/api/monthly-inputs", status_code=201)
def create_monthly_inputs(payload: List[MonthlyInput]):
    """
    [VERSION DE DÉBOGAGE]
    Crée une ou plusieurs saisies mensuelles dans la table monthly_inputs.
    """
    try:
        print("\n\n--- [DEBUG] DANS L'ENDPOINT 'create_monthly_inputs' ---", file=sys.stderr)
        print(f"1. Payload brut reçu et validé par Pydantic ({len(payload)} objet(s)):", file=sys.stderr)
        
        # On affiche le type de l'employee_id pour le premier objet pour vérifier
        if payload:
            print(f"   -> Type de 'employee_id' après validation Pydantic: {type(payload[0].employee_id)}", file=sys.stderr)

        # On utilise model_dump(mode='json') qui applique notre configuration 'json_encoders'
        # pour convertir UUID en string.
        data_to_insert = [item.model_dump(mode='json', exclude_none=True) for item in payload]
        
        print("\n2. Données prêtes pour l'insertion (après model_dump):", file=sys.stderr)
        print(json.dumps(data_to_insert, indent=2), file=sys.stderr)
        if data_to_insert:
             print(f"   -> Type de 'employee_id' après model_dump: {type(data_to_insert[0]['employee_id'])}", file=sys.stderr)

        print("\n3. Envoi à Supabase...", file=sys.stderr)
        response = supabase.table("monthly_inputs").insert(data_to_insert).execute()
        
        print("\n4. Réponse de Supabase reçue.", file=sys.stderr)
        return {"status": "success", "inserted": len(response.data)}

    except Exception as e:
        print("❌ ERREUR dans create_monthly_inputs :", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        raise HTTPException(status_code=500, detail=str(e))
    


@app.delete("/api/monthly-inputs/{input_id}")
def delete_monthly_input(input_id: str):
    """Supprime une saisie ponctuelle"""
    supabase.table('monthly_inputs').delete().eq("id", input_id).execute()
    return {"status": "success"}


# --- Récupération des saisies du mois d’un employé ---
@app.get("/api/employees/{employee_id}/monthly-inputs")
def get_employee_monthly_inputs(employee_id: str, year: int, month: int):
    """
    Retourne toutes les saisies ponctuelles (prime, acompte, etc.) pour un employé donné.
    """
    response = (
        supabase.table("monthly_inputs")
        .select("*")
        .match({"employee_id": employee_id, "year": year, "month": month})
        .order("created_at", desc=True)
        .execute()
    )
    return response.data or []


# --- Création d'une ou plusieurs saisies pour un employé ---
@app.post("/api/employees/{employee_id}/monthly-inputs", status_code=201)
async def create_employee_monthly_inputs(employee_id: str, request: Request):
    """
    Crée une ou plusieurs saisies ponctuelles pour un employé spécifique.
    """
    try:
        payload = await request.json()
        print(f"📥 [POST /employees/{employee_id}/monthly-inputs] Payload reçu :", payload)

        # Vérification du type (objet unique ou liste)
        if isinstance(payload, list):
            for p in payload:
                p["employee_id"] = employee_id
            response = supabase.table("monthly_inputs").insert(payload).execute()
        else:
            payload["employee_id"] = employee_id
            response = supabase.table("monthly_inputs").insert([payload]).execute()

        print("✅ Insertion réussie :", response.data)
        return {"status": "success", "inserted": len(response.data)}

    except Exception as e:
        print("❌ Erreur create_employee_monthly_inputs :", e)
        raise HTTPException(status_code=500, detail=str(e))


# --- Suppression d'une saisie d’un employé ---
@app.delete("/api/employees/{employee_id}/monthly-inputs/{input_id}")
def delete_employee_monthly_input(employee_id: str, input_id: str):
    """Supprime une saisie ponctuelle pour un employé donné"""
    try:
        supabase.table("monthly_inputs").delete().eq("id", input_id).eq("employee_id", employee_id).execute()
        return {"status": "success"}
    except Exception as e:
        print("❌ Erreur delete_employee_monthly_input :", e)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/primes-catalogue")
def get_primes_catalogue():
    try:
        primes_path = PATH_TO_PAYROLL_ENGINE / "data" / "primes.json"
        print(f"[DEBUG] Lecture du fichier: {primes_path}")
        raw = primes_path.read_text(encoding="utf-8")
        print("[DEBUG] Contenu brut du fichier:")
        print(raw)
        primes_data = json.loads(raw)
        return primes_data.get("primes", [])
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erreur interne: {type(e).__name__}: {e}")
