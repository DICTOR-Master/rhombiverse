# Guide de l'utilisateur de Rhombiverse

Rhombiverse et son jumeau, [Polyhedraverse](https://polyhedraverse.vercel.app), sont deux façons de regarder la même géométrie. Rhombiverse est le **paysage** : les réseaux eux-mêmes, qui s'étendent dans toutes les directions. Polyhedraverse est la **galerie de portraits** : les formes qui habitent ces réseaux, une à la fois, vues de près.

Ici, chaque pièce remplit parfaitement l'espace sur un vrai réseau cristallin : on ne peut donc poser une pièce que là où le réseau a de la place pour elle. Touchez pour ajouter une pièce, appuyez longuement pour en retirer une, et regardez ce que vous avez construit sous différentes vues, en 2D, 3D ou 4D.

La première partie de ce guide présente les tâches courantes. La seconde liste toutes les commandes.

Les noms des boutons sont écrits tels qu'ils apparaissent dans l'application (ceux que l'application ne traduit pas encore restent en anglais).

## Premiers pas

### Choisir une dimension

Après **ENTER**, le sélecteur de dimension s'ouvre : une forme qui tourne lentement et dont les faces sont **2D**, **3D** et **4D**, chacune avec une icône. Survolez une face (ou appuyez longuement dessus sur un écran tactile) pour voir son nom, puis touchez celle que vous voulez. Faites glisser pour tourner la forme et amener d'autres faces devant.

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

- **Slice / Projection** change votre façon de voir la 4D. **Slice** (par défaut) montre la coupe 3D à la profondeur actuelle. **Projection** montre des cellules 4D entières comme des ombres ; touchez la face d'une ombre pour construire au travers. En Projection, vous pouvez aussi basculer entre **Parallel** (parallèle) et **Perspective**.
- **Le curseur** fait ce qu'indique le bouton au-dessus : **W-depth** déplace la coupe à travers la quatrième dimension, et **XW**, **YW** et **ZW** la font tourner vers la quatrième dimension. Il s'enclenche à des positions utiles. Celle marquée **FCC** est le monde RD 3D ordinaire, et celle marquée **Pyrochlore** est le monde Pyrochlore 3D.
- **Reset 4D** remet tout dans la position de départ.
- **Info** ouvre un panneau qui indique le monde et la pièce que vous posez, ce que vous avez construit, où se trouve la coupe (W-depth, ou Projection), les angles de rotation XW/YW/ZW, et les coordonnées 4D du centre de la dernière cellule touchée ou posée.

## Enregistrer votre travail

Votre monde est enregistré automatiquement dans ce navigateur, pour toutes les dimensions, après chaque modification. Il revient quand vous rouvrez le site sur le même appareil et le même navigateur.

Dans **Paramètres** :

- **Exporter le Monde** enregistre tout (chaque réseau 3D, vos carreaux 2D et votre construction 4D) dans un seul fichier. Utilisez-le pour faire une sauvegarde ou transférer votre monde sur un autre appareil.
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
| Change Dimension | 2D, 3D, 4D |

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
