# Guide de l'utilisateur de Rhombiverse

Rhombiverse et son jumeau, [Polyhedraverse](https://polyhedraverse.vercel.app), sont deux façons de regarder la même géométrie. Rhombiverse est le **paysage** : les réseaux eux-mêmes, qui s'étendent dans toutes les directions. Polyhedraverse est la **galerie de portraits** : les formes qui habitent ces réseaux, une à la fois, vues de près.

Ici, chaque pièce remplit parfaitement l'espace sur un vrai réseau cristallin : on ne peut donc poser une pièce que là où le réseau a de la place pour elle. Touchez pour ajouter une pièce, appuyez longuement pour en retirer une, et regardez ce que vous avez construit sous différentes vues, de la 1D à la 6D.

La première partie de ce guide présente les tâches courantes. La seconde liste toutes les commandes.

Les noms des boutons sont écrits tels qu'ils apparaissent dans l'application (ceux que l'application ne traduit pas encore restent en anglais).

## Premiers pas

### Choisir une dimension

Après **ENTER**, le sélecteur de dimension s'ouvre : une forme qui tourne lentement et dont les faces sont **1D+**, **2D**, **3D**, **4D**, **5D** et **6D**, chacune avec une icône. Survolez une face (ou appuyez longuement dessus sur un écran tactile) pour voir son nom, puis touchez celle que vous voulez. Faites glisser pour tourner la forme et amener d'autres faces devant.

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

**Signal 1D** (Wizard → 1D+ → Signal) : une seule ligne de cellules en forme de balle qui porte un message. Tapez un message sur la ligne du bas (il remplace le précédent ; modifiez-le normalement) : il apparaît en cellules fantômes, son code Morse, inutile de le connaître, la suivante en orange. Touchez-la pour les poser une à une, ou appuyez sur **Envoyer** (ou Entrée) pour poser le reste et mettre le message en route le long de la ligne, en s'éloignant de vous (■ l'arrête). Champ vide, il affiche ce que dit la ligne. Le bouton œil alterne entre **Dehors** (de derrière et d'en haut : la ligne monte à l'écran et s'affine au loin, une brume pâle la prolongeant vers l'infini) et **Dedans** (dans le tunnel : les cellules passent juste sous vous et montent vers un point au loin). Un appui long retire une cellule, et la ligne se referme derrière : elle est à une dimension.

La **touche d'impulsion** ronde à côté du message est un manipulateur télégraphique : touchez pour un point, maintenez pour un trait ; une courte pause commence une nouvelle lettre, une plus longue un nouveau mot. Ce que vous tapez s'affiche dans le champ du message en points et traits (· –), une espace entre les lettres et / entre les mots ; modifiez-les là comme un texte (. et - fonctionnent aussi). Le petit parchemin à côté d'Envoyer ouvre le glossaire du **code Morse** : chaque lettre, chiffre et signe avec ses points et traits ; touchez-en un pour l'ajouter au message. Pendant que le signal défile, le message s'affiche en haut de l'écran, lettre par lettre, à mesure qu'il arrive. À l'intérieur, faites glisser pour regarder autour, pincez (ou faites défiler) pour avancer dans le tunnel, et glissez deux doigts vers le haut ou le bas (ou Maj + défilement) pour monter ou descendre ; relâchez et la vue revient doucement. La touche apprend votre propre rythme, alors tapez aussi lentement et soigneusement que vous voulez : elle lit vos appuis courts comme des points et les longs comme des traits, et compare vos pauses entre elles. Les lettres qu'elle lit s'affichent au-dessus du champ du message pendant que vous tapez.

**Construire 1D** (Wizard → 1D+ → Construct · Square) : construisez un carré avec des cellules 1D, une touche et une ligne à la fois. Seule la ligne où vous êtes s'affiche ; la cellule suivante est orange : touchez-la pour la remplir. Le premier côté monte à l'écran le long de **X** ; au coin, une jonction brille, **Y** se joint (X reste) et la ligne construite s'estompe ; continuez dans le sens des aiguilles d'une montre : par le haut, en descendant le côté opposé (une deuxième ligne X, parallèle à la première) et en revenant par le bas. Quand la boucle se ferme, tout le carré apparaît et se remplit, et **Ouvrir en 2D** l'emmène vers le carreau carré de la 2D. Un appui long retire la dernière cellule.

Puis le cube : quand le carré se ferme, la vue pivote de trois quarts et **Z** s'élève depuis le coin de départ. Construisez sa première arête cellule par cellule ; ensuite, chaque toucher remplit une arête entière : les trois autres arêtes Z, puis le carré du haut. Chaque arête porte son nom numéroté (X1, Y2, Z3 …) ; les arêtes finies s'estompent et celle qu'on vient de finir reste pleine jusqu'à la suivante. Une fois fermé, le cube apparaît en entier avec des faces pâles. Une fois fermé, il passe aussitôt dans son réseau : les cubes voisins en transparence, pavant l'espace (le bouton **réseau** les masque ou les affiche). Le carré fermé a aussi son bouton réseau, qui le montre pavant le plan. L'indicateur à côté de Wizard montre jusqu'où vous avez construit (**1D+**, **1D+/2D**, **1D+/2D/3D**, **1D+/2D/3D/4D**). **⊘**, à côté d'Annuler, efface toute la construction pour recommencer (Annuler la rétablit), et le sélecteur **Signal | Construct** sous Wizard passe d'un monde 1D à l'autre.

Puis le tesseract : quand le cube se ferme (**Ouvrir en 3D** l'emmène vers la pièce Cube de la 3D), la quatrième direction **W** part du coin de départ vers l'intérieur : W est dessinée en perspective, donc le second cube est plus petit, à l'intérieur du premier. Construisez sa première arête cellule par cellule, puis une arête par toucher : les sept autres arêtes W, puis le cube intérieur. Une fois fermé, il passe aussitôt dans son réseau ; touchez pour le faire tourner lentement à travers W, les cubes intérieur et extérieur échangeant leur place (touchez encore pour l'arrêter), et **Ouvrir en 4D** l'emmène vers le monde hypercubique (Z4) de la 4D.

**1D+ Construct · Kagome** (Wizard → 1D+ → Construct · Kagome) : d'abord un hexagone, construit à la main, une cellule par toucher, son premier côté vers le haut, dans le sens des aiguilles d'une montre, d'un seul trait. Il prend les trois directions de Kagome : **X**, puis **Y** au premier coin, puis **XY** (X et Y ensemble, donc toujours en 2D). Le fermer, c'est le moment 2D : son bouton réseau montre le nid d'abeilles, et **Ouvrir en 2D** l'emmène vers le carreau Hexagone de la 2D. Puis l'étoile de Kagome pousse autour, une arête par toucher (aucune nouvelle direction) : jusqu'à chaque pointe et retour au coin suivant, où deux lignes de Kagome se croisent. Une fois fermée, l'étoile passe aussitôt dans le réseau de Kagome, et **Ouvrir en 2D** l'emmène vers le carreau Kagome. Puis **Z**, vers le pyrochlore (Kagome en 3D), au même rythme : d'abord les parties hexagonales, le tétraèdre tronqué posé sur votre hexagone (quatre hexagones, quatre triangles ; la première arête de Z à la main, le reste en deux touchers), le moment 3D ; puis les mini tétraèdres sur ses triangles, les quatre d'un toucher, trois sur les pointes de l'étoile et un au sommet. Ensemble, ils forment un grand tétraèdre, la pièce Pyrochlore de la 3D : il passe aussitôt dans le réseau pyrochlore, et **Ouvrir en 3D** l'y emmène. Puis **W**, vers l'hyperpyrochlore (Kagome en 4D), une fois encore au même rythme : le corps, la 5-cellule tronquée (cinq tétraèdres tronqués, dont le vôtre, et cinq tétraèdres ; W dessinée en perspective, vers l'intérieur), la première arête de W à la main et le reste en deux touchers, puis les membres, une petite 5-cellule sur chaque tétraèdre, les cinq d'un toucher. Ensemble, une grande 5-cellule : touchez pour la faire tourner à travers W, et **Ouvrir en 4D** l'emmène vers le monde Hyperpyrochlore. Le corps en cyan, les membres en or, jusqu'au bout. Chaque famille de Construct (carré, Kagome, RD) garde sa propre progression.

