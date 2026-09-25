// World-state persistence backend (localStorage for now, swappable later).
//
const STORAGE_KEY = 'rhombiverse-world';

// The BCC dual-lattice build (geometry-extensions/bcc-build.md) is a
// second, independent world store -- its own localStorage key rather
// than a field merged into the main world's JSON, so none of the many
// existing `saveToLocalStorage(world.toJSON())` call sites (undo, Shared
// World sync, Clear World, ...) need to change to also carry BCC data,
// and none of them can accidentally clobber it either.
export const BCC_STORAGE_KEY = 'rhombiverse-bcc-world';

// Interstitial-lattice build (geometry-extensions/interstitial-lattice.md):
// same reasoning as BCC_STORAGE_KEY above -- a third, independent store,
// own key, untouched by every existing FCC/BCC save/load/clear call site.
export const INTERSTITIAL_STORAGE_KEY = 'rhombiverse-interstitial-world';

// Cuboctahedron build (core/cubocta-build.js): same reasoning again -- a
// fourth independent store, own key, untouched by every existing
// FCC/BCC/interstitial save/load/clear call site.
export const CUBOCTA_STORAGE_KEY = 'rhombiverse-cubocta-world';

// Cuboctahedron gap-octahedron build (core/cubocta-gap-build.js): same
// reasoning again -- a fifth independent store, own key, own coordinate
// frame (offset cube-center addressing, not the main integer grid).
export const CUBOCTA_GAP_STORAGE_KEY = 'rhombiverse-cubocta-gap-world';

// Hemisphere pieces (core/hemisphere-build.js): same reasoning again -- a
// sixth independent store, own key. Half RD/Hourglass ported from Rhombis,
// direct instruction 2026-09-06.
export const HEMISPHERE_STORAGE_KEY = 'rhombiverse-hemisphere-world';

// Elongated Dodecahedron build ('elongdodeca' piece tier, core/build.js's
// own handleElongDodecaClick): same reasoning again -- a seventh
// independent store, own key. Same FCC integer coordinate grid as the
// main World (see geometry-extensions/elongated-dodecahedron.js's own
// header for why), just a different own key so its saves never mix
// with the main world's.
export const ELONGDODECA_STORAGE_KEY = 'rhombiverse-elongdodeca-world';

// Hexagonal Prism build ('hexprism' piece tier): the 5th "adopted family
// member" store -- own axial-hex coordinate frame (geometry-extensions/
// hex-prism.js), genuinely separate from FCC's own grid.
export const HEXPRISM_STORAGE_KEY = 'rhombiverse-hexprism-world';

// 2D tier (Phase 3): one store PER (angle, primitive) combination from
// lattice-2d.js's own LATTICE_2D_COMBINATIONS, each flat layer pinned
// to z=0 in the SAME scene 3D already uses -- same "adopted family
// member" reasoning as every other store on this page, generalized off
// the earlier Phase 2 design's 3 separately-named keys (Square/Hexagon/
// Triangle) into one keyed function so a new named angle or primitive
// never needs a new hand-added constant here.
export function lattice2dStorageKey(comboId) {
  return `rhombiverse-lattice2d-${comboId}-world`;
}

// Rhombohedra (free lattice): own store, own coordinate frame (3 real
// edge vectors of one of RD Quarter's own 4 congruent orientations --
// see geometry-extensions/rhombohedra-lattice.js's own header for why
// RD Quarter itself can't be freely placed/removed in open space).
export const RHOMBOHEDRA_STORAGE_KEY = 'rhombiverse-rhombohedra-world';

export function saveToLocalStorage(worldJSON, key = STORAGE_KEY) {
  try {
    localStorage.setItem(key, JSON.stringify(worldJSON));
  } catch (err) {
    console.warn('Rhombiverse: failed to save world to localStorage', err);
  }
}

export function loadFromLocalStorage(key = STORAGE_KEY) {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Rhombiverse: saved world was corrupt JSON, ignoring', err);
    return null;
  }
}

export function clearLocalStorage(key = STORAGE_KEY) {
  localStorage.removeItem(key);
}

export function exportWorldFile(worldJSON, filename = 'rhombiverse-world.json') {
  const blob = new Blob([JSON.stringify(worldJSON, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importWorldFile(file) {
  const text = await file.text();
  return JSON.parse(text);
}

// Pyrochlore (3D Kagome) build ('pyrochlore' piece tier): its own
// separate world of truncated tetrahedra, in geometry-extensions/
// pyrochlore-lattice.js's own doubled-coordinate frame (registered to the
// main RD world's units). Cap tetrahedra are derived, never stored.
export const PYROCHLORE_STORAGE_KEY = 'rhombiverse-pyrochlore-world';
