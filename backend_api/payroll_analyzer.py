import sys
from datetime import date
from typing import Dict, Any, List
from collections import defaultdict
import json

def analyser_horaires_du_mois(
    planned_data_all_months: List[Dict[str, Any]],
    actual_data_all_months: List[Dict[str, Any]],
    duree_hebdo_contrat: float,
    annee: int,
    mois: int,
    employee_name: str
) -> List[Dict[str, Any]]:
    """
    Analyse les horaires et produit les événements de paie.
    La logique de cette fonction est une copie conforme de celle du script
    'analyser_horaires.py', tout en étant robuste aux valeurs 'None' venant de la BDD.
    """
    print(f"INFO: Analyse des horaires pour {employee_name} - {mois:02d}/{annee}...", file=sys.stderr)

    prevu_data = planned_data_all_months
    reel_data = actual_data_all_months
    print(f"DEBUG: nb_jours_prevus={len(prevu_data)}, nb_jours_reels={len(reel_data)}", file=sys.stderr)

    # Étape 1 : Regrouper les données par semaine ISO
    semaines = defaultdict(lambda: {"prevu": [], "reel": [], "jours_non_travailles": []})
    for j in prevu_data:
        jour_date = date(j['annee'], j['mois'], j['jour'])
        cle_semaine = jour_date.isocalendar()[:2]
        if j.get('type') == 'travail':
            semaines[cle_semaine]["prevu"].append(j)
        else:
            semaines[cle_semaine]["jours_non_travailles"].append(j)
    for j in reel_data:
        jour_date = date(j['annee'], j['mois'], j['jour'])
        cle_semaine = jour_date.isocalendar()[:2]
        semaines[cle_semaine]["reel"].append(j)

    # Étape 2 : Analyser chaque semaine
    evenements_finaux = []
    for cle_semaine, data in semaines.items():
        # --- Logique Copiée de analyser_horaires.py ---
        ### ESPION 3 : VÉRIFIE COMMENT LES JOURS SONT CATÉGORISÉS DANS LA SEMAINE ###
        print("\n" + "="*20 + f" ESPION 3 : SEMAINE {cle_semaine} " + "="*20)
        print("Jours de travail prévus:", data.get("prevu"))
        print("Jours non-travaillés prévus:", data.get("jours_non_travailles"))
        print("="* (43 + len(str(cle_semaine))) + "\n")


        # On ajoute les jours non-travaillés sans heures réelles
        for jour_prevu in data["jours_non_travailles"]:
            heures_reelles_ce_jour = any(
                j['jour'] == jour_prevu['jour'] and
                j['mois'] == jour_prevu['mois'] and
                (j.get('heures_faites') or 0) > 0  # Robuste à None
                for j in data['reel']
            )
            if not heures_reelles_ce_jour:
                evenements_finaux.append(jour_prevu)

        # Heures assimilées
        heures_assimilees = 0.0
        for jour_non_travaille in data['jours_non_travailles']:
            if jour_non_travaille.get('type') in ['conges_payes', 'ferie']:
                heures_assimilees += (jour_non_travaille.get('heures_prevues') or 0.0) # Robuste à None

        compteur_heures_semaine_centiemes = int(heures_assimilees * 100)

        # Qualification des heures travaillées
        for jour_reel in sorted(data['reel'], key=lambda x: (x['mois'], x['jour'])):
            heures_jour_centiemes = int((jour_reel.get('heures_faites') or 0.0) * 100) # Robuste à None
            if heures_jour_centiemes <= 0:
                continue

            debut_compteur = compteur_heures_semaine_centiemes
            fin_compteur = compteur_heures_semaine_centiemes + heures_jour_centiemes
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

        # Qualification des absences injustifiées
        compteur_heures_faites_semaine_centiemes = 0
        duree_contrat_centiemes_abs = int(duree_hebdo_contrat * 100)

        for jour_prevu in sorted(data['prevu'], key=lambda x: (x['mois'], x['jour'])):
            heures_prevues_jour_centiemes = int((jour_prevu.get('heures_prevues') or 0.0) * 100) # Robuste à None
            jour_reel = next((j for j in data['reel'] if j['jour'] == jour_prevu['jour'] and j['mois'] == jour_prevu['mois']), None)
            heures_faites_jour_centiemes = int((jour_reel.get('heures_faites') or 0.0) * 100) if jour_reel else 0 # Robuste à None

            if heures_faites_jour_centiemes < heures_prevues_jour_centiemes:
                manque_centiemes = heures_prevues_jour_centiemes - heures_faites_jour_centiemes
                curseur_centiemes = compteur_heures_faites_semaine_centiemes + heures_faites_jour_centiemes
                while manque_centiemes > 0:
                    if curseur_centiemes >= duree_contrat_centiemes_abs:
                        break
                    tranche = min(1, manque_centiemes, duree_contrat_centiemes_abs - curseur_centiemes)
                    position_apres = curseur_centiemes + tranche
                    type_abs = "absence_injustifiee_base" if position_apres <= 3500 else "absence_injustifiee_hs25"
                    evenements_finaux.append({
                        "jour": jour_prevu['jour'],
                        "mois": jour_prevu['mois'],
                        "type": type_abs,
                        "heures": tranche / 100.0
                    })
                    curseur_centiemes += tranche
                    manque_centiemes -= tranche
            compteur_heures_faites_semaine_centiemes += heures_faites_jour_centiemes
    
    ### ESPION 4 : VÉRIFIE LA LISTE COMPLÈTE DES ÉVÉNEMENTS AVANT FILTRAGE FINAL ###
    print("\n" + "="*20 + " ESPION 4 : ÉVÉNEMENTS BRUTS GÉNÉRÉS " + "="*20)
    print("Contenu de 'evenements_finaux' (avant filtrage par mois et agrégation) :")
    try:
        print(json.dumps(evenements_finaux, indent=2))
    except TypeError:
        print(evenements_finaux)
    print("="*65 + "\n")

    # Étape 3 : Agréger et filtrer uniquement le mois demandé
    agregats = defaultdict(float)
    jours_sans_heures = {}
    for ev in evenements_finaux:
        if ev.get("mois", mois) != mois:
            continue
        key = (ev['jour'], ev['type'])

        # CORRECTION : On vérifie si 'heures_prevues' existe ET n'est pas None
        # avant de le copier dans 'heures'. Un weekend avec "heures_prevues": null
        # ne rentrera plus dans cette condition.
        if ev.get('heures_prevues') is not None and 'heures' not in ev:
            ev['heures'] = ev['heures_prevues']

        if 'heures' in ev:
            agregats[key] += (ev.get('heures') or 0.0)
        else:
            # Un weekend sans 'heures' sera maintenant correctement capturé ici.
            jours_sans_heures[key] = ev

    # Cette logique est maintenant correcte car 'jours_sans_heures' contient les weekends
    evenements_agreges = [{"jour": k[0], "type": k[1], "heures": round(v, 2)} for k, v in agregats.items() if v > 0]
    evenements_agreges.extend(jours_sans_heures.values())

    return sorted(evenements_agreges, key=lambda x: x['jour'])