**1D+ Construct · RD** (Wizard → 1D+ → Construct · RD) : la famille phare. D'abord le losange propre au RD, à la main comme le carré, en partant de son coin de 70,53°, premier côté vers le haut, dans le sens des aiguilles d'une montre : le moment 2D (son bouton réseau montre le réseau losange, et **Ouvrir en 2D** l'emmène vers le Parallélogramme à l'angle du losange du RD). Puis **Z** vers le dodécaèdre rhombique, dans la grammaire propre au RD : d'abord le corps, le cube intérieur (cyan ; ses arêtes sont les petites diagonales des losanges ; la première arête de Z à la main, le reste d'un toucher), puis les membres, une pyramide sur chacune de ses six faces (or, les six d'un toucher), dont les arêtes sont celles du RD. Il passe aussitôt dans son réseau, les douze RD autour, et **Ouvrir en 3D** y place un RD. Puis **W** : le RD est l'ombre de la 24-cellule, donc l'ouvrir donne la 24-cellule. Chaque coin de son cube se sépare en deux, un de chaque côté en W, et les deux copies forment le tesseract (le corps : la première arête de W à la main, les autres coins d'un coup). Puis les membres : les six sommets rejoignent les deux côtés d'un toucher, et deux nouveaux sommets le long de W d'un autre. C'est la 24-cellule, 96 arêtes, qui tourne à travers W, le RD restant comme son ombre ; **Ouvrir en 4D** l'emmène vers le monde D4.

