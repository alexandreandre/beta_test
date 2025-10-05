# analyser_horaires.py
import json
import sys
import calendar
from pathlib import Path
from datetime import date
from typing import Dict, Any, List
import argparse
from collections import defaultdict
import traceback

def analyser_horaires_du_mois(chemin_employe: Path, annee: int, mois: int, duree_hebdo_contrat: float) -> List[Dict[str, Any]]:
    print(f"INFO: Analyse des horaires pour {chemin_employe.name} - {mois:02d}/{annee}...", file=sys.stderr)

    # --- NOUVEAU : charger mois précédent et suivant aussi ---
    mois_prec = mois - 1 or 12
    annee_prec = annee - 1 if mois == 1 else annee
    mois_suiv = mois + 1 if mois < 12 else 1
    annee_suiv = annee + 1 if mois == 12 else annee

    fichiers = [
        (annee_prec, mois_prec),
        (annee, mois),
        (annee_suiv, mois_suiv)
    ]

    prevu_data = []
    reel_data = []
    for a, m in fichiers:
        cp = chemin_employe / 'calendriers' / f'{m:02d}.json' 
        cr = chemin_employe / 'horaires' / f'{m:02d}.json'
        if cp.exists():
            for j in json.loads(cp.read_text(encoding='utf-8')).get('calendrier_prevu', []):
                j['annee'] = a
                j['mois'] = m
                prevu_data.append(j)
        if cr.exists():
            for j in json.loads(cr.read_text(encoding='utf-8')).get('calendrier_reel', []):
                j['annee'] = a
                j['mois'] = m
                reel_data.append(j)

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
        print(f"\n=== DEBUG: Semaine {cle_semaine} ===", file=sys.stderr)
        print(f"DEBUG: prevu={[(j['jour'], j.get('heures_prevues')) for j in data['prevu']]}", file=sys.stderr)
        print(f"DEBUG: reel={[(j['jour'], j.get('heures_faites')) for j in data['reel']]}", file=sys.stderr)

        # On ajoute les jours non-travaillés sans heures réelles
        for jour_prevu in data["jours_non_travailles"]:
            heures_reelles_ce_jour = any(
                j['jour'] == jour_prevu['jour'] and 
                j['mois'] == jour_prevu['mois'] and 
                j.get('heures_faites', 0) > 0 
                for j in data['reel']
            )

            if not heures_reelles_ce_jour:
                evenements_finaux.append(jour_prevu)

        # Heures assimilées
        heures_assimilees = 0.0
        for jour_non_travaille in data['jours_non_travailles']:
            # On prend en compte les heures des congés et jours fériés
            if jour_non_travaille.get('type') in ['conges_payes', 'ferie']:
                heures_assimilees += jour_non_travaille.get('heures_prevues', 0.0)

        compteur_heures_semaine_centiemes = int(heures_assimilees * 100)
        print(f"DEBUG: heures_assimilees={heures_assimilees}, compteur_init={compteur_heures_semaine_centiemes}", file=sys.stderr)
        print(f"DEBUG: heures_assimilees={heures_assimilees}, compteur_init={compteur_heures_semaine_centiemes}", file=sys.stderr)

        # Qualification des heures travaillées
        for jour_reel in sorted(data['reel'], key=lambda x: (x['mois'], x['jour'])):
            heures_jour_centiemes = int(jour_reel.get('heures_faites', 0.0) * 100)
            if heures_jour_centiemes <= 0: 
                continue

            debut_compteur = compteur_heures_semaine_centiemes
            fin_compteur = compteur_heures_semaine_centiemes + heures_jour_centiemes

            print(f"DEBUG: jour={jour_reel['jour']}/{jour_reel['mois']} heures={heures_jour_centiemes} -> compteur {debut_compteur}->{fin_compteur}", file=sys.stderr)

            seuil_base_legal = 3500
            seuil_hs25_legal = 4300
            duree_contrat_centiemes = int(duree_hebdo_contrat * 100)

            h_hs25 = max(0, min(fin_compteur, seuil_hs25_legal) - max(debut_compteur, duree_contrat_centiemes, seuil_base_legal))
            h_hs50 = max(0, fin_compteur - max(debut_compteur, seuil_hs25_legal))

            print(f"DEBUG: h_hs25={h_hs25}, h_hs50={h_hs50}", file=sys.stderr)

            if h_hs25 > 0:
                evenements_finaux.append({"jour": jour_reel['jour'], "mois": jour_reel['mois'], "type": "travail_hs25", "heures": h_hs25 / 100.0})
            if h_hs50 > 0:
                evenements_finaux.append({"jour": jour_reel['jour'], "mois": jour_reel['mois'], "type": "travail_hs50", "heures": h_hs50 / 100.0})

            compteur_heures_semaine_centiemes = fin_compteur

        # Qualification des absences injustifiées
        compteur_heures_faites_semaine_centiemes = 0
        duree_contrat_centiemes_abs = int(duree_hebdo_contrat * 100)

        for jour_prevu in sorted(data['prevu'], key=lambda x: (x['mois'], x['jour'])):
            heures_prevues_jour_centiemes = int(jour_prevu.get('heures_prevues', 0.0) * 100)
            jour_reel = next((j for j in data['reel'] if j['jour'] == jour_prevu['jour'] and j['mois'] == jour_prevu['mois']), None)
            heures_faites_jour_centiemes = int(jour_reel.get('heures_faites', 0.0) * 100) if jour_reel else 0

            print(f"DEBUG: Absence? jour={jour_prevu['jour']}/{jour_prevu['mois']} prevu={heures_prevues_jour_centiemes} fait={heures_faites_jour_centiemes}", file=sys.stderr)

            if heures_faites_jour_centiemes < heures_prevues_jour_centiemes:
                manque_centiemes = heures_prevues_jour_centiemes - heures_faites_jour_centiemes
                curseur_centiemes = compteur_heures_faites_semaine_centiemes + heures_faites_jour_centiemes

                print(f"DEBUG: -> manque={manque_centiemes}, curseur_init={curseur_centiemes}", file=sys.stderr)

                while manque_centiemes > 0:
                    if curseur_centiemes >= duree_contrat_centiemes_abs:
                        print("DEBUG: stop absence (au-delà contrat)", file=sys.stderr)
                        break

                    tranche = min(1, manque_centiemes, duree_contrat_centiemes_abs - curseur_centiemes)
                    position_apres = curseur_centiemes + tranche

                    if position_apres <= 3500:
                        type_abs = "absence_injustifiee_base"
                    else:
                        type_abs = "absence_injustifiee_hs25"

                    print(f"DEBUG: imput {tranche} -> {type_abs} (pos={position_apres})", file=sys.stderr)

                    evenements_finaux.append({
                        "jour": jour_prevu['jour'],
                        "mois": jour_prevu['mois'],
                        "type": type_abs,
                        "heures": tranche / 100.0
                    })

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

    print(f"DEBUG: evenements_agreges={evenements_agreges}", file=sys.stderr)
    return sorted(evenements_agreges, key=lambda x: x['jour'])


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Analyse les horaires prévus et réels pour générer un fichier d'événements de paie.")
    parser.add_argument("nom_employe", type=str, help="Le nom du dossier de l'employé.")
    parser.add_argument("--annee", type=int, default=date.today().year)
    parser.add_argument("--mois", type=int, default=date.today().month)
    args = parser.parse_args()

    try:
        chemin_employe = Path('data/employes') / args.nom_employe

        chemin_contrat = chemin_employe / 'contrat.json'
        if not chemin_contrat.exists():
            raise FileNotFoundError(f"Le fichier contrat.json est introuvable pour {args.nom_employe}")

        contrat_data = json.loads(chemin_contrat.read_text(encoding='utf-8'))
        duree_hebdo = contrat_data.get('contrat', {}).get('temps_travail', {}).get('duree_hebdomadaire')
        if not duree_hebdo:
            raise ValueError(f"La 'duree_hebdomadaire' n'est pas définie dans le contrat.json de {args.nom_employe}")

        evenements = analyser_horaires_du_mois(chemin_employe, args.annee, args.mois, duree_hebdo)

        output_path = chemin_employe / 'evenements_paie' / f'{args.mois:02d}.json'
        output_data = {
            "periode": {"annee": args.annee, "mois": args.mois},
            "calendrier_analyse": evenements
        }

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, indent=2, ensure_ascii=False)

        print(f"✅ Fichier d'événements généré avec succès : {output_path}", file=sys.stderr)

    except Exception as e:
        print(f"\nERREUR : {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)
