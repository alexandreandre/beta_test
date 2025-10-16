# backend_api/services/payslip_generator.py

import json
import sys
import subprocess
import traceback
from datetime import date
from pathlib import Path
from fastapi import HTTPException

from core.config import supabase, PATH_TO_PAYROLL_ENGINE
from services import payroll_analyzer
from utils.parsers import parse_if_json_string



def process_payslip_generation(employee_id: str, year: int, month: int):
    """
    Workflow de génération de paie "juste à temps", 100% basé sur la BDD,
    avec une gestion propre des fichiers temporaires.
    """
    files_to_cleanup = []
    try:
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
        saisies_res = supabase.table('monthly_inputs').select("*").match({'employee_id': employee_id, 'year': year, 'month': month}).execute()
        print(f"\nDEBUG [Generator - Étape 1]: Données de saisies brutes lues depuis Supabase -> {json.dumps(saisies_res.data)}\n")


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
            # On prépare un dictionnaire complet pour chaque prime
            prime_entry = {
                "prime_id": row['name'].replace(" ", "_"),
                "montant": row['amount'],

                # 🎯 On ajoute les clés attendues par le moteur en mappant les noms de la BDD
                "soumise_a_cotisations": row.get('is_socially_taxed', True),
                "soumise_a_impot": row.get('is_taxable', True)
            }
            saisies_data["primes"].append(prime_entry)

        print(f"\nDEBUG [Generator - Étape 2]: Contenu final du JSON de saisies préparé pour le moteur -> {json.dumps(saisies_data)}\n")

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

        print(f"DEBUG - Chemin utilisé pour CWD : {PATH_TO_PAYROLL_ENGINE}")
        # On utilise le nom du script seul, car `cwd` nous place déjà dans le bon dossier.
        script_name = "generateur_fiche_paie.py"
        command = [sys.executable, script_name, employee_folder_name, str(year), str(month)]
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
