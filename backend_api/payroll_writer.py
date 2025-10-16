# backend_api/payroll_writer.py
import json
import sys
from supabase import create_client
from datetime import datetime
from payroll_analyzer import analyser_horaires_du_mois
from dotenv import load_dotenv
import os

load_dotenv()
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY"))

def generer_et_enregistrer_evenements(employee_id: str, employee_name: str, duree_hebdo: float, year: int, month: int):
    """
    Analyse les horaires et enregistre directement les événements de paie dans Supabase.
    """
    try:
        print(f"🧮 [PayrollWriter] Début génération événements {employee_name} ({month}/{year})", file=sys.stderr)
        
        # --- Récupération des horaires dans Supabase ---
        res = supabase.table("employee_schedules").select("planned_calendar, actual_hours") \
            .match({"employee_id": employee_id, "year": year, "month": month}) \
            .maybe_single().execute()

        if not res.data:
            print(f"❌ Aucun calendrier trouvé pour {employee_name} ({month}/{year})", file=sys.stderr)
            return None

        planned_calendar = res.data.get("planned_calendar") or []
        actual_hours = res.data.get("actual_hours") or []

        # --- Appel du moteur d’analyse ---
        evenements = analyser_horaires_du_mois(
            planned_calendar, actual_hours, duree_hebdo, year, month, employee_name
        )

        # --- Structure conforme au moteur de paie ---
        payload = {
            "periode": {"mois": month, "annee": year},
            "calendrier_analyse": evenements
        }

        # --- Enregistrement Supabase ---
        supabase.table("employee_schedules").update({
            "payroll_events": payload,
            "updated_at": datetime.utcnow().isoformat()
        }).match({
            "employee_id": employee_id,
            "year": year,
            "month": month
        }).execute()

        print(f"✅ [PayrollWriter] {len(evenements)} événements enregistrés pour {employee_name} ({month}/{year})", file=sys.stderr)
        return payload

    except Exception as e:
        print(f"❌ [PayrollWriter] Erreur : {e}", file=sys.stderr)
        return None
