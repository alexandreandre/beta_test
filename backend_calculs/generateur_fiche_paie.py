# generateur_fiche_paie.py

import json
import sys
import traceback
from pathlib import Path
from datetime import date, timedelta  
import calendar
from typing import Dict, Any, List

# Imports pour la génération PDF
from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML

# Imports pour le moteur de calcul
from moteur_paie.contexte import ContextePaie
from moteur_paie.calcul_brut import calculer_salaire_brut
from moteur_paie.calcul_cotisations import calculer_cotisations
from moteur_paie.calcul_reduction_generale import calculer_reduction_generale
from moteur_paie.calcul_net import calculer_net_et_impot
from moteur_paie.bulletin import creer_bulletin_final




def _get_end_date_for_month(target_annee: int, target_mois: int, jour_cible: int, occurrence_cible: int) -> date:
    """
    Trouve une date en se basant sur un jour de la semaine et son occurrence dans le mois.
    jour_cible: 0 pour Lundi, ..., 6 pour Dimanche.
    occurrence_cible: 1 pour le premier, -1 pour le dernier.
    """
    _, num_days = calendar.monthrange(target_annee, target_mois)
    
    jours_trouves = [
        date(target_annee, target_mois, day)
        for day in range(1, num_days + 1)
        if date(target_annee, target_mois, day).weekday() == jour_cible
    ]
    
    if not jours_trouves:
        raise ValueError(f"Aucun jour correspondant au jour {jour_cible} trouvé pour {target_mois}/{target_annee}.")

    try:
        if occurrence_cible > 0:
            return jours_trouves[occurrence_cible - 1]
        else:
            return jours_trouves[occurrence_cible]
    except IndexError:
        raise ValueError(f"L'occurrence {occurrence_cible} est invalide pour le mois de {target_mois}/{target_annee}.")

# Fichier : generateur_fiche_paie.py

# Fichier : generateur_fiche_paie.py

def definir_periode_de_paie(contexte: ContextePaie, annee: int, mois: int) -> tuple[date, date]:
    """
    Détermine la période de paie en lisant les règles depuis la configuration de l'entreprise.
    La période de travail s'arrête le dimanche de la semaine du jour de référence.
    """
    regles_paie = contexte.entreprise.get('parametres_paie', {}).get('periode_de_paie', {})
    jour_reference = regles_paie.get('jour_de_fin', 4)  # Vendredi par défaut
    occurrence_reference = regles_paie.get('occurrence', -2) # Avant-dernier par défaut

    # On trouve le jour de référence (ex: l'avant-dernier vendredi)
    date_de_reference = _get_end_date_for_month(annee, mois, jour_reference, occurrence_reference)
    
    # --- CORRECTION APPLIQUÉE ICI ---
    # La date de fin de la période est le dimanche de la semaine de référence.
    # On calcule le décalage pour aller de notre jour de référence (ex: vendredi=4) au dimanche (jour=6).
    decalage_vers_dimanche = 6 - date_de_reference.weekday()
    date_fin_periode = date_de_reference + timedelta(days=decalage_vers_dimanche)
    # --- FIN DE LA CORRECTION ---
    
    # On fait de même pour le mois précédent afin de trouver notre date de début
    mois_precedent = mois - 1
    annee_precedente = annee
    if mois_precedent == 0:
        mois_precedent = 12
        annee_precedente -= 1
        
    date_de_reference_precedente = _get_end_date_for_month(annee_precedente, mois_precedent, jour_reference, occurrence_reference)
    
    # On applique la même correction pour la période précédente
    decalage_vers_dimanche_precedent = 6 - date_de_reference_precedente.weekday()
    date_fin_periode_precedente = date_de_reference_precedente + timedelta(days=decalage_vers_dimanche_precedent)

    date_debut_periode = date_fin_periode_precedente + timedelta(days=1)
    
    return date_debut_periode, date_fin_periode


# Dans generateur_fiche_paie.py