**2D :** carreaux Parallelogram (parallélogramme), Triangle, Hexagon (hexagone), Kite (cerf-volant) et Kagome, choisis dans le panneau du haut, chacun avec jusqu'à quatre angles de réseau (90°, 70,53°, 63,43° et 60°).

**Kaléidoscope 2D** (Wizard → 2D → Kaleidoscope) : un monde à part. Construisez avec des losanges de Penrose épais et fins, des pentagones, des triangles, des hexagones et des carrés (tous de même longueur d'arête, donc n'importe lesquels s'assemblent arête contre arête). L'endroit touché décide : près de l'arête d'une pièce, la pièce choisie se place de l'autre côté ; dans le vide, elle tombe libre et glisse jusqu'à s'aligner à côté d'une partenaire. Les pièces ne se chevauchent jamais. Les miroirs reflètent votre construction en kaléidoscope : le bouton miroir passe d'un Anneau (○, 1 à 12 miroirs) à un triangle de trois (△60°, △45°, △30°) répété sur l'écran, réglé avec le curseur ; **Tourner** fait pivoter la construction face aux miroirs, **↻** la fait tourner en continu, **≈** secoue toutes les pièces pour qu'elles forment un nouveau motif. **Safe** (formes de Penrose seulement) garde les losanges dans la règle de Penrose, pour toujours former un vrai pavage de Penrose. **Lattice View** montre les lignes des miroirs et, en contour, chaque place où la pièce entre.

**Patrons 2D** (Wizard → 2D → Nets) : de la 2D à la 3D. Choisissez un solide dans le panneau : les **cellules de Voronoï**, cube, RD et TO (octaèdre tronqué), les cellules qui pavent l'espace des réseaux cubiques simple, à faces centrées et centré ; son patron apparaît comme un fantôme pâle. Suivez-le : touchez pour construire la première face côté par côté, en cellules 1D, puis chaque toucher construit la face suivante. Quand le patron est complet, touchez et il se plie en solide (l'indicateur affiche **2D/3D**) ; le **curseur de pliage** le plie et le déplie à la main, et **Ouvrir en 3D** y emmène le solide terminé. Un appui long retire une face (ou déplie). Chaque solide garde sa propre progression. Les **solides de Platon** forment un second groupe : tétraèdre, octaèdre, icosaèdre, dodécaèdre et le cube. **Ouvrir en 3D** apparaît pour les solides que le monde 3D a comme pièces (cube, RD, TO, octaèdre). **⊘** à côté d'Undo efface le patron en cours.

