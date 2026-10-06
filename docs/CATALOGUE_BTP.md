# Catalogue BTP étendu

Le catalogue de référence commun au navigateur et au backend contient **821 entrées** : **523 produits**, **252 services et métiers**, **30 types de partenaires**, **16 prestations de facilitation**. Il complète les sept offres de lancement et les anciennes références conservées pour compatibilité.

La définition unique est `web/construction-catalog.js` ; `backend/constructionCatalog.js` la réexporte. Elle est chargée aussi lorsque l’API est indisponible. Le filtre « offres de lancement uniquement » est désactivé par défaut.

## Familles

| Catégorie / famille | Entrées |
| --- | ---: |
| produits / aggregats | 24 |
| produits / blocs_paves | 19 |
| produits / acier_metaux | 29 |
| produits / bois_menuiserie | 20 |
| produits / toiture_etancheite | 19 |
| produits / revetements_finitions | 29 |
| produits / plomberie_sanitaire | 25 |
| produits / electricite_energie | 26 |
| produits / securite | 20 |
| produits / routes_assainissement | 13 |
| produits / outillage_engins | 33 |
| services / etudes | 12 |
| services / travaux | 28 |
| services / logistique | 11 |
| services / maintenance | 13 |
| services / numerique | 8 |
| services / metiers | 58 |
| produits / beton_chimie | 26 |
| produits / prefabrication_structure | 12 |
| produits / fixations_quincaillerie | 19 |
| produits / facades_vitrages | 21 |
| produits / isolation_toiture | 15 |
| produits / hvac_ventilation | 15 |
| produits / eau_assainissement | 22 |
| produits / electricite_industrielle | 20 |
| produits / reseaux_telecom | 12 |
| produits / voirie_geotechnique | 16 |
| produits / chantier_provisoire | 15 |
| produits / outillage_consommables | 33 |
| produits / epi_secours | 15 |
| produits / amenagements_exterieurs | 13 |
| produits / equipements_batiment | 12 |
| services / etudes_specialisees | 27 |
| services / fondations_demolition | 17 |
| services / installations_specialisees | 24 |
| services / logistique_chantier | 19 |
| services / controle_reception | 15 |
| services / maintenance_specialisee | 20 |
| partenaires / reseau_approvisionnement | 16 |
| partenaires / reseau_execution | 14 |
| facilitation / accompagnement_projet | 16 |

## Portée commerciale

Les nouvelles entrées sont des familles de références à sourcer, pas des stocks disponibles ni des fournisseurs déjà agréés. Prix initial : sur devis ; stock initial : zéro. Pour les nouvelles familles de produits, unité, dimensions, qualité, conditionnement, certifications et quantités sont à confirmer sur devis. Le catalogue ne prétend pas énumérer chaque combinaison de dimensions ou chaque variante fabricant. Les nouveaux libellés sont en français ; leur champ anglais reprend provisoirement ce libellé.

Les prestataires peuvent sélectionner plusieurs métiers dans leur fiche ; la limite de sélection suit la nomenclature. La synchronisation ajoute les références manquantes et conserve les prix et stocks déjà confirmés en base. Un article sans prix positif ne peut pas être acheté directement via le panier ou la commande.

## Mise à jour du site

Redéployer le backend et les fichiers Web. Le backend synchronise le catalogue lors du premier accès après démarrage. Aucun changement de schéma supplémentaire n’est nécessaire pour cette extension ; les migrations des modules précédents doivent avoir été appliquées. Le nouveau service worker actualise le code du catalogue. Publier dans GitHub ne met pas automatiquement chantier.online en ligne si le domaine n’est pas relié à l’hébergement.

## Vérification

Les tests vérifient les identifiants historiques, l’unicité des références, l’affichage du catalogue complet en repli, l’absence du filtre de lancement par défaut, ainsi que la préservation des prix et stocks existants après deux synchronisations PostgreSQL.
