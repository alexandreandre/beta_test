# backend_api/api/routers/monthly_inputs.py

import os
import sys 
import traceback
import json
from typing import List
from fastapi import APIRouter, HTTPException, Request

from core.config import supabase, PATH_TO_PAYROLL_ENGINE
from schemas.monthly_input import MonthlyInput, MonthlyInputCreate

print("DEBUG ⛓️ PATH_TO_PAYROLL_ENGINE =", PATH_TO_PAYROLL_ENGINE)
print("DEBUG 📁 Exists:", PATH_TO_PAYROLL_ENGINE.exists())
print("DEBUG 🧾 Listing:", os.listdir(PATH_TO_PAYROLL_ENGINE) if PATH_TO_PAYROLL_ENGINE.exists() else "not found")

router = APIRouter(
    tags=["Monthly Inputs"]
)


@router.get("/api/monthly-inputs")
def list_monthly_inputs(year: int, month: int):
    """Retourne toutes les saisies ponctuelles du mois, tous salariés confondus"""
    response = supabase.table('monthly_inputs') \
        .select("*") \
        .match({"year": year, "month": month}) \
        .order("created_at", desc=True) \
        .execute()
    return response.data

@router.post("/api/monthly-inputs", status_code=201)
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
    


@router.delete("/api/monthly-inputs/{input_id}")
def delete_monthly_input(input_id: str):
    """Supprime une saisie ponctuelle"""
    supabase.table('monthly_inputs').delete().eq("id", input_id).execute()
    return {"status": "success"}


# --- Récupération des saisies du mois d’un employé ---
@router.get("/api/employees/{employee_id}/monthly-inputs")
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
@router.post("/api/employees/{employee_id}/monthly-inputs", status_code=201)
def create_employee_monthly_inputs(employee_id: str, prime_data: MonthlyInputCreate):
    """
    Crée une saisie ponctuelle pour un employé spécifique en utilisant la validation Pydantic.
    """
    try:
        data_to_insert = prime_data.model_dump()
        data_to_insert["employee_id"] = employee_id
        
        # --- 🎯 ESPION N°1 ---
        # Affiche exactement ce qui va être envoyé à la BDD.
        print(f"\nDEBUG [API Router]: Données prêtes à être insérées dans Supabase -> {json.dumps(data_to_insert)}\n")
        # --- FIN DE L'ESPION ---

        response = supabase.table("monthly_inputs").insert(data_to_insert).execute()

        print("✅ Insertion réussie.")
        return {"status": "success", "inserted_data": response.data[0]}

    except Exception as e:
        print("❌ Erreur create_employee_monthly_inputs :", e)
        traceback.print_exc(file=sys.stderr)
        raise HTTPException(status_code=500, detail=str(e))

# --- Suppression d'une saisie d’un employé ---
@router.delete("/api/employees/{employee_id}/monthly-inputs/{input_id}")
def delete_employee_monthly_input(employee_id: str, input_id: str):
    """Supprime une saisie ponctuelle pour un employé donné"""
    try:
        supabase.table("monthly_inputs").delete().eq("id", input_id).eq("employee_id", employee_id).execute()
        return {"status": "success"}
    except Exception as e:
        print("❌ Erreur delete_employee_monthly_input :", e)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/primes-catalogue")
def get_primes_catalogue():
    """Lit et retourne le contenu du fichier primes.json."""
    import traceback
    try:
        primes_path = PATH_TO_PAYROLL_ENGINE / "data" / "primes.json"
        print(f"DEBUG lecture fichier: {primes_path} | exists={primes_path.exists()}")
        raw = primes_path.read_text(encoding="utf-8")
        print(f"DEBUG taille={len(raw)} premiers_caractères={raw[:80]!r}")
        primes_data = json.loads(raw)
        print("DEBUG JSON chargé avec succès")
        return primes_data.get("primes", [])
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {e}")
