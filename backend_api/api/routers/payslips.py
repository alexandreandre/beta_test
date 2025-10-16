# backend_api/api/routers/payslips.py

import json
import traceback
import requests
from typing import List
from fastapi import APIRouter, HTTPException

from core.config import supabase, supabase_url, supabase_key
from schemas.payslip import PayslipRequest, PayslipInfo
from services.payslip_generator import process_payslip_generation

router = APIRouter(
    tags=["Payslips"]
)

@router.post("/api/actions/generate-payslip")
def generate_payslip(request: PayslipRequest):
    """ Déclenche le service de génération de fiche de paie. """
    return process_payslip_generation(
        employee_id=request.employee_id,
        year=request.year,
        month=request.month
    )

@router.get("/api/employees/{employee_id}/payslips", response_model=List[PayslipInfo])
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
    
@router.delete("/api/payslips/{payslip_id}", status_code=204)
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
    

    
@router.get("/api/debug-storage/{employee_id}/{year}/{month}")
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
    

