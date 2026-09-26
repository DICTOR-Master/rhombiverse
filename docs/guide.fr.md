# Guide de l'utilisateur de Rhombiverse

Rhombiverse et son jumeau, [Polyhedraverse](https://polyhedraverse.vercel.app), sont deux façons de regarder la même géométrie. Rhombiverse est le **paysage** : les réseaux eux-mêmes, qui s'étendent dans toutes les directions. Polyhedraverse est la **galerie de portraits** : les formes qui habitent ces réseaux, une à la fois, vues de près.

Ici, chaque pièce remplit parfaitement l'espace sur un vrai réseau cristallin : on ne peut donc poser une pièce que là où le réseau a de la place pour elle. Touchez pour ajouter une pièce, appuyez longuement pour en retirer une, et regardez ce que vous avez construit sous différentes vues, de la 2D à la 6D.

La première partie de ce guide présente les tâches courantes. La seconde liste toutes les commandes.

Les noms des boutons sont écrits tels qu'ils apparaissent dans l'application (ceux que l'application ne traduit pas encore restent en anglais).

## Premiers pas

### Choisir une dimension

Après **ENTER**, le sélecteur de dimension s'ouvre : une forme qui tourne lentement et dont les faces sont **2D**, **3D**, **4D**, **5D** et **6D**, chacune avec une icône. Survolez une face (ou appuyez longuement dessus sur un écran tactile) pour voir son nom, puis touchez celle que vous voulez. Faites glisser pour tourner la forme et amener d'autres faces devant.

Vous pourrez changer plus tard depuis **Menu → Change Dimension**, ou depuis le **Wizard** (en haut à gauche), qui présente tous les réseaux de chaque dimension avec leurs pièces en fil de fer qui tournent.

### Poser votre première pièce

Un monde vide affiche un **contour cyan** là où va la première pièce. Touchez-le. Touchez ensuite une face de n'importe quelle pièce (un côté, en 2D) pour ajouter une voisine de l'autre côté.

On construit une pièce à la fois. En 3D, le **RD** (dodécaèdre rhombique) est sélectionné au départ. La pièce que vous posez est affichée sur le bouton **Shape**, en bas à gauche ; touchez-le pour en choisir une autre.

### Retirer une pièce

- **Téléphone ou tablette :** appuyez longuement sur la pièce.
- **Souris :** faites un clic droit sur la pièce. Le clic droit retire dans tous les modes.

Pour annuler votre dernière modification, touchez **Undo** (↶, en bas à droite). Maintenez-le pour remonter plusieurs étapes d'un coup. Chaque dimension a son propre historique : annuler en 2D ne touche jamais à votre construction 3D ou 4D.

### Déplacer la caméra

- **Tourner :** faites glisser un doigt, ou faites glisser avec le bouton gauche de la souris.
- **Zoomer :** pincez, ou utilisez la molette.
- **Déplacer :** faites glisser deux doigts.

## Choisir quoi construire

### Les pièces, par réseau

**2D :** carreaux Parallelogram (parallélogramme), Triangle, Hexagon (hexagone), Kite (cerf-volant) et Kagome, choisis dans le panneau du haut, chacun avec jusqu'à quatre angles de réseau (90°, 70,53°, 63,43° et 60°).

**3D :**

| Réseau | Pièces |
|---|---|
| FCC | Rhombic Dodecahedron (RD, dodécaèdre rhombique), Hemi RD, Hourglass, RD Quarter, Cube, Pyramid |
| RD Dual | Cuboctahedron (CO, cuboctaèdre), Octahedron (octaèdre) |
| BCC | Truncated Octahedron (TO, octaèdre tronqué) |
| BCC Interstitial | Flattened Octahedron, Disphenoid |
| Elongated Dodecahedron | Elongated Dodecahedron (ED, dodécaèdre allongé) |
| Hexagonal | Hex Prism (prisme hexagonal) |
| Rhombohedral | Rhombohedra (rhomboèdres) |
| Pyrochlore (Kagome 3D) | Truncated Tetrahedron (tétraèdre tronqué ; les tétraèdres entre eux sont ajoutés pour vous) |

**4D :**

| Monde | Pièces |
|---|---|
| Z4 | Tesseract (le cube en 4D) |
| D4 | 24-cell, 16-cell |
| Hyper-pyrochlore (Kagome 4D) | 5-cell, Truncated 5-cell, Bitruncated 5-cell |

Essayez ceci en FCC : posez six Pyramid pour former un Cube. Ajoutez ensuite une Pyramid sur chaque face du Cube : il devient un RD. Retirez de nouveau ces six-là pour revenir à un Cube.

**RD Quarter** est l'un des 4 rhomboèdres en lesquels se découpe un RD. Touchez un RD près d'un de ses coins pour remplir ce coin, puis touchez une face d'un quart pour poser son image miroir de l'autre côté de cette face. L'image miroir retombe toujours sur le réseau RD : vous pouvez donc faire croître les quarts de cellule en cellule. Pour un réseau libre de rhomboèdres avec Copy (copie) en plus de Mirror (miroir), utilisez **Rhombohedra**.

### Couleurs

Touchez le **bouton de couleur** (en bas à gauche) pour choisir parmi 14 couleurs. La couleur choisie reste attachée à la pièce que vous posez. Avec **Assigner automatiquement la couleur selon le type de pièce** activé (dans Paramètres), chaque type de pièce commence avec sa propre couleur jusqu'à ce que vous en choisissiez une.

## Regarder votre construction

| Vue | Ce qu'elle montre | Comment l'activer |
|---|---|---|
| World View | Couleur, Translucide ou Squelette | Touchez le bouton World View pour alterner |
| Lattice View | Votre construction et chaque emplacement libre un cran plus loin, pour la pièce choisie | Touchez le bouton Lattice View pour parcourir les pièces |
| X-Ray | Une coupe. Faites glisser le plan à travers la structure, y compris en diagonale | Bouton X-Ray (⛶) |
| Spherical | Chaque pièce affichée comme une quasi-sphère | Bouton Spherical (◯) |
| Duality | Le pavage apériodique que projette cette structure cristalline | Bouton Duality (◐) |
| BCC Lattice | Le réseau cubique centré imbriqué dans le réseau FCC | Bouton BCC Lattice (⬡) |
| Dualize | Échange FCC et BCC | Paramètres → Dualize Preview |

Paramètres propose aussi une **Vue en coupe** : choisissez un axe, faites glisser le curseur pour déplacer la coupe, et cochez **Retourner** pour voir l'autre côté.

## Passer en 4D

1. Choisissez **4D** dans le sélecteur de dimension, le Wizard ou **Menu → Change Dimension**.
2. Choisissez un monde : Tesseract (Z4), 24-cell ou 16-cell (D4), ou une pièce Hyper-pyrochlore.
3. Construisez comme en 3D : touchez une face pour ajouter la cellule 4D voisine.

Un panneau 4D apparaît en bas de l'écran.

- **Coupe / Projection** change votre façon de voir la 4D. **Coupe** (par défaut) montre la coupe 3D à la profondeur actuelle. **Projection** montre des cellules 4D entières comme des ombres ; touchez la face d'une ombre pour construire au travers. En Projection, vous pouvez aussi basculer entre **Parallèle** et **Perspective**.
- **Le curseur** fait ce qu'indique le bouton au-dessus : **Profondeur W** déplace la coupe à travers la quatrième dimension, et **XW**, **YW** et **ZW** la font tourner vers la quatrième dimension. Il s'enclenche à des positions utiles. Celle marquée **FCC** est le monde RD 3D ordinaire, et celle marquée **Pyrochlore** est le monde Pyrochlore 3D.
- **Réinitialiser 4D** remet tout dans la position de départ.
- **Infos** ouvre un panneau qui indique le monde et la pièce que vous posez, ce que vous avez construit, où se trouve la coupe (Profondeur W, ou Projection), les angles de rotation XW/YW/ZW, et les coordonnées 4D du centre de la dernière cellule touchée ou posée.

## Passer en 5D et 6D

La 5D et la 6D sont des **quasicristaux** : un réseau cubique à cinq ou six dimensions, coupé à travers l'espace 3D. Les pièces remplissent l'espace sans vide, mais le motif ne se répète jamais.

- **6D** est le quasicristal icosaédrique. Ses pièces sont deux rhomboèdres dorés : **prolate** (allongé) et **oblate** (aplati).
- **5D** est le quasicristal décagonal : des couches du pavage de Penrose, faites de prismes losanges **thick** (épais) et **thin** (fins).

1. Choisissez **5D** ou **6D** dans le sélecteur de dimension, le Wizard ou **Menu → Change Dimension**.
2. Touchez le contour cyan pour poser la première pièce, puis touchez une face pour ajouter la pièce voisine. En 5D, les faces du haut et du bas ajoutent une couche au-dessus ou en dessous.

Vous ne choisissez pas la forme : c'est le pavage qui décide quelle pièce va dans chaque emplacement.

Un panneau apparaît en bas de l'écran.

- **Le curseur** fait ce qu'indique le bouton au-dessus. **Phason 1**, **Phason 2** et **Phason 3** (6D seulement) déplacent la coupe latéralement à travers les dimensions cachées : des pièces basculent, certaines quittent la coupe et d'autres y entrent. Les pièces masquées par la coupe ne sont pas supprimées ; revenez en arrière et elles réapparaissent. **Approximant** parcourt des cristaux périodiques (1/1, 2/1, 3/2, 5/3, 8/5 …) de plus en plus proches du vrai quasicristal, **τ**, tout à droite.
- **Construire / Fenêtre** passe à la **vue Fenêtre**, qui montre les dimensions cachées. La fenêtre est un triacontaèdre rhombique en 6D et un ensemble de pentagones en 5D. Chaque sommet de vos pièces est un point : blanc dans la fenêtre (le sommet est dans la coupe), rouge dehors. Déplacez un curseur de phason et regardez les points franchir le bord de la fenêtre à mesure que des pièces apparaissent et disparaissent.
- **Réinitialiser 5D** / **Réinitialiser 6D** remet le curseur au départ : phason 0 à τ.
- **Infos** indique le monde, ce que vous avez construit, combien de pièces sont dans la coupe et combien elle en masque, les réglages de phason et d'approximant et, en vue Fenêtre, combien de sommets sont à l'intérieur. Les éléments invoqués y sont aussi listés : touchez-en un pour revenir à ses réglages.

**Lattice View** montre en fantôme le pavage alentour, un cran plus loin, et il bascule quand vous déplacez un phason. **World View** fonctionne comme en 3D.

### Le Catalogue

En 5D et 6D, le bouton en bas à gauche ouvre le **Catalogue** (les cartes 5D et 6D du Wizard l'ouvrent aussi). Il propose quatre sortes d'éléments :

- **Zonoèdres :** des formes faites des propres pièces du pavage, d'un seul rhomboèdre jusqu'au triacontaèdre rhombique, et en 5D des prismes losange, hexagonal, octogonal et décagonal.
- **Polytopes :** les ombres de polytopes de dimension supérieure, comme le 6-orthoplexe, dont l'ombre est un icosaèdre. Une ombre se pose sur le pavage sans bloquer les pièces, et ses sommets s'allument là où ils sont dans la coupe. Appuyez longuement sur une ombre pour la retirer.
- **Ponts :** des hyperprismes, polytopes prolongés d’un pas dans une dimension de plus, comme le prisme du 5-orthoplexe. Comme les polytopes, ils se posent en ombres.
- **Étoiles de sommet :** toutes les façons dont les pièces se rejoignent en un sommet (7 en 5D, 24 en 6D), aussi avec un ou deux anneaux de pièces autour. Touchez un titre pour ouvrir sa liste.

Chaque élément a un numéro de série. Saisissez-le dans la case et touchez **Invoquer** pour y aller directement.

Quand vous choisissez un élément, un **contour doré** apparaît là où il se trouve vraiment dans votre quasicristal. Touchez votre construction pour amener le contour à l'endroit le plus proche, puis touchez le contour pour le poser en pièces ordinaires. Si l'élément appartient à un autre approximant, le curseur y glisse d'abord. **Annuler l'invocation** arrête. Un **Undo** l'annule et ramène le curseur là où il était.

**Relier** (dans le panneau, dès que vous avez deux pièces) joint deux éléments : touchez une pièce de chacun, et la plus courte chaîne de vraies tuiles entre eux est posée comme un connecteur. Un **Undo** l’annule.

## Couches

Un monde 3D pour construire des **enveloppes** : des couches de dodécaèdres rhombiques (RD), chaque couche avec sa bande de couleur, comptées depuis votre première pièce. Choisissez-le dans l'écran 3D du Wizard.

- **+ Couche** remplit la couche suivante, **− Couche** retire la plus extérieure. **Enveloppe** choisit comment les couches se comptent : **Pas** (un cuboctaèdre : 13, 55, 147 … pièces), **Distance** (vers une sphère), ou une forme cible (tétraèdre, cube, octaèdre, RD ou octaèdre tronqué). **Rogner** coupe l'enveloppe exactement à plat selon cette forme.
- Mode **Fragmenter** : touchez une pièce, puis choisissez une **Découpe** (moitiés, tiers, quarts, sixièmes, huitièmes, douzièmes, seizièmes, vingt-quatrièmes ou quarante-huitièmes) ; **Tourner** change la coupe. En mode Construire, le menu **Pièce** pose aussi des parties seules.
- **Échelle** construit avec des RD plus grands (×2 à ×4). **Fusionner ×2 / ×3** sur une pièce ciblée montre le contour du grand RD, puis **Confirmer la fusion** le met en place ; le menu Découpe le rouvre.
- **Infos** montre le diagramme d'anneaux : touchez un anneau pour masquer ou afficher cette couche et voir l'intérieur, retirez n'importe quelle couche et choisissez les couleurs des bandes.

## Rhomboèdres dorés

Un monde 3D avec les deux pièces du pavage de Penrose en 3D. Choisissez-le dans l'écran 3D du Wizard. Touchez le contour cyan, puis une face pour ajouter la pièce **Allongée** ou **Aplatie** choisie dans le menu Pièce. Le **Contrôle Penrose** colore en vert les pièces qui appartiennent au vrai pavage apériodique et en rouge celles qui s'en écartent ; Lattice View montre le vrai pavage autour, et toucher un fantôme le pose.

## Enregistrer votre travail

Votre monde est enregistré automatiquement dans ce navigateur, pour toutes les dimensions, après chaque modification. Il revient quand vous rouvrez le site sur le même appareil et le même navigateur.

Dans **Paramètres** :

- **Exporter le Monde** enregistre tout (chaque réseau 3D, vos carreaux 2D et vos constructions 4D, 5D et 6D) dans un seul fichier. Utilisez-le pour faire une sauvegarde ou transférer votre monde sur un autre appareil.
- **Importer un Monde** ouvre un fichier exporté. **Undo** annule une importation.
- **Nouveau Monde** recommence avec un monde vide. **Clear World** (⊘) fait la même chose depuis la roue du coin. Undo peut le rétablir.

## Découvrir les mathématiques

- **Almanac :** les mathématiques et la géométrie derrière chaque pièce et chaque réseau. Ouvrez-le depuis Menu → Almanac.
- **What's New** liste les changements récents.

---

# Référence des commandes

## Boutons à l'écran

| Commande | Ce qu'elle fait |
|---|---|
| Wizard (en haut à gauche) | Parcourir les dimensions et les réseaux, chacun avec ses pièces |
| Shape (en bas à gauche) | La pièce que vous posez. Touchez pour la changer |
| Couleur (en bas à gauche) | Couleur de construction. Touchez pour la changer |
| Lattice View | Alterne entre Off et une vue pour chaque pièce |
| Assemblage Rhombohedra | Affiché seulement pour Rhombohedra : bascule entre Copy et Mirror |
| Undo (↶, en bas à droite) | Touchez pour annuler une étape dans la dimension actuelle. Maintenez pour remonter plus loin |
| Menu | Ouvre la roue du menu (clavier : Tab ou Espace) |

## Roue du coin

Faites glisser la petite roue du coin pour la tourner. Touchez une face pour l'utiliser.

| Symbole | Commande |
|---|---|
| ⚙ | Paramètres |
| ⛶ | X-Ray |
| ◐ | Duality |
| ⬡ | BCC Lattice |
| ◇ | Menu |
| ⊘ | Clear World |
| ↻ | Reload (à utiliser si quelque chose semble bloqué) |
| ◯ | Spherical |
| — | World View, Cuboctahedron Build |

## Roue du menu

Le menu est un dodécaèdre rhombique. Chaque face est une section : touchez une face pour l'ouvrir, et utilisez **Home** pour revenir. **Settings** et **Almanac** sont toujours sur les faces du haut.

| Section | Contenu |
|---|---|
| Home | Piece, Color, Change Dimension |
| Piece | RD family, Cube, Pyramid, TO, Flattened Octahedron, Disphenoid, CO, Octahedron |
| RD family | RD, Hemi RD, Hourglass, RD Quarter, ED, Hex Prism, Rhombohedra, Pyrochlore |
| Change Dimension | 2D, 3D, 4D, 5D, 6D |

## Paramètres

| Paramètre | Ce qu'il fait |
|---|---|
| Sensibilité de la vue | Vitesse de rotation de la caméra |
| Inverser l'axe Y | Inverse le glissement vertical |
| Champ de vision | Largeur de l'objectif de la caméra |
| Qualité graphique | Basse, Moyenne ou Haute |
| Afficher le compteur de FPS | Compteur d'images par seconde |
| Volume | Niveau sonore |
| Langue | English, 日本語, Español, Français, 한국어, 中文, Русский (aussi avec le sélecteur 🌐 en haut de l'écran d'accueil et de ce guide) |
| Assigner automatiquement la couleur selon le type de pièce | Donne à chaque type de pièce sa propre couleur |
| Vue en coupe, axe, position, Retourner | Coupe le long d'un axe |
| Build Cuboctahedron, Dualize Preview | Modes de construction spéciaux |
| Nouveau Monde, Exporter le Monde, Importer un Monde | Recommencer, sauvegarder et restaurer (toutes les dimensions) |

## Clavier et souris

| Entrée | Action |
|---|---|
| Clic gauche sur une face | Ajouter une pièce |
| Clic droit sur une pièce | La retirer |
| Glisser avec le bouton gauche | Tourner la caméra |
| Molette | Zoomer |
| Tab ou Espace | Ouvrir la roue du menu |
| Échap | Fermer le menu, le Wizard ou l'Almanac |
| Entrée | Entrer depuis l'écran d'accueil |

## Tactile

| Geste | Action |
|---|---|
| Toucher une face | Ajouter une pièce |
| Appui long sur une pièce | La retirer |
| Glisser un doigt | Tourner la caméra |
| Pincer | Zoomer |
| Glisser deux doigts | Déplacer |
