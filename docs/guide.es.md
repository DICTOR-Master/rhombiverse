# Guía del usuario de Rhombiverse

Rhombiverse y su gemelo, [Polyhedraverse](https://polyhedraverse.vercel.app), son dos maneras de mirar la misma geometría. Rhombiverse es el **paisaje**: las propias redes, que se extienden en todas direcciones. Polyhedraverse es la **galería de retratos**: las formas que viven en esas redes, de una en una y de cerca. Un tercer hermano, [Kaleidohedra](https://kaleidohedra.vercel.app), **mueve el paisaje**: redes que puedes cizallar y deslizar, con cada pieza moviéndose con ellas.

Aquí cada pieza llena el espacio a la perfección sobre una red cristalina real, así que solo puedes poner una pieza donde la red tenga sitio para ella. Toca para añadir una pieza, mantén pulsado para quitarla y observa lo que has construido con distintas vistas, de 1D a 6D.

La primera parte de esta guía recorre las tareas habituales. La segunda enumera todos los controles.

Los nombres de los botones aparecen tal como se ven en la aplicación (los que la aplicación aún no traduce siguen en inglés).

## Primeros pasos

### Elige una dimensión

Después de **ENTER** se abre el selector de dimensión: una figura que gira despacio y cuyas caras son **1D+**, **2D+**, **3D+**, **4D**, **5D** y **6D**, cada una con un icono. Pasa el cursor por una cara (o mantenla pulsada en una pantalla táctil) para ver su nombre y toca la que quieras. Arrastra para girar la figura y traer otras caras al frente.

Puedes cambiar más tarde desde **Menú → Change Dimension**, o desde el **Wizard** (arriba a la izquierda), que muestra todas las redes de cada dimensión con sus piezas como estructuras de alambre giratorias.

### Coloca tu primera pieza

Un mundo vacío muestra un **contorno cian** donde va la primera pieza. Tócalo. Después toca una cara de cualquier pieza (un lado, en 2D+) para añadir una vecina al otro lado.

Se construye pieza a pieza. En 3D+ empiezas con el **RD** (dodecaedro rómbico) seleccionado. La pieza que estás colocando aparece en el botón **Shape**, abajo a la izquierda; tócalo para elegir otra.

### Quita una pieza

- **Móvil o tableta:** mantén pulsada la pieza.
- **Ratón:** haz clic derecho sobre la pieza. El clic derecho quita piezas en cualquier modo.

Para deshacer tu último cambio, toca **Undo** (↶, abajo a la derecha). Mantenlo pulsado para retroceder varios pasos a la vez. Cada dimensión tiene su propio historial, así que deshacer en 2D+ nunca afecta a lo que has construido en 3D+ o 4D.

### Mueve la cámara

- **Girar:** arrastra con un dedo, o con el botón izquierdo del ratón.
- **Zoom:** pellizca, o usa la rueda del ratón.
- **Desplazar:** arrastra con dos dedos.

## Qué construir

### Las piezas, por red

**Señal 1D** (Wizard → 1D+ → Signal): una sola línea de celdas en forma de bala que lleva un mensaje. Escribe un mensaje en la línea de abajo (sustituye al anterior; edítalo como siempre): aparece como celdas fantasma, su código Morse, no hace falta saberlo, con la siguiente en naranja. Tócala para colocarlas de una en una, o pulsa **Enviar** (o Intro) para colocar el resto y poner el mensaje en marcha por la línea, alejándose de ti (■ lo detiene). Con el campo vacío, muestra lo que dice la línea. El botón del ojo alterna entre **Fuera** (desde detrás y arriba: la línea sube por la pantalla y se estrecha a lo lejos, con una bruma tenue que la prolonga hacia el infinito) y **Dentro** (en el túnel: las celdas pasan justo por debajo de ti y suben hasta un punto en la distancia). Mantén pulsada una celda para quitarla, y la línea se cierra tras ella: es unidimensional.

La **tecla de pulso** redonda junto al mensaje es un manipulador telegráfico: toca para un punto, mantén para una raya; una pausa corta empieza una letra nueva y una más larga, una palabra nueva. Lo que teclees aparece en el campo del mensaje como puntos y rayas (· –), un espacio entre letras y / entre palabras; edítalos ahí como cualquier texto (también sirven . y -). El pequeño pergamino junto a Enviar abre el glosario de **código Morse**: cada letra, cifra y signo con sus puntos y rayas; toca uno para añadirlo al mensaje. Mientras la señal avanza, el mensaje se lee arriba de la pantalla, letra a letra, a medida que llega. Dentro, arrastra para mirar alrededor, pellizca (o desplaza) para avanzar por el túnel y arrastra dos dedos arriba o abajo (o Mayús + desplazar) para subir o bajar; al soltar, la vista vuelve suavemente. La tecla aprende tu propio ritmo, así que teclea tan despacio y con tanto cuidado como quieras: lee tus pulsaciones cortas como puntos y las largas como rayas, y compara tus pausas entre sí. Las letras que lee aparecen encima del campo del mensaje mientras tecleas.

**Construir 1D** (Wizard → 1D+ → Construct · Square): construye un cuadrado con celdas 1D, un toque y una línea cada vez. Solo se ve la línea en la que estás; la siguiente celda es naranja: tócala para llenarla. El primer lado sube por la pantalla a lo largo de **X**; en la esquina brilla una unión, se une **Y** (X sigue ahí) y la línea construida se desvanece; sigue en el sentido de las agujas del reloj: por arriba, bajando por el lado opuesto (una segunda línea X, paralela a la primera) y volviendo por abajo. Al cerrarse, el cuadrado entero aparece y se llena, y **Abrir en 2D+** lo lleva a la baldosa cuadrada de 2D+. Mantén pulsado para deshacer la última celda.

Después, el cubo: al cerrarse el cuadrado, la vista gira a tres cuartos y **Z** se eleva desde la esquina de inicio. Construye su primera arista celda a celda; después, cada toque llena una arista entera: las otras tres aristas Z y luego el cuadrado de arriba. Cada arista lleva su nombre numerado (X1, Y2, Z3 …); las terminadas se desvanecen y la recién terminada sigue sólida hasta la siguiente. Al cerrarse, el cubo aparece entero con caras tenues. Al cerrarse, pasa directamente a su red: los cubos de alrededor, tenues, llenando el espacio (el botón de **red** los oculta o muestra). El cuadrado cerrado también tiene su botón de red, que lo muestra llenando el plano. El indicador junto a Wizard muestra hasta dónde has construido (**1D+**, **1D+/2D+**, **1D+/2D+/3D+**, **1D+/2D+/3D+/4D**). **⊘**, junto a Deshacer, borra toda la construcción para empezar de nuevo (Deshacer la recupera), y el selector **Signal | Construct** bajo Wizard cambia entre los dos mundos 1D.

Después, el teseracto: al cerrarse el cubo (**Abrir en 3D+** lo lleva a la pieza Cubo de 3D+), la cuarta dirección **W** sale de la esquina de inicio hacia dentro: W se dibuja como perspectiva, así que el segundo cubo queda más pequeño dentro del primero. Construye su primera arista celda a celda y luego una arista por toque: las otras siete aristas W y después el cubo interior. Al cerrarse pasa directamente a su red; toca para girarlo lentamente a través de W, intercambiando los cubos interior y exterior (vuelve a tocar para pararlo), y **Abrir en 4D** lo lleva al mundo hipercúbico (Z4) de 4D.

**1D+ Construct · Kagome** (Wizard → 1D+ → Construct · Kagome): primero un hexágono, construido a mano, una celda por toque, su primer lado hacia arriba, en el sentido de las agujas del reloj, en un solo trazo. Usa las tres direcciones de Kagome: **X**, luego **Y** en la primera esquina y después **XY** (X e Y juntas, así que sigue siendo 2D). Cerrarlo es el momento 2D: su botón de red muestra el panal y **Abrir en 2D+** lo lleva a la baldosa Hexágono de 2D+. Luego la estrella de Kagome crece a su alrededor, una arista por toque (sin dirección nueva): hasta cada punta y de vuelta a la siguiente esquina, donde se cruzan dos líneas de Kagome. Al cerrarse, la estrella pasa directamente a la red de Kagome y **Abrir en 2D+** la lleva a la baldosa Kagome. Luego **Z**, hacia el pirocloro (Kagome en 3D), con el mismo ritmo: primero las partes hexagonales, el tetraedro truncado sobre tu hexágono (cuatro hexágonos, cuatro triángulos; la primera arista de Z a mano, el resto en dos toques), el momento 3D; después los mini tetraedros sobre sus triángulos, los cuatro de un toque, tres en las puntas de la estrella y uno arriba. Juntos forman un gran tetraedro, la pieza Pirocloro de 3D+: pasa directamente a la red de pirocloro y **Abrir en 3D+** lo lleva allí. Luego **W**, hacia el hiperpirocloro (Kagome en 4D), otra vez con el mismo ritmo: el cuerpo, la 5-celda truncada (cinco tetraedros truncados, uno es el tuyo, y cinco tetraedros; W dibujada como perspectiva, hacia dentro), con la primera arista de W a mano y el resto en dos toques, y luego las extremidades, una pequeña 5-celda sobre cada tetraedro, las cinco de un toque. Juntas, una gran 5-celda: toca para girarla a través de W, y **Abrir en 4D** la lleva al mundo Hiperpirocloro. El cuerpo en cian y las extremidades en oro, hasta el final. Cada familia de Construct (cuadrado, Kagome, RD) guarda su propio progreso.

**1D+ Construct · RD** (Wizard → 1D+ → Construct · RD): la familia insignia. Primero el rombo propio del RD, a mano como el cuadrado, empezando en su esquina de 70,53°, el primer lado hacia arriba, en el sentido de las agujas del reloj: el momento 2D (su botón de red muestra la red rómbica y **Abrir en 2D+** lo lleva al Paralelogramo con el ángulo del rombo del RD). Luego **Z** hacia el dodecaedro rómbico, con la gramática propia del RD: primero el cuerpo, el cubo interior (cian; sus aristas son las diagonales cortas de los rombos; la primera arista de Z a mano, el resto de un toque), después las extremidades, una pirámide sobre cada una de sus seis caras (oro, las seis de un toque), cuyas aristas son las del RD. Se cierra directamente en su red, los doce RD a su alrededor, y **Abrir en 3D+** coloca allí un RD. Luego **W**: el RD es la sombra de la 24-celda, así que abrirlo da la 24-celda. Cada esquina de su cubo se separa en dos, una a cada lado en W, y las dos copias forman el teseracto (el cuerpo: la primera arista de W a mano, las demás esquinas de una vez). Después las extremidades: los seis vértices se unen a ambos lados de un toque, y dos vértices nuevos a lo largo de W en otro. Es la 24-celda, 96 aristas, que gira a través de W, con el RD como su sombra; **Abrir en 4D** la lleva al mundo D4.

**2D+:** baldosas Parallelogram (paralelogramo), Triangle (triángulo), Hexagon (hexágono), Kite (cometa) y Kagome, que se eligen en el panel 2D+ (arriba; abajo en un móvil), cada una con hasta cuatro ángulos de red (90°, 70,53°, 63,43° y 60°).

**Caleidoscopio 2D** (Wizard → 2D+ → Kaleidoscope): un mundo propio. Construye con rombos de Penrose gruesos y delgados, pentágonos, triángulos, hexágonos y cuadrados (todos con la misma longitud de arista, así que cualquier par encaja arista con arista). Decide dónde tocas: cerca de la arista de una pieza, la pieza elegida se coloca al otro lado; en un espacio vacío, cae suelta y se desliza hasta alinearse junto a una compañera. Las piezas nunca se solapan. Los espejos reflejan tu construcción como un caleidoscopio: el botón de espejo cambia entre un Anillo (○, 1 a 12 espejos) y un triángulo de tres (△60°, △45°, △30°) que se repite por la pantalla, ajustado con el deslizador; **Girar** rota tu construcción frente a los espejos, **↻** la mantiene girando, **≈** suelta todas las piezas para que formen un nuevo patrón. **Safe** (solo formas de Penrose) mantiene los rombos en la regla de Penrose, así que siempre forman un verdadero teselado de Penrose. **Lattice View** muestra las líneas de los espejos y, en contorno, cada lugar donde cabe la pieza.

**Desarrollos 2D** (Wizard → 2D+ → Nets): de 2D a 3D. Elige un sólido en el panel: las **celdas de Voronoi**, cubo, RD y TO (octaedro truncado), las celdas que llenan el espacio de las redes cúbicas simple, centrada en las caras y centrada en el cuerpo; su desarrollo aparece como un fantasma tenue. Síguelo: toca para construir la primera cara lado a lado, en celdas 1D, y después cada toque construye la cara siguiente. Cuando el desarrollo está completo, toca y se pliega en el sólido (el indicador muestra **2D+/3D+**); el **deslizador de plegado** lo pliega y despliega a mano, y **Abrir en 3D+** lleva allí el sólido terminado. Mantén pulsado para deshacer una cara (o desplegar). Cada sólido guarda su propio progreso. Los **sólidos platónicos** son un segundo grupo: tetraedro, octaedro, icosaedro, dodecaedro y el cubo. **Abrir en 3D+** aparece para los sólidos que el mundo 3D+ tiene como piezas (cubo, RD, TO, octaedro). **⊘** junto a Undo borra el desarrollo en el que estás. El grupo **celda Euclid–Kepler–Pacioli** tiene cada pieza de esa celda, de dentro hacia fuera: los tres rectángulos áureos de Pacioli, el icosaedro, el octaedro, los dos tetraedros de la stella octangula, el cubo, una punta de la gran estrella y el dodecaedro. Cada una se pliega en su lugar real junto a las ya plegadas, y **Siguiente** pasa a la próxima pieza. **Celda completa** muestra juntas todas las que has plegado; toca para envolverlas capa a capa, de dentro hacia fuera, o arrastra el deslizador.

**Paint** (todas las dimensiones salvo 1D+): el pincel de la fila inferior, o el interruptor Paint en el centro de la rueda de colores, cambia el color de las piezas ya colocadas. Actívalo, elige un color y toca una pieza; desactívalo para volver a construir. Pasa los colores a Pick, así cada pieza muestra su propio color. (Shells y Golden Rhombohedra colorean sus piezas por banda y tipo, así que ahí no hay Paint; tampoco en Nets.) Cuando el hueco de la fila inferior lo ocupa un cambio de unión (Rhombohedra y Pyrochlore en 3D+), el pincel queda justo encima; en 4D está en el panel 4D.

**3D+:**

| Red | Piezas |
|---|---|
| FCC | Rhombic Dodecahedron (RD, dodecaedro rómbico), Hemi RD, Hourglass, RD Quarter, Cube, Pyramid |
| DICTO FCC | DICTO RD: el dodecaedro rómbico sesgado de DICTO con varillas azules de Zometool (seis rombos de 60° y seis de 72°, volumen φ² con arista 1), en un FCC cizallado; DICTO Blocks: sus cuatro bloques, dos bloques de rombos y dos romboedros aplanados, cara con cara |
| RD Dual | Cuboctahedron (CO, cuboctaedro), Octahedron (octaedro) |
| BCC | Truncated Octahedron (TO, octaedro truncado) |
| BCC Interstitial | Flattened Octahedron, Disphenoid |
| Elongated Dodecahedron | Elongated Dodecahedron (ED, dodecaedro alargado) |
| Hexagonal | Hex Prism (prisma hexagonal); DICTO Hex Prism: el prisma de hexágonos regulares de DICTO, inclinado 20,9° (dos cuadrados y cuatro rombos de 72° en sus lados, volumen 3φ/2 con arista 1), con cada capa desplazada a lo largo de su inclinación |
| Rhombohedral | Rhombohedra (romboedros) |
| Pyrochlore (Kagome 3D) | Truncated Tetrahedron (tetraedro truncado; los tetraedros entre ellos se añaden solos) |
| Sunstar Lattice | Un mundo propio: dodecaedros regulares en su empaquetado reticular más denso y, en cada hueco, un Dogstar (estrella de 8 puntas con aristas solo áureas); un dodecaedro rodeado de sus Dogstars es un Sunstar (nombres de DICTO). Toca una cara para añadir la pieza del otro lado; **Vista** muestra ambos, solo los Dogstars (comparten vértices, cuatro en cada esquina del cubo, como Pyrochlore) o solo los dodecaedros; **Ejes quíntuples** superpone los ejes de los dodecaedros; **Sunstars enteros** añade y quita un dodecaedro junto con los 6 Dogstars de sus caras (un Dogstar que otro Sunstar aún tiene se queda). **Dogstars en cada celda** pone también un Dogstar dentro de cada dodecaedro (cabe entero: Dogstar dentro de la stella, dentro del cubo, dentro del dodecaedro), con los dodecaedros transparentes, así que los Dogstars llenan todas las celdas y ocho puntas se juntan en cada esquina del cubo. **Cadena anidada** muestra dentro de cada dodecaedro la cadena que encaja exactamente en él, cada paso tocándose: su gran estrella (el gran dodecaedro estrellado del núcleo del Dogstar), dentro un Sunstar entero 1/φ³ de su tamaño, dentro de su dodecaedro la siguiente gran estrella y un Sunstar 1/φ⁶. |
| Stella–Jewel Lattice | Un mundo propio: Dragon Jewels (el nombre que DICTO dio al sólido de las ventanas del EKP: el dodecaedro con las stellas octangulas de sus seis vecinos de cara talladas, 12 rombos gruesos de Penrose) en las celdas pares y stellas octangulas en las impares, llenando el espacio. Toca una cara para añadir la pieza del otro lado; **Vista** muestra ambos o solo los Dragon Jewels (unidos cara a cara por sus 12 rombos, con huecos en forma de stella); **Ejes quíntuples** muestra los ejes de cada Dragon Jewel y los cinco lugares posibles de cada ventana, resaltado el que elige el cubo |

**4D:**

| Mundo | Piezas |
|---|---|
| Z4 | Tesseract (el cubo en 4D) |
| D4 | 24-cell, 16-cell |
| Hyper-pyrochlore (Kagome 4D) | 5-cell, Truncated 5-cell, Bitruncated 5-cell |

Prueba esto en FCC: coloca seis Pyramid para formar un Cube. Después añade una Pyramid en cada cara del Cube y se convierte en un RD. Quita esas seis de nuevo para volver a un Cube.

**RD Quarter** es uno de los 4 romboedros en los que se divide un RD. Toca un RD cerca de una de sus esquinas para rellenar esa esquina y luego toca una cara de un cuarto para colocar su imagen especular al otro lado de esa cara. La imagen especular siempre cae de nuevo en la red RD, así que puedes hacer crecer los cuartos de celda en celda. Para una red libre de romboedros con Copy (copia) además de Mirror (espejo), usa **Rhombohedra**.

### Colores

Las piezas se colorean según el ajuste **Colores** (en Ajustes): **Cian** (todas cian, por defecto), **Tipo** (cada tipo de pieza con su color, editable en la lista que aparece) o **Elegir** (cada pieza conserva el color con que se colocó). Toca el **botón de color** (abajo a la izquierda) para elegir entre 15 colores: en Cian cambia a Elegir y en Tipo cambia el color del tipo de pieza que colocas. Cambiar de modo nunca pierde los colores con que se colocaron las piezas.

## Observa tu construcción

| Vista | Qué muestra | Cómo activarla |
|---|---|---|
| World View | Color, Translúcido o Esqueleto | Toca el botón World View para alternar |
| Lattice View | Tu construcción y todos los huecos libres un paso más allá, para la pieza elegida | Toca el botón Lattice View (o ⬡ en la rueda de la esquina) para recorrer las piezas |
| X-Ray | Un corte. Arrastra el plano a través de la estructura, también en diagonal | Botón X-Ray (⛶) |
| Spherical | Toca para cambiar: cada pieza como una esfera (los RD enteros tocan a sus doce vecinos), luego los huecos entre RD enteros (octaédricos en oro, tetraédricos en rosa, solo donde están cerrados) con todas las esferas tenues. Un control deslizante da tamaño a todas las esferas (se detiene en el tamaño propio de cada forma; menos = separadas, más = solapadas). Con Lattice View activo, cada hueco libre de la red se ve como una esfera tenue. Solo una vista | Botón Spherical (◯): apagado → esferas → huecos |
| Duality | El teselado aperiódico que proyecta esta estructura cristalina | Botón Duality (◐) |
| Dualize | Intercambia FCC y BCC | Ajustes → Dualize Preview |

Ajustes también tiene una **Vista de sección**: elige un eje, arrastra el deslizador para mover el corte y marca **Invertir** para ver el otro lado.

## Entrar en 4D

1. Elige **4D** en el selector de dimensión, en el Wizard o en **Menú → Change Dimension**.
2. Elige un mundo: Tesseract (Z4), 24-cell o 16-cell (D4), o una pieza de Hyper-pyrochlore.
3. Construye como en 3D+: toca una cara para añadir la celda 4D vecina.

Aparece un panel 4D en la parte inferior de la pantalla.

- **Corte / Proyección** cambia cómo ves el 4D. **Corte** (por defecto) muestra la sección 3D a la profundidad actual. **Proyección** muestra celdas 4D completas como sombras; toca una cara de una sombra para construir a través de ella. En Proyección también puedes alternar entre **Paralela** y **Perspectiva**.
- **El deslizador** hace lo que indica el botón que tiene encima: **Profundidad W** mueve el corte a través de la cuarta dimensión, y **XW**, **YW** y **ZW** lo giran hacia la cuarta dimensión. Se ajusta en posiciones útiles. La marcada **FCC** es el mundo RD 3D normal, y la marcada **Pyrochlore** es el mundo Pyrochlore 3D.
- **Restablecer 4D** devuelve todo a la posición inicial.
- **Paint** (el pincel) aparece en este panel con las piezas 24-celda, 16-celda e hiperpirocloro, cuyo cambio de unión ocupa el hueco de pintura de la fila inferior.
- **Info** abre un panel que muestra el mundo y la pieza que colocas, lo que has construido, dónde está el corte (Profundidad W o Proyección), los ángulos de giro XW/YW/ZW y las coordenadas 4D del centro de la última celda que tocaste o colocaste.

## Pasar a 5D y 6D

5D y 6D son **cuasicristales**: una red cúbica de cinco o seis dimensiones, cortada a través del espacio 3D. Las piezas llenan el espacio sin huecos, pero el patrón nunca se repite.

- **6D** es el cuasicristal icosaédrico. Sus piezas son dos romboedros áureos: **prolate** (alargado) y **oblate** (achatado).
- **5D** es el cuasicristal decagonal: capas del teselado de Penrose, hechas de prismas rómbicos **thick** (gruesos) y **thin** (finos).

1. Elige **5D** o **6D** en el selector de dimensión, el Wizard o **Menú → Change Dimension**.
2. Toca el contorno cian para colocar la primera pieza y luego toca una cara para añadir la pieza vecina. En 5D, las caras de arriba y de abajo añaden una capa encima o debajo.

Tú no eliges la forma: el teselado decide qué pieza va en cada hueco.

Aparece un panel en la parte inferior de la pantalla.

- **El deslizador** hace lo que indica el botón que tiene encima. **Fasón 1**, **Fasón 2** y **Fasón 3** (solo en 6D) desplazan el corte de lado a través de las dimensiones ocultas: las piezas cambian, y unas salen del corte mientras otras entran. Las piezas que el corte oculta no se borran; vuelve atrás y reaparecen. **Aproximante** recorre cristales periódicos (1/1, 2/1, 3/2, 5/3, 8/5 …) cada vez más cercanos al cuasicristal verdadero, **τ**, en el extremo derecho.
- **Construir / Ventana** cambia a la **vista de Ventana**, que muestra las dimensiones ocultas. La ventana es un triacontaedro rómbico en 6D y un conjunto de pentágonos en 5D. Cada vértice de tus piezas es un punto: blanco dentro de la ventana (el vértice está en el corte) y rojo fuera. Mueve un deslizador de fasón y verás cómo los puntos cruzan el borde de la ventana mientras las piezas aparecen y desaparecen.
- **Restablecer 5D** / **Restablecer 6D** devuelve el deslizador al inicio: fasón 0 en τ.
- **Info** muestra el mundo, lo que has construido, cuántas piezas están en el corte y cuántas oculta, los ajustes de fasón y aproximante y, en la vista de Ventana, cuántos vértices quedan dentro. También lista lo que has invocado: toca un elemento para volver a sus ajustes.

**Lattice View** muestra como fantasmas el teselado de alrededor, un paso más allá, y cambia mientras deslizas un fasón. **World View** funciona como en 3D+.

### El Catálogo

En 5D y 6D, el botón de abajo a la izquierda abre el **Catálogo** (las tarjetas 5D y 6D del Wizard también lo abren). Tiene cuatro tipos de elementos:

- **Zonoedros:** formas hechas con las propias piezas del teselado, desde un solo romboedro hasta el triacontaedro rómbico, y en 5D prismas rómbicos, hexagonales, octogonales y decagonales.
- **Politopos:** las sombras de politopos de dimensión superior, como el 6-ortoplex, cuya sombra es un icosaedro. Una sombra queda sobre el teselado sin bloquear piezas, y sus vértices se iluminan donde están en el corte. Mantén pulsada una para quitarla.
- **Puentes:** hiperprismas, politopos llevados un paso a través de una dimensión más, como el prisma del 5-ortoplex. Igual que los politopos, aparecen como sombras.
- **Estrellas de vértice:** todas las formas en que las piezas se encuentran en un vértice (7 en 5D, 24 en 6D), también con uno o dos anillos de piezas alrededor. Toca un encabezado para abrir su lista.

Cada elemento tiene un número de serie. Escríbelo en la casilla y toca **Invocar** para ir directamente a él.

Al elegir un elemento, aparece un **contorno dorado** donde realmente se da en tu cuasicristal. Toca tu construcción para llevar el contorno al sitio más cercano, y toca el contorno para colocarlo como piezas normales. Si el elemento pertenece a otro aproximante, el deslizador se desplaza allí primero. **Cancelar invocación** lo detiene. Un **Undo** lo deshace y devuelve el deslizador a donde estaba.

**Conectar** (en el panel, cuando tienes dos piezas) une dos elementos: toca una pieza de cada uno y se coloca como un conector la cadena más corta de baldosas reales entre ellos. Un **Undo** lo deshace.

## Capas

Un mundo 3D para construir **envolventes**: capas de dodecaedros rómbicos (RD), cada capa con su banda de color, contadas desde tu primera pieza. Elígelo en la pantalla 3D+ del Wizard.

- **+ Capa** llena la siguiente capa y **− Capa** quita la más exterior. **Envolvente** elige cómo se cuentan: **Pasos** (un cuboctaedro: 13, 55, 147 … piezas), **Distancia** (hacia una esfera) o una forma objetivo (tetraedro, cubo, octaedro, RD u octaedro truncado). **Recortar** deja la envolvente exactamente plana con esa forma.
- Modo **Fragmentar**: toca una pieza y elige una **División** (mitades, tercios, cuartos, sextos, octavos, doceavos, dieciseisavos, veinticuatroavos o cuarentaiochoavos); **Girar** cambia el corte. En el modo Construir, el menú **Pieza** coloca también partes sueltas.
- **Escala** construye con RD más grandes (×2 a ×4). **Fusionar ×2 / ×3** sobre una pieza elegida muestra el contorno del RD grande, y **Confirmar fusión** lo pone en su lugar; el menú División lo vuelve a abrir.
- **Info** muestra el diagrama de anillos: toca un anillo para ocultar o mostrar esa capa y ver el interior, quita cualquier capa y elige los colores de las bandas.

## Romboedros áureos

Un mundo 3D con las dos piezas del teselado de Penrose en 3D. Elígelo en la pantalla 3D+ del Wizard. Toca el contorno cian y luego una cara para añadir la pieza **Alargada** o **Achatada** elegida en el menú Pieza. El **Control Penrose** pinta de verde las piezas que pertenecen al verdadero teselado aperiódico y de rojo las que se han desviado; Lattice View muestra el teselado verdadero alrededor, y tocar un fantasma lo coloca.

Los mismos dos bloques son las piezas de **RHOMBITURE** de DICTO, un sistema de armazón extraíble para tallar y modelar: [doi:10.5281/zenodo.23173896](https://doi.org/10.5281/zenodo.23173896).

## Euclid–Kepler–Pacioli Cell Network (EKP)

Un mundo 3D sobre una única celda exacta. Pon los tejados de Euclides sobre un cubo y obtienes un dodecaedro regular; dobla los tejados hacia dentro por las caras del cubo y forman un icosaedro regular. Las aristas del cubo, el dodecaedro y el icosaedro están en razón φ² : φ : 1. Elígelo en la pantalla 3D+ del Asistente. Toca el contorno cian, elige una **Pieza** (cubo, dodecaedro, icosaedro, gran dodecaedro estrellado, octaedro, stella octangula o rectángulos áureos) y toca un sólido: la pieza va a esa celda si aún no está, si no a la celda siguiente al otro lado de la cara tocada. Los sólidos pequeños quedan dentro de los grandes, así que usa **Rayos X** o la vista translúcida para verlos. **Vista** redibuja la misma construcción: dos sólidos alternando según un **Patrón**, un damero o la superficie exterior fusionada de todos los dodecaedros. **Vértices** marca las esquinas del cubo o todos los vértices, e **Info** muestra el grupo espacial (Pm-3 para la celda; cada patrón tiene el suyo). Al crecer dodecaedros por sus caras solo se alcanzan celdas del mismo color en el patrón diagonal; crece por una cara de cubo para llegar a las demás. **Girar cubos impares** gira cada pieza de cada cubo impar un cuarto de vuelta alrededor del eje vertical, de modo que los cubos vecinos alternan. No se muestra en la superficie exterior fusionada.

Tres de esas piezas completan un homenaje a Kepler: el **octaedro** sobre los centros de las caras del cubo, con los vértices del icosaedro en sus aristas en la sección áurea; la **stella octangula**, dos tetraedros regulares en vértices alternos del cubo que se solapan en ese octaedro; y los tres **rectángulos áureos** entrelazados de Pacioli, que son justo donde se encuentran las cumbreras de los tejados de las celdas vecinas. Juntos, los cinco sólidos platónicos se anidan en una celda: icosaedro, octaedro, tetraedros, cubo, dodecaedro.

La celda de este mundo es la **celda Euclid–Kepler–Pacioli**, y los grandes dodecaedros estrellados e icosaedros que solo se tocan por los vértices forman la **red Euclid–Kepler–Pacioli**, ambas de DICTO. Cítalas como [doi:10.5281/zenodo.23173809](https://doi.org/10.5281/zenodo.23173809).

## RHOMBIS

RHOMBIS es un rompecabezas 3D hecho con las mismas piezas: llena la forma objetivo con las piezas de la bandeja. Ábrelo desde la pantalla de bienvenida (**Prueba RHOMBIS**). Toca una pieza de la bandeja y luego un hueco iluminado para colocarla; algunas piezas se voltean si las tocas otra vez. **Etapas** muestra todos los rompecabezas por secciones y marca los que has resuelto. **← Rhombiverse** te trae de vuelta aquí.

## Guarda tu trabajo

Tu mundo se guarda automáticamente en este navegador, en todas las dimensiones, después de cada cambio. Vuelve a aparecer cuando abres el sitio en el mismo dispositivo y navegador.

En **Ajustes**:

- **Exportar Mundo** guarda todo (cada red 3D, tus baldosas 2D y tus construcciones 4D, 5D y 6D) en un solo archivo. Úsalo como copia de seguridad o para llevar tu mundo a otro dispositivo.
- **Importar Mundo** abre un archivo exportado. **Undo** deshace una importación.
- **Clear World** (⊘ en la rueda de la esquina) empieza de nuevo con un mundo vacío. Undo puede recuperarlo.

## Aprende las matemáticas

- **Almanac:** las matemáticas y la geometría detrás de cada pieza y cada red. Ábrelo desde Menú → Almanac.
- **What's New** muestra los cambios recientes.

---

# Referencia de controles

## Botones en pantalla

| Control | Qué hace |
|---|---|
| Wizard (arriba a la izquierda) | Recorre dimensiones y redes, cada una con sus piezas. La etiqueta naranja grande a su lado muestra la dimensión en la que estás |
| Shape (abajo a la izquierda) | La pieza que colocas. Tócalo para cambiarla |
| Color (abajo a la izquierda) | Color de construcción. Tócalo para cambiarlo |
| Lattice View | Alterna entre Off y una vista para cada pieza |
| Cambio de unión | Solo aparece con piezas que se unen de más de una forma (Rhombohedra: Copy / Mirror; Pyrochlore: tetraedro pequeño / entero; 24-celda / 16-celda; las tres 5-celdas del hiperpirocloro): toca para cambiar |
| Undo (↶, abajo a la derecha) | Toca para deshacer un paso en la dimensión actual. Mantén pulsado para retroceder más |
| Paint (pincel) | Cambia el color de piezas ya colocadas: actívalo, elige un color y toca una pieza. Ocupa el lugar del cambio de unión en la fila inferior; cuando ese cambio hace falta, queda justo encima (en 4D, en el panel 4D) |
| Signal \| Construct (bajo Wizard, solo 1D+) | Cambia entre los dos mundos 1D+ |
| ⊘ Borrar (junto a Undo, 1D+ y Nets) | Borra el mundo 1D+ en el que estás para empezar de nuevo (en Nets, el desarrollo en el que estás); Undo lo recupera |
| Menú | Abre la rueda del menú (teclado: Tab o Espacio) |

## Rueda de la esquina

Arrastra la pequeña rueda de la esquina para girarla. Toca una cara para usarla.

| Símbolo | Control |
|---|---|
| ⚙ | Ajustes |
| ⛶ | X-Ray |
| ◐ | Duality |
| ⬡ | Lattice View |
| ◇ | Menú |
| ⊘ | Clear World |
| ↻ | Reload (úsalo si algo parece atascado) |
| ◯ | Spherical (apagado → esferas → huecos) |
| — | World View |

## Rueda del menú

El menú es un dodecaedro rómbico. Cada cara es una sección: toca una cara para abrirla y usa **Home** para volver. **Almanac** está siempre en una cara superior.

| Sección | Contenido |
|---|---|
| Home | Piece, Color, Change Dimension |
| Piece | RD family, Cube, Pyramid, TO, Flattened Octahedron, Disphenoid, CO, Octahedron |
| RD family | RD, Hemi RD, Hourglass, RD Quarter, ED, Hex Prism, Rhombohedra, Pyrochlore |
| Change Dimension | 1D+, 2D+, 3D+, 4D, 5D, 6D |
| Piece (en 4D) | Tesseract, 24-cell, 16-cell, 5-cell, Truncated 5-cell, Bitruncated 5-cell |

## Ajustes

| Ajuste | Qué hace |
|---|---|
| Sensibilidad de la vista | Velocidad de giro de la cámara |
| Invertir eje Y | Invierte el arrastre vertical |
| Campo de visión | Amplitud del objetivo de la cámara |
| Calidad gráfica | Baja, Media o Alta |
| Mostrar medidor de FPS | Contador de fotogramas por segundo |
| Volumen | Nivel de sonido |
| Idioma | English, 日本語, Español, Français, 한국어, 中文, Русский (también con el selector 🌐 de la parte superior de la pantalla de bienvenida y de esta guía) |
| Colores | Cian, Tipo o Elegir: cómo se colorean las piezas |
| Vista de sección, eje, posición, Invertir | Corte a lo largo de un eje |
| Dualize Preview | Modo de construcción especial |
| Exportar Mundo, Importar Mundo | Hacer copia y restaurar (todas las dimensiones) |

## Teclado y ratón

| Entrada | Acción |
|---|---|
| Clic izquierdo en una cara | Añadir una pieza |
| Clic derecho en una pieza | Quitarla |
| Arrastrar con el botón izquierdo | Girar la cámara |
| Rueda del ratón | Zoom |
| Tab o Espacio | Abrir la rueda del menú |
| Escape | Cerrar el menú, el Wizard o el Almanac |
| Enter | Entrar desde la pantalla de bienvenida |

## Táctil

| Gesto | Acción |
|---|---|
| Tocar una cara | Añadir una pieza |
| Mantener pulsada una pieza | Quitarla |
| Arrastrar con un dedo | Girar la cámara |
| Pellizcar | Zoom |
| Arrastrar con dos dedos | Desplazar |
