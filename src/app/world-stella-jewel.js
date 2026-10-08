// The Stella–Jewel Lattice (direct request, 2026-10-08): Dragon Jewels (DJ, DICTO's name for the
// windows solid, DISCOVERIES #10) on the even cells and stella octangulas on the odd cells, filling
// space (study 10b). Views: both, or the Dragon Jewels alone (they meet face to face on all 12
// rhombi, leaving stella-shaped holes). The five-fold overlay adds the five window positions on each
// face, the cube's choice bright. The world itself is world-pair-lattice.js. Ported from
// Kaleidohedra (direct request, 2026-10-08), beside the Sunstar Lattice.
import {
  ekpWindowsSolid, roofFoldSolids, ROOF_FOLD_COLOURS as C, insideDragonJewel, insideStella, fiveWindowPositions,
} from '../geometry-extensions/roof-fold.js';
import { createPairLatticeWorld } from './world-pair-lattice.js';

export function createStellaJewelWorld(opts) {
  const DJ = ekpWindowsSolid();
  const five = fiveWindowPositions();
  return createPairLatticeWorld(opts, {
    storageKey: 'rhombiverse-stella-jewel',
    panelId: 'worldstellajewel-panel',
    minimiser: 'stella-jewel',
    strings: 'dj',
    modes: [{ id: 'both', even: true, odd: true }, { id: 'jewels', even: true, odd: false }],
    evenFaces: [...DJ.rhombi.map((f) => [f, C.dodeca]), ...DJ.walls.map((f) => [f, 0xb8892a])],
    oddFaces: roofFoldSolids().stella.faces.map((f) => [f, C.stella]),
    insideEven: insideDragonJewel,
    insideOdd: insideStella,
    // Across a face to the stella; Dragon Jewel to Dragon Jewel across the rhombi.
    touches: (s, d) => Math.abs(d[0]) + Math.abs(d[1]) + Math.abs(d[2]) === 1 || (((s[0] + s[1] + s[2]) % 2) + 2) % 2 === 0,
    overlay: { faint: five.filter((x) => !x.chosen).map((x) => x.rhombus), bright: five.filter((x) => x.chosen).map((x) => x.rhombus) },
    brightColor: C.dodeca,
    holePrompt: true,
  });
}
