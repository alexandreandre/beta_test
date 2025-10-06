# saas-rh-backend/payroll_analyzer.py

import sys
from datetime import date
from typing import Dict, Any, List
from collections import defaultdict

def analyser_horaires_du_mois(
    # Les données sont maintenant fournies directement en entrée
    planned_data_all_months: List[Dict[str, Any]], 
    actual_data_all_months: List[Dict[str, Any]], 
    duree_hebdo_contrat: float, 
    annee: int, 
    mois: int,
    # On ajoute le nom de l'employé pour des logs plus clairs
    employee_name: str 
) -> List[Dict[str, Any]]:
    
    # Le log n'utilise plus `chemin_employe`
    print(f"INFO (analyzer): Analyse des horaires pour {employee_name} - {mois:02d}/{annee}...", file=sys.stderr)

    # La lecture des fichiers a été supprimée, on utilise directement les données passées en paramètres.
    prevu_data = planned_data_all_months
    reel_data = actual_data_all_months

    print(f"DEBUG: nb_jours_prevus={len(prevu_data)}, nb_jours_reels={len(reel_data)}", file=sys.stderr)
    
    # ==============================================================================
    # DÉBUT DE VOTRE LOGIQUE DE CALCUL (INCHANGÉE)
    # ==============================================================================

    # Étape 1 : Regrouper les données par semaine ISO
    semaines = defaultdict(lambda: {"prevu": [], "reel": [], "jours_non_travailles": []})
    for j in prevu_data:
        if 'annee' not in j or 'mois' not in j or 'jour' not in j: continue
        jour_date = date(j['annee'], j['mois'], j['jour'])
        cle_semaine = jour_date.isocalendar()[:2]
        if j.get('type') == 'travail':
            semaines[cle_semaine]["prevu"].append(j)
        else:
            semaines[cle_semaine]["jours_non_travailles"].append(j)

    for j in reel_data:
        if 'annee' not in j or 'mois' not in j or 'jour' not in j: continue
        jour_date = date(j['annee'], j['mois'], j['jour'])
        cle_semaine = jour_date.isocalendar()[:2]
        semaines[cle_semaine]["reel"].append(j)

    # Étape 2 : Analyser chaque semaine
    evenements_finaux = []
    for cle_semaine, data in semaines.items():
        print(f"\n=== DEBUG: Semaine {cle_semaine} ===", file=sys.stderr)
        print(f"DEBUG: prevu={[(j['jour'], j.get('heures_prevues')) for j in data['prevu']]}", file=sys.stderr)
        print(f"DEBUG: reel={[(j['jour'], j.get('heures_faites')) for j in data['reel']]}", file=sys.stderr)

        for jour_prevu in data["jours_non_travailles"]:
            heures_reelles_ce_jour = any(
                j['jour'] == jour_prevu['jour'] and 
                j['mois'] == jour_prevu['mois'] and 
                j.get('heures_faites', 0) > 0 
                for j in data['reel']
            )
            if not heures_reelles_ce_jour:
                evenements_finaux.append(jour_prevu)

        heures_assimilees = 0.0
        for jour_non_travaille in data['jours_non_travailles']:
            if jour_non_travaille.get('type') in ['conges_payes', 'ferie']:
                heures_assimilees += jour_non_travaille.get('heures_prevues', 0.0)

        compteur_heures_semaine_centiemes = int(heures_assimilees * 100)
        print(f"DEBUG: heures_assimilees={heures_assimilees}, compteur_init={compteur_heures_semaine_centiemes}", file=sys.stderr)

        for jour_reel in sorted(data['reel'], key=lambda x: (x['mois'], x['jour'])):
            heures_jour_centiemes = int(jour_reel.get('heures_faites', 0.0) * 100)
            if heures_jour_centiemes <= 0: continue

            debut_compteur = compteur_heures_semaine_centiemes
            fin_compteur = compteur_heures_semaine_centiemes + heures_jour_centiemes
            print(f"DEBUG: jour={jour_reel['jour']}/{jour_reel['mois']} heures={heures_jour_centiemes} -> compteur {debut_compteur}->{fin_compteur}", file=sys.stderr)

            seuil_base_legal = 3500
            seuil_hs25_legal = 4300
            duree_contrat_centiemes = int(duree_hebdo_contrat * 100)
            h_hs25 = max(0, min(fin_compteur, seuil_hs25_legal) - max(debut_compteur, duree_contrat_centiemes, seuil_base_legal))
            h_hs50 = max(0, fin_compteur - max(debut_compteur, seuil_hs25_legal))

            if h_hs25 > 0:
                evenements_finaux.append({"jour": jour_reel['jour'], "mois": jour_reel['mois'], "type": "travail_hs25", "heures": h_hs25 / 100.0})
            if h_hs50 > 0:
                evenements_finaux.append({"jour": jour_reel['jour'], "mois": jour_reel['mois'], "type": "travail_hs50", "heures": h_hs50 / 100.0})
            compteur_heures_semaine_centiemes = fin_compteur

        compteur_heures_faites_semaine_centiemes = 0
        duree_contrat_centiemes_abs = int(duree_hebdo_contrat * 100)
        for jour_prevu in sorted(data['prevu'], key=lambda x: (x['mois'], x['jour'])):
            heures_prevues_jour_centiemes = int(jour_prevu.get('heures_prevues', 0.0) * 100)
            jour_reel = next((j for j in data['reel'] if j['jour'] == jour_prevu['jour'] and j['mois'] == jour_prevu['mois']), None)
            heures_faites_jour_centiemes = int(jour_reel.get('heures_faites', 0.0) * 100) if jour_reel else 0

            if heures_faites_jour_centiemes < heures_prevues_jour_centiemes:
                manque_centiemes = heures_prevues_jour_centiemes - heures_faites_jour_centiemes
                curseur_centiemes = compteur_heures_faites_semaine_centiemes + heures_faites_jour_centiemes
                while manque_centiemes > 0:
                    if curseur_centiemes >= duree_contrat_centiemes_abs: break
                    tranche = min(1, manque_centiemes, duree_contrat_centiemes_abs - curseur_centiemes)
                    position_apres = curseur_centiemes + tranche
                    type_abs = "absence_injustifiee_base" if position_apres <= 3500 else "absence_injustifiee_hs25"
                    evenements_finaux.append({"jour": jour_prevu['jour'], "mois": jour_prevu['mois'], "type": type_abs, "heures": tranche / 100.0})
                    curseur_centiemes += tranche
                    manque_centiemes -= tranche
            compteur_heures_faites_semaine_centiemes += heures_faites_jour_centiemes

    # Étape 3 : Agréger et filtrer uniquement le mois demandé
    agregats = defaultdict(float)
    jours_sans_heures = {}
    for ev in evenements_finaux:
        if ev.get("mois", mois) != mois:
            continue
        key = (ev['jour'], ev['type'])
        if 'heures_prevues' in ev and 'heures' not in ev:
            ev['heures'] = ev['heures_prevues']
        if 'heures' in ev:
            agregats[key] += ev.get('heures', 0.0)
        else:
            jours_sans_heures[key] = ev

    evenements_agreges = [{"jour": k[0], "type": k[1], "heures": round(v, 2)} for k, v in agregats.items() if v > 0]
    evenements_agreges.extend(jours_sans_heures.values())

    # ==============================================================================
    # FIN DE VOTRE LOGIQUE DE CALCUL
    # ==============================================================================

    print(f"DEBUG (analyzer): Événements agrégés trouvés: {len(evenements_agreges)}", file=sys.stderr)
    return sorted(evenements_agreges, key=lambda x: x['jour'])

# NOTE: Le bloc if __name__ == "__main__": a été supprimé car ce fichier est maintenant un module importable,
# et non plus un script à exécuter directement.