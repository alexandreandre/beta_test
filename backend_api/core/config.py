# backend_api/core/config.py

import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# --- Chargement des variables d'environnement ---
load_dotenv()

# --- Initialisation de l'application FastAPI ---
app = FastAPI(title="API du SaaS RH")

# --- Configuration CORS (Cross-Origin Resource Sharing) ---
print("--- CONFIGURATION CORS ---")
app.add_middleware(
    CORSMiddleware,
    # Autorise les requêtes depuis votre frontend Vue.js
    allow_origins=["http://localhost:8080"], 
    allow_credentials=True,
    # Autorise toutes les méthodes (GET, POST, etc.)
    allow_methods=["*"],
    # Autorise tous les en-têtes (y compris Authorization)
    allow_headers=["*"],
    # Empêche les requêtes OPTIONS d'aller plus loin que le middleware
    max_age=3600, # Optionnel: met en cache la réponse OPTIONS pour 1h
)

# --- Connexion à Supabase ---
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_KEY")
if not supabase_url or not supabase_key:
    raise RuntimeError("Variables d'environnement SUPABASE manquantes.")
supabase: Client = create_client(supabase_url, supabase_key)

# --- Constantes ---
# Chemin vers le fichier actuel (main.py)
# -> /Users/alex/Desktop/Client_MAJI/SIRH/beta_test/backend_api/main.py
CURRENT_FILE_PATH = Path(__file__).resolve()

# ...
# Chemin vers le dossier 'core'
# -> backend_api/core
CORE_DIR = CURRENT_FILE_PATH.parent

# Chemin vers le dossier 'backend_api'
# -> backend_api
API_DIR = CORE_DIR.parent

# Chemin vers le dossier racine du projet qui contient backend_api et backend_calculs
# -> beta_test
PROJECT_ROOT = API_DIR.parent


# On construit le chemin absolu et fiable vers le moteur de paie
PATH_TO_PAYROLL_ENGINE = PROJECT_ROOT / "backend_calculs"

print(f"INFO: Chemin calculé pour le moteur de paie : {PATH_TO_PAYROLL_ENGINE}")
print("--- INITIALISATION TERMINÉE ---")
