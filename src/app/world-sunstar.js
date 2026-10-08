// The Sunstar Lattice (direct request, 2026-10-08; DICTO's names): regular dodecahedra on the even
// cells, their densest lattice packing, and on the odd cells the holes they leave, each exactly a
// Dogstar (an 8-pointed partial stellation of a dodecahedron 1/phi^3 their size). A dodecahedron with
// the Dogstars round it is a Sunstar, the sun with its sun dogs. Views: both, the Dogstars alone (they
// share corners, four at each cube corner: a Kagome-style 3D lattice), or the dodecahedra alone. The
// world itself is world-pair-lattice.js. Ported from Kaleidohedra; here it sits beside Pyrochlore,
// the other corner-sharing lattice (direct request, 2026-10-08).
import { roofFoldSolids, ROOF_FOLD_COLOURS as C, dogstarSolid, insideDodecahedron, insideDogstar } from '../geometry-extensions/roof-fold.js';
import { createPairLatticeWorld } from './world-pair-lattice.js';

export function createSunstarWorld(opts) {
  return createPairLatticeWorld(opts, {
    storageKey: 'kaleidohedra-sunstar',
    panelId: 'worldsunstar-panel',
    minimiser: 'sunstar',
    strings: 'ss',
    modes: [{ id: 'both', even: true, odd: true }, { id: 'dogstars', even: false, odd: true }, { id: 'dodecas', even: true, odd: false }],
    evenFaces: roofFoldSolids().dodeca.faces.map((f) => [f, C.dodeca]),
    oddFaces: dogstarSolid().map((f) => [f, C.star]),
    insideEven: insideDodecahedron,
    insideOdd: insideDogstar,
    // Across a face between the two; dodecahedron to dodecahedron across faces, Dogstar to Dogstar at corners.
    touches: () => true,
    brightColor: C.dodeca,
    holePrompt: false,
  });
}
