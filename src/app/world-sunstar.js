// The Sunstar Lattice (direct request, 2026-10-08; DICTO's names): regular dodecahedra on the even
// cells, their densest lattice packing, and on the odd cells the holes they leave, each exactly a
// Dogstar (an 8-pointed partial stellation of a dodecahedron 1/phi^3 their size). A dodecahedron with
// the Dogstars round it is a Sunstar, the sun with its sun dogs. Views: both, the Dogstars alone (they
// share corners, four at each cube corner: a Kagome-style 3D lattice), or the dodecahedra alone. The
// world itself is world-pair-lattice.js. Ported from Kaleidohedra; here it sits beside Pyrochlore,
// the other corner-sharing lattice (direct request, 2026-10-08).
import { roofFoldSolids, ROOF_FOLD_COLOURS as C, dogstarSolid, insideDodecahedron, insideDogstar, PHI } from '../geometry-extensions/roof-fold.js';
import { createPairLatticeWorld } from './world-pair-lattice.js';

const GREAT_STAR = 0x7cc4ff;
function chain() {
  const k = 1 / PHI ** 3;
  const dodeca = roofFoldSolids().dodeca.faces, star = roofFoldSolids().star.faces, dog = dogstarSolid();
  const at = (faces, s, off = [0, 0, 0]) => faces.map((f) => f.map((p) => p.map((c, i) => (c + off[i]) * s)));
  const axes = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const sunstar = (s) => [...at(dodeca, s).map((f) => [f, C.dodeca]), ...axes.flatMap((d) => at(dog, s, d.map((c) => 2 * c)).map((f) => [f, C.star]))];
  return [
    { faces: at(star, 1).map((f) => [f, GREAT_STAR]), opacity: 0.32 },
    { faces: sunstar(k), opacity: 0.5 },
    { faces: at(star, k).map((f) => [f, GREAT_STAR]), opacity: 0.6 },
    { faces: sunstar(k * k), opacity: 1 },
  ];
}

export function createSunstarWorld(opts) {
  return createPairLatticeWorld(opts, {
    storageKey: 'rhombiverse-sunstar',
    panelId: 'worldsunstar-panel',
    minimiser: 'sunstar',
    strings: 'ss',
    modes: [{ id: 'both', even: true, odd: true }, { id: 'sunstars', even: true, odd: true, grouped: true }, { id: 'every', even: true, odd: true, nested: true }, { id: 'chain', even: true, odd: false, chain: true }, { id: 'dogstars', even: false, odd: true }, { id: 'dodecas', even: true, odd: false }],
    // A Sunstar: the dodecahedron and the 6 Dogstars on its faces (direct decision, 2026-10-08:
    // the 8 at its corners only touch it at a point).
    group: (e) => [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].map((d) => e.map((c, i) => c + d[i])),
    evenFaces: roofFoldSolids().dodeca.faces.map((f) => [f, C.dodeca]),
    oddFaces: dogstarSolid().map((f) => [f, C.star]),
    // Dogstars in every cell (direct request, 2026-10-08): a Dogstar fits wholly inside each
    // dodecahedron too (Dogstar inside stella inside cube inside dodecahedron), so Dogstars fill
    // every cell, eight tips meeting at each cube corner.
    nestedFaces: dogstarSolid().map((f) => [f, C.star]),
    // The Star Chain Reaction (DICTO's name, 2026-10-08: "like solar radiation"), each step touching: inside the
    // dodecahedron its great star (the great stellated dodecahedron of the Dogstar's 1/phi^3 core),
    // inside that a whole Sunstar 1/phi^3 the size, inside its dodecahedron the next great star, and
    // the next Sunstar at 1/phi^6.
    chainLayers: chain(),
    insideEven: insideDodecahedron,
    insideOdd: insideDogstar,
    // Across a face between the two; dodecahedron to dodecahedron across faces, Dogstar to Dogstar at corners.
    touches: () => true,
    brightColor: C.dodeca,
    holePrompt: false,
  });
}