def mettre_a_jour_cumuls(
    contexte: ContextePaie,
    salaire_brut_mois: float,
    remuneration_hs_mois: float,
    resultats_nets_mois: dict,
    reduction_generale_mois: dict,
    mois: int,
    smic_mois: float,
    pss_mois: float,
    chemin_employe: Path 
):
    """
    Lit le fichier cumuls.json du mois précédent, y ajoute les valeurs du mois,
    et écrit un nouveau fichier cumuls_[mois].json.
    """
    print("INFO: Création du nouveau fichier de cumuls annuels...", file=sys.stderr)
    
    cumuls_data = contexte.cumuls
    # Création d'une copie profonde pour éviter de modifier l'objet original
    nouveaux_cumuls_data = json.loads(json.dumps(cumuls_data))
    
    mois_actuel = mois
    nouveau_fichier_path = chemin_employe / 'cumuls' / f'{mois_actuel:02d}.json'

    nouveaux_cumuls_data['periode']['dernier_mois_calcule'] = mois_actuel
    
    cumuls = nouveaux_cumuls_data.setdefault('cumuls', {}) # Garantit que la clé 'cumuls' existe
    
    cumuls['brut_total'] = cumuls.get('brut_total', 0.0) + round(salaire_brut_mois, 2)
    cumuls['net_imposable'] = cumuls.get('net_imposable', 0.0) + round(resultats_nets_mois.get('net_imposable', 0.0), 2)
    cumuls['impot_preleve_a_la_source'] = cumuls.get('impot_preleve_a_la_source', 0.0) + round(resultats_nets_mois.get('montant_impot_pas', 0.0), 2)
    
    # --- LIGNE CORRIGÉE ---
    # On utilise .get() pour démarrer à 0 si la clé n'existe pas, au lieu de planter.
    cumuls['heures_supplementaires_remunerees'] = cumuls.get('heures_supplementaires_remunerees', 0.0) + round(remuneration_hs_mois, 2)
    
    # (Optionnel) Ajout de la robustesse aux autres clés pour le futur
    cumuls.setdefault('heures_remunerees', 0.0)
    
    if reduction_generale_mois:
        nouveau_total_annuel_reduction = reduction_generale_mois.get('valeur_cumulative_a_enregistrer', 0.0)
        cumuls['reduction_generale_patronale'] = -nouveau_total_annuel_reduction

    with open(nouveau_fichier_path, 'w', encoding='utf-8') as f:
        json.dump(nouveaux_cumuls_data, f, indent=2, ensure_ascii=False)
        
    print(f"✅ Fichier {nouveau_fichier_path} créé avec les cumuls à jour.", file=sys.stderr)

def creer_calendrier_etendu(chemin_employe: Path, date_debut_periode: date, date_fin_periode: date) -> list:
    """
    Charge les fichiers d'événements de paie nécessaires pour couvrir la période.
    """
    calendrier_final = []
    
    # On identifie les mois concernés par la période de paie (ex: Juin et Juillet)
    mois_a_charger = set()
    current_date = date_debut_periode
    while current_date <= date_fin_periode:
        mois_a_charger.add((current_date.year, current_date.month))
        # Avance au mois suivant
        current_date = (current_date.replace(day=28) + timedelta(days=4)).replace(day=1)

    for annee, mois in mois_a_charger:
        # On lit le fichier d'événements généré par l'analyseur
        nom_fichier = f"{mois:02d}.json"
        chemin_fichier = chemin_employe / 'evenements_paie' / nom_fichier
        
        if chemin_fichier.exists():
            data = json.loads(chemin_fichier.read_text(encoding='utf-8'))
            for jour_data in data.get('calendrier_analyse', []):
                jour_data['date_complete'] = date(annee, mois, jour_data['jour']).isoformat()
                calendrier_final.append(jour_data)
        else:
            print(f"AVERTISSEMENT: Le fichier d'événements {nom_fichier} n'a pas été trouvé. Il faut d'abord lancer analyser_horaires.py", file=sys.stderr)

    return sorted(calendrier_final, key=lambda j: j['date_complete'])

def preparer_calendrier_enrichi(chemin_employe: Path, annee: int, mois: int) -> List[Dict[str, Any]]:
    """
    Compare les heures réelles (horaires_MM.json) avec le calendrier théorique (calendrier_MM.json)
    pour générer automatiquement les absences injustifiées.
    Retourne un calendrier mensuel complet prêt pour le calcul.
    """
    print("INFO: Préparation et comparaison des horaires du mois...", file=sys.stderr)
    
    # Charger le prévisionnel et le réel
    chemin_calendrier_prevu = chemin_employe / 'calendriers' / f'{mois:02d}.json'
    chemin_horaires_reels = chemin_employe / 'horaires' / f'{mois:02d}.json'
    
    if not chemin_calendrier_prevu.exists():
        raise FileNotFoundError(f"Le fichier de calendrier prévisionnel est introuvable : {chemin_calendrier_prevu}")
    
    calendrier_prevu_data = json.loads(chemin_calendrier_prevu.read_text(encoding='utf-8')).get('calendrier_prevu', [])
    horaires_reels_data = json.loads(chemin_horaires_reels.read_text(encoding='utf-8')) if chemin_horaires_reels.exists() else {}
    
    # Convertir les données en dictionnaires pour un accès rapide par jour
    prevu_par_jour = {j['jour']: j for j in calendrier_prevu_data}
    reels_par_jour = {j['jour']: j for j in horaires_reels_data.get('calendrier', [])}
    
    calendrier_final_mois = []
    _, num_days = calendar.monthrange(annee, mois)

    for day_num in range(1, num_days + 1):
        jour_prevu = prevu_par_jour.get(day_num, {})
        jour_reel = reels_par_jour.get(day_num)

        # Si une entrée manuelle existe dans horaires_MM.json, elle est prioritaire
        if jour_reel:
            jour_final = jour_reel.copy()
        # Sinon, on se base sur le prévisionnel
        else:
            heures_prevues = jour_prevu.get('heures_prevues', 0.0)
            # Si le salarié était censé travailler mais qu'aucune heure n'est pointée
            if jour_prevu.get('type') == 'travail' and heures_prevues > 0:
                jour_final = {
                    "jour": day_num,
                    "type": "absence_injustifiee",
                    "heures": heures_prevues
                }
            else:
                # C'est un weekend, un jour férié, etc.
                jour_final = jour_prevu.copy()
        
        jour_final['jour'] = day_num
        calendrier_final_mois.append(jour_final)
            
    return calendrier_final_mois


