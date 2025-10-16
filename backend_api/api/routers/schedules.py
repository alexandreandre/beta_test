# backend_api/api/routers/schedules.py

import json
import traceback
import sys
from datetime import date
from fastapi import APIRouter, HTTPException

from core.config import supabase, PATH_TO_PAYROLL_ENGINE
from schemas.schedule import (CalendarResponse, PlannedCalendarRequest, ActualHoursRequest)
from services import payroll_analyzer

router = APIRouter(
    prefix="/api/employees/{employee_id}",
    tags=["Schedules & Calendars"]
)

@router.get("/calendar-data", response_model=CalendarResponse)
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


@router.get("/planned-calendar", response_model=PlannedCalendarRequest)
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
    

@router.post("/planned-calendar", status_code=200)
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

@router.get("/actual-hours", response_model=ActualHoursRequest)
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
    
@router.post("/actual-hours", status_code=200)
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
    



@router.post("/calculate-payroll-events", status_code=200)
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
    
    