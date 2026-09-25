# Cómo usar Rhombiverse

Rhombiverse y su gemelo, [Polyhedraverse](https://polyhedraverse.vercel.app), son dos maneras de mirar la misma geometría. Rhombiverse es el **paisaje**: las propias redes, que se extienden en todas direcciones. Polyhedraverse es la **galería de retratos**: las formas que viven en esas redes, de una en una y de cerca.

Aquí cada pieza llena el espacio a la perfección sobre una red cristalina real, así que solo puedes poner una pieza donde la red tenga sitio para ella. Toca para añadir una pieza, mantén pulsado para quitarla y observa lo que has construido con distintas vistas, en 2D, 3D o 4D.

La primera parte de esta guía recorre las tareas habituales. La segunda enumera todos los controles.

Los nombres de los botones aparecen tal como se ven en la aplicación (los que la aplicación aún no traduce siguen en inglés).

## Primeros pasos

### Elige una dimensión

Después de **ENTER** se abre el selector de dimensión: una figura que gira despacio y cuyas caras son **2D**, **3D** y **4D**, cada una con un icono. Pasa el cursor por una cara (o mantenla pulsada en una pantalla táctil) para ver su nombre y toca la que quieras. Arrastra para girar la figura y traer otras caras al frente.

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

Toca el **botón de color** (abajo a la izquierda) para elegir entre 14 colores. El color que eliges se queda con la pieza que estás colocando. Con **Asignar color automáticamente según el tipo de pieza** activado (en Ajustes), cada tipo de pieza empieza con su propio color hasta que elijas uno.

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

- **Slice / Projection** cambia cómo ves el 4D. **Slice** (por defecto) muestra la sección 3D a la profundidad actual. **Projection** muestra celdas 4D completas como sombras; toca una cara de una sombra para construir a través de ella. En Projection también puedes alternar entre **Parallel** (paralela) y **Perspective** (perspectiva).
- **El deslizador** hace lo que indica el botón que tiene encima: **W-depth** mueve el corte a través de la cuarta dimensión, y **XW**, **YW** y **ZW** lo giran hacia la cuarta dimensión. Se ajusta en posiciones útiles. La marcada **FCC** es el mundo RD 3D normal, y la marcada **Pyrochlore** es el mundo Pyrochlore 3D.
- **Reset 4D** devuelve todo a la posición inicial.
- **Info** abre un panel que muestra el mundo y la pieza que colocas, lo que has construido, dónde está el corte (W-depth o Projection), los ángulos de giro XW/YW/ZW y las coordenadas 4D del centro de la última celda que tocaste o colocaste.

## Guarda tu trabajo

Tu mundo se guarda automáticamente en este navegador, en todas las dimensiones, después de cada cambio. Vuelve a aparecer cuando abres el sitio en el mismo dispositivo y navegador.

En **Ajustes**:

- **Exportar Mundo** guarda todo (cada red 3D, tus baldosas 2D y tu construcción 4D) en un solo archivo. Úsalo como copia de seguridad o para llevar tu mundo a otro dispositivo.
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
| Wizard (arriba a la izquierda) | Recorre dimensiones y redes, cada una con sus piezas |
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
| Change Dimension | 2D, 3D, 4D |

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
| Asignar color automáticamente según el tipo de pieza | Da a cada tipo de pieza su propio color |
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