def generer_une_fiche_de_paie():
    """
    Fonction principale qui orchestre la génération complète d'une fiche de paie.
    """
    try:
        # --- BLOC DE CONFIGURATION ET CHARGEMENT INITIAL ---
        if len(sys.argv) != 4:
            print("Erreur: Usage: python generateur_fiche_paie.py <nom_dossier_employe> <annee> <mois>", file=sys.stderr)
            sys.exit(1)

        nom_dossier_employe = sys.argv[1]
        annee = int(sys.argv[2])
        mois = int(sys.argv[3])

        chemin_employe = Path('data/employes') / nom_dossier_employe
        print(f"\n--- Calcul du bulletin pour {nom_dossier_employe} - Période: {mois:02d}/{annee} ---", file=sys.stderr)

        # On charge le fichier de saisie correspondant au mois demandé
        chemin_saisie = chemin_employe / 'saisies' / f'{mois:02d}.json'
        if not chemin_saisie.exists():
            raise FileNotFoundError(f"Le fichier de saisie {chemin_saisie} est introuvable.")

        saisie_du_mois = json.loads(chemin_saisie.read_text(encoding='utf-8'))
        montant_acompte = saisie_du_mois.get('acompte', 0.0)

        # --- NOUVELLE LOGIQUE DE PRÉPARATION ---
        # 1. On prépare le calendrier du mois en comparant prévisionnel et réel
        calendrier_du_mois_enrichi = preparer_calendrier_enrichi(chemin_employe, annee, mois)
        mois_precedent = mois - 1 if mois > 1 else 12
        chemin_fichier_cumuls = chemin_employe / 'cumuls' / f'{mois_precedent:02d}.json'
        
        # 2. On charge le contexte (nécessaire pour définir la période de paie)
        contexte = ContextePaie(
            chemin_contrat=chemin_employe / 'contrat.json',
            chemin_entreprise='data/entreprise.json',
            chemin_cumuls=chemin_fichier_cumuls
        )

        # 3. On définit la période de paie
        date_debut_periode, date_fin_periode = definir_periode_de_paie(contexte, annee, mois)
        print(f"INFO: Période de paie calculée : du {date_debut_periode.strftime('%d/%m/%Y')} au {date_fin_periode.strftime('%d/%m/%Y')}", file=sys.stderr)

        # 4. On crée le calendrier étendu (pour les semaines à cheval)
        # Note : creer_calendrier_etendu doit être adapté pour utiliser le calendrier déjà préparé
        calendrier_etendu = creer_calendrier_etendu(chemin_employe, date_debut_periode, date_fin_periode)
        
        # On lit le fichier d'horaires dans le nouveau sous-dossier "horaires"
        chemin_fichier_horaires = chemin_employe / 'horaires' / f'{mois:02d}.json'
        saisie_horaires_mois_courant = json.loads(chemin_fichier_horaires.read_text(encoding='utf-8'))
        calendrier_du_mois = saisie_horaires_mois_courant.get('calendrier', [])

        primes_soumises = []
        primes_non_soumises = []
        catalogue_primes = {p['id']: p for p in contexte.baremes['primes']}

        for prime_saisie in saisie_du_mois.get('primes', []):
            prime_id = prime_saisie.get('prime_id')
            regles = catalogue_primes.get(prime_id)
            if regles:
                prime_calculee = {"libelle": regles.get('libelle'), "montant": prime_saisie.get('montant')}
                if regles.get('soumise_a_cotisations'):
                    primes_soumises.append(prime_calculee)
                else:
                    primes_non_soumises.append(prime_calculee)
        
        # --- ÉTAPE 2 : CALCULER LE SALAIRE BRUT ---
        resultat_brut = calculer_salaire_brut(
            contexte,
            calendrier_saisie=calendrier_etendu,
            date_debut_periode=date_debut_periode,
            date_fin_periode=date_fin_periode,
            primes_saisies=primes_soumises
        )
        
        salaire_brut_calcule = resultat_brut['salaire_brut_total']
        details_brut = resultat_brut['lignes_composants_brut']
        remuneration_hs = resultat_brut['remuneration_brute_heures_supp']
        total_heures_supp = resultat_brut['total_heures_supp']
        print(f"INFO [generateur]: Salaire brut calculé = {salaire_brut_calcule} €", file=sys.stderr)

        # --- ÉTAPE 3 : CALCULER LES COTISATIONS ---
        lignes_cotisations, total_salarial = calculer_cotisations(contexte, salaire_brut_calcule, remuneration_hs, total_heures_supp)
        print(f"INFO [generateur]: Total cotisations salariales (avant réductions) = {total_salarial} €", file=sys.stderr)

        # --- ÉTAPE 3.5 : CALCULER LA RÉDUCTION GÉNÉRALE ---

        duree_contrat_hebdo = contexte.duree_hebdo_contrat
        jours_ouvrables_du_mois = sum(1 for jour in calendrier_du_mois if jour.get('type') not in ['weekend'])
        heures_theoriques_du_mois = jours_ouvrables_du_mois * (duree_contrat_hebdo / 5)
        jours_de_conges = sum(1 for jour in calendrier_du_mois if jour.get('type') == 'conges_payes')
        heures_dues_hors_conges = heures_theoriques_du_mois - (jours_de_conges * (duree_contrat_hebdo / 5))
        heures_travaillees_reelles = sum(j.get('heures', 0) for j in calendrier_du_mois if j.get('type') == 'travail')
        heures_sup_conjoncturelles_mois = max(0, heures_travaillees_reelles - heures_dues_hors_conges)
        heures_contractuelles_mois = round((duree_contrat_hebdo * 52) / 12, 2)
        total_heures_mois = heures_contractuelles_mois + heures_sup_conjoncturelles_mois

        ligne_reduction_generale = calculer_reduction_generale(
            contexte, 
            salaire_brut_calcule,
            total_heures_mois # Utilisation de la variable déjà calculée
        )
        if ligne_reduction_generale:
            lignes_cotisations.append(ligne_reduction_generale)
        # --- ÉTAPE 4 : CALCULER LES VALEURS NETTES ET L'IMPÔT ---
        resultats_nets = calculer_net_et_impot(
            contexte, 
            salaire_brut_calcule, 
            lignes_cotisations, 
            total_salarial, 
            primes_non_soumises, 
            remuneration_hs,
            montant_acompte 
        )
        print(f"INFO [generateur]: Net à payer calculé = {resultats_nets['net_a_payer']} €", file=sys.stderr)

        # --- ÉTAPE 5 : ASSEMBLER LE BULLETIN ---
        bulletin_final = creer_bulletin_final(contexte, salaire_brut_calcule, details_brut, lignes_cotisations, resultats_nets, primes_non_soumises)
        
        # print("\n--- DÉBOGAGE : Données finales envoyées au template ---", file=sys.stderr)
        # print(json.dumps(bulletin_final, indent=2, ensure_ascii=False), file=sys.stderr)
        # print("--- FIN DÉBOGAGE ---\n", file=sys.stderr)

        # --- ÉTAPE FINALE : GÉNÉRATION DU PDF ---
        print("\nINFO: Génération du PDF...", file=sys.stderr)
        env = Environment(loader=FileSystemLoader('templates/'))
        template = env.get_template('template_bulletin.html')
        html_genere = template.render(bulletin_final)
        
        nom_salarie = nom_dossier_employe 
        mois_annee = f"{mois:02d}-{annee}"
        
        pdf_filename = chemin_employe / 'bulletins' / f"Bulletin_{nom_salarie}_{mois_annee}.pdf"
        
        HTML(string=html_genere, base_url='.').write_pdf(pdf_filename)

        print(f"✅ Bulletin de paie généré avec succès : {pdf_filename}", file=sys.stderr)

        # --- ÉTAPE 6 : MISE À JOUR DES CUMULS ---
        

        smic_calcule_mois = contexte.baremes.get('smic', {}).get('cas_general', 0.0) * total_heures_mois
        pss_du_mois = contexte.baremes.get('pss', {}).get('mensuel', 0.0)

        mettre_a_jour_cumuls(
            contexte, salaire_brut_calcule, remuneration_hs, resultats_nets,
            ligne_reduction_generale, mois, smic_calcule_mois, pss_du_mois,
            chemin_employe
        )
        
        print(json.dumps(bulletin_final, ensure_ascii=False))
        
    except Exception as e:
        print(f"\nERREUR FATALE LORS DE LA GÉNÉRATION : {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    generer_une_fiche_de_paie()