**Paint** (toutes les dimensions sauf 1D+) : le pinceau de la rangée du bas, ou l'interrupteur Paint au centre de la roue des couleurs, recolore les pièces déjà posées. Activez-le, choisissez une couleur, touchez une pièce ; désactivez-le pour construire à nouveau. Les couleurs passent en Pick, chaque pièce montre donc sa propre couleur. (Shells et Golden Rhombohedra colorent leurs pièces par bande et par type, Paint n'y est donc pas proposé.) Quand la place de la rangée du bas est prise par un choix d'assemblage (Rhombohedra et Pyrochlore en 3D), le pinceau est juste au-dessus ; en 4D, il est dans le panneau 4D.

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

Les pièces sont colorées selon le réglage **Couleurs** (dans Réglages) : **Cyan** (toutes cyan, par défaut), **Type** (chaque type de pièce dans sa couleur, modifiable dans la liste affichée) ou **Choisir** (chaque pièce garde la couleur avec laquelle elle a été posée). Touchez le **bouton de couleur** (en bas à gauche) pour choisir parmi 15 couleurs : en Cyan, cela passe à Choisir ; en Type, cela change la couleur du type de pièce que vous posez. Changer de mode ne perd jamais les couleurs de pose.

## Regarder votre construction

| Vue | Ce qu'elle montre | Comment l'activer |
|---|---|---|
| World View | Couleur, Translucide ou Squelette | Touchez le bouton World View pour alterner |
| Lattice View | Votre construction et chaque emplacement libre un cran plus loin, pour la pièce choisie | Touchez le bouton Lattice View pour parcourir les pièces |
| X-Ray | Une coupe. Faites glisser le plan à travers la structure, y compris en diagonale | Bouton X-Ray (⛶) |
| Spherical | Chaque pièce affichée comme une quasi-sphère | Bouton Spherical (◯) |
| Packed spheres | Une sphère tangente par RD ; puis les vides entre elles (octaédriques or, tétraédriques rose), là où ils sont fermés ; un curseur règle la taille (0 = fil de fer, cran au contact, au-delà = chevauchement) ; avec Lattice View, chaque place libre du réseau apparaît en sphère pâle. Vue seulement | Face Packed spheres (trois cercles) de la roue d'angle : éteint → sphères → vides |
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
- **Paint** (le pinceau) apparaît dans ce panneau pour les pièces 24-cellule, 16-cellule et hyperpyrochlore, dont le choix d'assemblage prend la place du pinceau dans la rangée du bas.
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
| Wizard (en haut à gauche) | Parcourir les dimensions et les réseaux, chacun avec ses pièces. La grande étiquette orange à côté indique la dimension où vous êtes |
| Shape (en bas à gauche) | La pièce que vous posez. Touchez pour la changer |
| Couleur (en bas à gauche) | Couleur de construction. Touchez pour la changer |
| Lattice View | Alterne entre Off et une vue pour chaque pièce |
| Choix d'assemblage | Affiché seulement pour les pièces qui s'assemblent de plusieurs façons (Rhombohedra : Copy / Mirror ; Pyrochlore : petit / grand tétraèdre ; 24-cellule / 16-cellule ; les trois 5-cellules de l'hyperpyrochlore) : touchez pour basculer |
| Undo (↶, en bas à droite) | Touchez pour annuler une étape dans la dimension actuelle. Maintenez pour remonter plus loin |
| Paint (pinceau) | Recolore les pièces posées : activez-le, choisissez une couleur, touchez une pièce. À la place du choix d'assemblage dans la rangée du bas ; quand ce choix est nécessaire, juste au-dessus (en 4D, dans le panneau 4D) |
| Signal \| Construct (sous Wizard, 1D+ seulement) | Passe d'un monde 1D+ à l'autre |
| ⊘ Effacer (à côté d'Undo, 1D+ et Nets) | Efface le monde 1D+ où vous êtes pour recommencer (dans Nets, le patron en cours) ; Undo le rétablit |
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
| ⚬⚬⚬ | Packed spheres (éteint → sphères → vides) |
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
| Couleurs | Cyan, Type ou Choisir : la coloration des pièces |
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
