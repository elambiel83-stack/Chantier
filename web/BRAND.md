# Chantier.online

Identité : « Tout pour bâtir. », casque au-dessus de trois bâtiments, bleu nuit #14283F,
orange #F47B20 et blanc. Le logo principal est `assets/chantier-logo.svg` ;
la variante claire est `assets/chantier-logo-light.svg` et le symbole est
`assets/chantier-mark.svg`. Icônes PWA PNG 192/512 et icône Apple 180.

La photographie d'accueil est une illustration générée et optimisée en WebP ;
elle ne représente pas une équipe ou un chantier réel de l'entreprise.

Le frontend est statique : aucun script de compilation. Contrôles réalisés :
syntaxe de site.js, tickets.js et sw.js ; parsing SVG et manifest ; existence
des liens et ressources HTML locaux ; git diff --check.

À vérifier dans un navigateur avant mise en ligne : affichage à 390/768/1440 px,
absence de débordement dans la navigation, changement FR/EN, panier, connexion,
espaces administrateur/partenaire et mise à jour d'une PWA déjà installée.
La vérification visuelle automatisée n'a pas pu être exécutée : téléchargement
Chromium indisponible dans l'environnement de travail.

Les adresses de contact, URLs d'API, clés de stockage, paiements et protections
d'accès restent ceux de l'application existante. Configurer séparément le DNS,
l'hébergement et les origines autorisées pour chantier.online.

Le logo casque/bâtiments remplace le C. Texte converti en tracés ; typographie reconstruite à partir du visuel choisi.
