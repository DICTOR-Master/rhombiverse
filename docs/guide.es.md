# Guía del usuario de Rhombiverse

Rhombiverse y su gemelo, [Polyhedraverse](https://polyhedraverse.vercel.app), son dos maneras de mirar la misma geometría. Rhombiverse es el **paisaje**: las propias redes, que se extienden en todas direcciones. Polyhedraverse es la **galería de retratos**: las formas que viven en esas redes, de una en una y de cerca.

Aquí cada pieza llena el espacio a la perfección sobre una red cristalina real, así que solo puedes poner una pieza donde la red tenga sitio para ella. Toca para añadir una pieza, mantén pulsado para quitarla y observa lo que has construido con distintas vistas, de 2D a 6D.

La primera parte de esta guía recorre las tareas habituales. La segunda enumera todos los controles.

Los nombres de los botones aparecen tal como se ven en la aplicación (los que la aplicación aún no traduce siguen en inglés).

## Primeros pasos

### Elige una dimensión

Después de **ENTER** se abre el selector de dimensión: una figura que gira despacio y cuyas caras son **2D**, **3D**, **4D**, **5D** y **6D**, cada una con un icono. Pasa el cursor por una cara (o mantenla pulsada en una pantalla táctil) para ver su nombre y toca la que quieras. Arrastra para girar la figura y traer otras caras al frente.

Puedes cambiar más tarde desde **Menú → Change Dimension**, o desde el **Wizard** (arriba a la izquierda), que muestra todas las redes de cada dimensión con sus piezas como estructuras de alambre giratorias.

### Coloca tu primera pieza

Un mundo vacío muestra un **contorno cian** donde va la primera pieza. Tócalo. Después toca una cara de cualquier pieza (un lado, en 2D) para añadir una vecina al otro lado.

Se construye pieza a pieza. En 3D empiezas con el **RD** (dodecaedro rómbico) seleccionado. La pieza que estás colocando aparece en el botón **Shape**, abajo a la izquierda; tócalo para elegir otra.

### Quita una pieza

- **Móvil o tableta:** mantén pulsada la pieza.
- **Ratón:** haz clic derecho sobre la pieza. El clic derecho quita piezas en cualquier modo.

Para deshacer tu último cambio, toca **Undo** (↶, abajo a la derecha). Mantenlo pulsado para retroceder varios pasos a la vez. Cada dimensión tiene su propio historial, así que deshacer en 2D nunca afecta a lo que has construido en 3D o 4D.

### Mueve la cámara

- **Girar:** arrastra con un dedo, o con el botón izquierdo del ratón.
- **Zoom:** pellizca, o usa la rueda del ratón.
- **Desplazar:** arrastra con dos dedos.

## Qué construir

### Las piezas, por red

**2D:** baldosas Parallelogram (paralelogramo), Triangle (triángulo), Hexagon (hexágono), Kite (cometa) y Kagome, que se eligen en el panel superior, cada una con hasta cuatro ángulos de red (90°, 70,53°, 63,43° y 60°).

**Caleidoscopio 2D** (Wizard → 2D → Kaleidoscope): un mundo propio. Construye con rombos de Penrose gruesos y finos, pentágonos, triángulos, hexágonos y cuadrados (todos con el mismo lado, así que cualquier par encaja lado con lado). Unir añade la pieza al otro lado del borde que tocas; Suelto la deja caer donde tocas y la desliza hasta encajar junto a una pareja. Los espejos convierten tu construcción en un caleidoscopio: un Anillo de 1 a 12 espejos, o un triángulo de tres (△60°, △45°, △30°) que se repite por la pantalla, ajustado con el deslizador. Girar rota tu construcción frente a los espejos, Rodar la mantiene girando, Agitar suelta todas las piezas y las deja asentarse en un nuevo dibujo. Seguro mantiene los rombos dentro de la regla de encaje de Penrose, así que siempre forman un verdadero teselado de Penrose; Guías muestra las líneas de los espejos; Lattice View muestra cada sitio donde cabe la pieza. En 2D, el botón del pincel (Paint) cambia el color de las piezas ya colocadas: actívalo, elige un color y toca una pieza.

**3D:**

| Red | Piezas |
|---|---|
| FCC | Rhombic Dodecahedron (RD, dodecaedro rómbico), Hemi RD, Hourglass, RD Quarter, Cube, Pyramid |
| RD Dual | Cuboctahedron (CO, cuboctaedro), Octahedron (octaedro) |
| BCC | Truncated Octahedron (TO, octaedro truncado) |
| BCC Interstitial | Flattened Octahedron, Disphenoid |
| Elongated Dodecahedron | Elongated Dodecahedron (ED, dodecaedro alargado) |
| Hexagonal | Hex Prism (prisma hexagonal) |
| Rhombohedral | Rhombohedra (romboedros) |
| Pyrochlore (Kagome 3D) | Truncated Tetrahedron (tetraedro truncado; los tetraedros entre ellos se añaden solos) |

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
| Lattice View | Tu construcción y todos los huecos libres un paso más allá, para la pieza elegida | Toca el botón Lattice View para recorrer las piezas |
| X-Ray | Un corte. Arrastra el plano a través de la estructura, también en diagonal | Botón X-Ray (⛶) |
| Spherical | Cada pieza como una casi-esfera | Botón Spherical (◯) |
| Duality | El teselado aperiódico que proyecta esta estructura cristalina | Botón Duality (◐) |
| BCC Lattice | La red cúbica centrada en el cuerpo, anidada dentro de la FCC | Botón BCC Lattice (⬡) |
| Dualize | Intercambia FCC y BCC | Ajustes → Dualize Preview |

Ajustes también tiene una **Vista de sección**: elige un eje, arrastra el deslizador para mover el corte y marca **Invertir** para ver el otro lado.

## Entrar en 4D

1. Elige **4D** en el selector de dimensión, en el Wizard o en **Menú → Change Dimension**.
2. Elige un mundo: Tesseract (Z4), 24-cell o 16-cell (D4), o una pieza de Hyper-pyrochlore.
3. Construye como en 3D: toca una cara para añadir la celda 4D vecina.

Aparece un panel 4D en la parte inferior de la pantalla.

- **Corte / Proyección** cambia cómo ves el 4D. **Corte** (por defecto) muestra la sección 3D a la profundidad actual. **Proyección** muestra celdas 4D completas como sombras; toca una cara de una sombra para construir a través de ella. En Proyección también puedes alternar entre **Paralela** y **Perspectiva**.
- **El deslizador** hace lo que indica el botón que tiene encima: **Profundidad W** mueve el corte a través de la cuarta dimensión, y **XW**, **YW** y **ZW** lo giran hacia la cuarta dimensión. Se ajusta en posiciones útiles. La marcada **FCC** es el mundo RD 3D normal, y la marcada **Pyrochlore** es el mundo Pyrochlore 3D.
- **Restablecer 4D** devuelve todo a la posición inicial.
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

**Lattice View** muestra como fantasmas el teselado de alrededor, un paso más allá, y cambia mientras deslizas un fasón. **World View** funciona como en 3D.

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

Un mundo 3D para construir **envolventes**: capas de dodecaedros rómbicos (RD), cada capa con su banda de color, contadas desde tu primera pieza. Elígelo en la pantalla 3D del Wizard.

- **+ Capa** llena la siguiente capa y **− Capa** quita la más exterior. **Envolvente** elige cómo se cuentan: **Pasos** (un cuboctaedro: 13, 55, 147 … piezas), **Distancia** (hacia una esfera) o una forma objetivo (tetraedro, cubo, octaedro, RD u octaedro truncado). **Recortar** deja la envolvente exactamente plana con esa forma.
- Modo **Fragmentar**: toca una pieza y elige una **División** (mitades, tercios, cuartos, sextos, octavos, doceavos, dieciseisavos, veinticuatroavos o cuarentaiochoavos); **Girar** cambia el corte. En el modo Construir, el menú **Pieza** coloca también partes sueltas.
- **Escala** construye con RD más grandes (×2 a ×4). **Fusionar ×2 / ×3** sobre una pieza elegida muestra el contorno del RD grande, y **Confirmar fusión** lo pone en su lugar; el menú División lo vuelve a abrir.
- **Info** muestra el diagrama de anillos: toca un anillo para ocultar o mostrar esa capa y ver el interior, quita cualquier capa y elige los colores de las bandas.

## Romboedros áureos

Un mundo 3D con las dos piezas del teselado de Penrose en 3D. Elígelo en la pantalla 3D del Wizard. Toca el contorno cian y luego una cara para añadir la pieza **Alargada** o **Achatada** elegida en el menú Pieza. El **Control Penrose** pinta de verde las piezas que pertenecen al verdadero teselado aperiódico y de rojo las que se han desviado; Lattice View muestra el teselado verdadero alrededor, y tocar un fantasma lo coloca.

## Guarda tu trabajo

Tu mundo se guarda automáticamente en este navegador, en todas las dimensiones, después de cada cambio. Vuelve a aparecer cuando abres el sitio en el mismo dispositivo y navegador.

En **Ajustes**:

- **Exportar Mundo** guarda todo (cada red 3D, tus baldosas 2D y tus construcciones 4D, 5D y 6D) en un solo archivo. Úsalo como copia de seguridad o para llevar tu mundo a otro dispositivo.
- **Importar Mundo** abre un archivo exportado. **Undo** deshace una importación.
- **Mundo Nuevo** empieza de nuevo con un mundo vacío. **Clear World** (⊘) hace lo mismo desde la rueda de la esquina. Undo puede recuperarlo.

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
| Unión de Rhombohedra | Solo aparece con Rhombohedra: alterna entre Copy y Mirror |
| Undo (↶, abajo a la derecha) | Toca para deshacer un paso en la dimensión actual. Mantén pulsado para retroceder más |
| Menú | Abre la rueda del menú (teclado: Tab o Espacio) |

## Rueda de la esquina

Arrastra la pequeña rueda de la esquina para girarla. Toca una cara para usarla.

| Símbolo | Control |
|---|---|
| ⚙ | Ajustes |
| ⛶ | X-Ray |
| ◐ | Duality |
| ⬡ | BCC Lattice |
| ◇ | Menú |
| ⊘ | Clear World |
| ↻ | Reload (úsalo si algo parece atascado) |
| ◯ | Spherical |
| — | World View, Cuboctahedron Build |

## Rueda del menú

El menú es un dodecaedro rómbico. Cada cara es una sección: toca una cara para abrirla y usa **Home** para volver. **Settings** y **Almanac** están siempre en las caras superiores.

| Sección | Contenido |
|---|---|
| Home | Piece, Color, Change Dimension |
| Piece | RD family, Cube, Pyramid, TO, Flattened Octahedron, Disphenoid, CO, Octahedron |
| RD family | RD, Hemi RD, Hourglass, RD Quarter, ED, Hex Prism, Rhombohedra, Pyrochlore |
| Change Dimension | 2D, 3D, 4D, 5D, 6D |

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
| Build Cuboctahedron, Dualize Preview | Modos de construcción especiales |
| Mundo Nuevo, Exportar Mundo, Importar Mundo | Empezar de nuevo, hacer copia y restaurar (todas las dimensiones) |

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
