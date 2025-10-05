# saas-rh-backend/main.py

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
from typing import List, Any, Dict

# --- Bibliothèques tierces ---
import requests
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client

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
PATH_TO_PAYROLL_ENGINE = Path("../Bulletin_de_paie")

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

# --- Actions (Génération, suppression de bulletins) ---

@app.post("/api/actions/generate-payslip")
def generate_payslip(request: PayslipRequest):
    """ Exécute le moteur de paie pour générer un bulletin. """
    try:
        # 1. Récupérer le nom du dossier de l'employé
        emp_response = supabase.table('employees').select("employee_folder_name").eq('id', request.employee_id).single().execute()
        if not emp_response.data:
            raise HTTPException(status_code=404, detail="Employé non trouvé.")
        employee_folder = emp_response.data['employee_folder_name']

        # 2. Exécuter le script de paie
        script_path = str(PATH_TO_PAYROLL_ENGINE / "generateur_fiche_paie.py")
        command = [sys.executable, script_path, employee_folder, str(request.year), str(request.month)]
        proc = subprocess.run(command, capture_output=True, text=True, cwd=PATH_TO_PAYROLL_ENGINE, check=False)

        if proc.returncode != 0:
            raise HTTPException(status_code=500, detail=f"Le script de paie a échoué: {proc.stderr}")

        # 3. Capturer le JSON de sortie du script
        try:
            payslip_json_data = json.loads(proc.stdout)
        except json.JSONDecodeError:
            raise HTTPException(status_code=500, detail="La sortie du script de paie n'est pas un JSON valide.")

        # 4. Téléverser le PDF sur Supabase Storage
        pdf_name = f"Bulletin_{employee_folder}_{request.month:02d}-{request.year}.pdf"
        local_pdf_path = PATH_TO_PAYROLL_ENGINE / "data" / "employes" / employee_folder / "bulletins" / pdf_name
        storage_path = f"{employee_folder}/{pdf_name}"

        with open(local_pdf_path, 'rb') as f:
            supabase.storage.from_("bulletins-de-paie").upload(
                path=storage_path,
                file=f,
                file_options={"x-upsert": "true", "content-type": "application/pdf"}
            )

        # 5. Sauvegarder les informations dans la table 'payslips'
        supabase.table('payslips').upsert({
            "employee_id": request.employee_id,
            "month": request.month,
            "year": request.year,
            "payslip_data": payslip_json_data,
            "pdf_storage_path": storage_path,
        }).execute()

        # 6. Créer une URL signée pour le retour
        signed_url_response = supabase.storage.from_("bulletins-de-paie").create_signed_url(storage_path, 3600)

        return {
            "status": "success",
            "message": "Bulletin généré et sauvegardé avec succès.",
            "download_url": signed_url_response['signedURL']
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/payslips/{payslip_id}", status_code=204)
def delete_payslip(payslip_id: str):
    """ Supprime un bulletin de paie de la BDD et du stockage. """
    try:
        # 1. Récupérer le chemin du fichier PDF avant de supprimer l'entrée
        payslip_to_delete = supabase.table('payslips').select("pdf_storage_path").eq('id', payslip_id).single().execute().data

        # 2. Supprimer l'entrée de la base de données
        supabase.table('payslips').delete().eq('id', payslip_id).execute()

        # 3. Si un fichier est associé, le supprimer du stockage
        if payslip_to_delete and payslip_to_delete.get('pdf_storage_path'):
            path = payslip_to_delete['pdf_storage_path']
            supabase.storage.from_('bulletins-de-paie').remove([path])

        return
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
        signed_urls_response = supabase.storage.from_("bulletins-de-paie").create_signed_urls(paths_to_sign, 3600, options={'download': True})

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
        file_url = f"{supabase_url}/storage/v1/object/info/bulletins-de-paie/{storage_path}"
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