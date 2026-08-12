// Formula-driven planetoid generation. Reuses the same shell math already
// central to this project (cellsInShells / shellCount(n) = 10n^2+2) to
// build recognizable body types (rocky planetoid, ice moon, gas giant) in
// ONE click, rather than requiring precise face-by-face hand-building --
// exactly the fragility documented in CLAUDE.md's frost-line verification
// entry (shared-face midpoints vs. neighbor centers, a fixed camera
// walking distant click targets off-canvas or into occlusion).
//
// Every recipe stamps exactly one Blackstar-Glassite cell at the center:
// gravity in this game is entirely tied to BSG
// (RHOMBIVERSE_SPEC_PLANETOID_GRAVITY.md section 4 -- "a planetoid is
// only gravity-active... if it has at least one Blackstar-Glassite
// cell"), so a generated body needs one to be walkable/gravitationally
// coherent at all. That's a hard constraint of the existing mechanic,
// not invented lore.
//
// Per-shell composition gradients (dense core -> lighter crust, an icy
// moon's rock-then-ice layering, a gas giant's small rocky core under a
// large translucent envelope) directly mirror real planetary
// differentiation and this project's own established Grounded Simplicity
// convention: borrow the real gradient, don't invent an arbitrary one.
// Gas giants reuse Glassite ("translucent... no gravity function," per
// RHOMBIVERSE_SPEC_PLANETOID_GRAVITY.md section 2) as the atmosphere
// material rather than minting a new one -- same "reuse before inventing"
// move as Star System's own Ferrostone-as-carbon-catalyst choice.
import { cellsInShells, cellKey } from './lattice.js';

// bands: [[endFraction, material], ...] in ascending fraction order --
// as simple a per-shell formula as reasonably possible: which band a
// shell's fractional depth (shell/totalShells) falls into decides its
// material, nothing more elaborate.
function fractionalRecipe(bands) {
  return (shell, totalShells) => {
    const f = shell / totalShells;
    for (const [endFraction, material] of bands) {
      if (f <= endFraction) return material;
    }
    return bands[bands.length - 1][1];
  };
}

export const PLANETOID_RECIPES = {
  rocky: {
    label: 'Rocky Planetoid',
    materialForShell: fractionalRecipe([
      [1 / 3, 'ferrostone'], // dense core
      [2 / 3, 'garnet'], // mantle
      [1, 'base'], // crust
    ]),
  },
  'ice-moon': {
    label: 'Ice Moon',
    materialForShell: fractionalRecipe([
      [1 / 2, 'ferrostone'], // rocky/metallic core, per real icy moons (Europa, Enceladus)
      [1, 'ice99'], // icy shell -- auto-permeates via hydrosphere.js since it's in the same BSG cluster
    ]),
  },
  'gas-giant': {
    label: 'Gas Giant',
    materialForShell: fractionalRecipe([
      [1 / 4, 'ferrostone'], // small dense core
      [1, 'glassite'], // large translucent "atmosphere" envelope
    ]),
  },
  'ice-giant': {
    label: 'Ice Giant',
    // Distinct from both ice-moon (ice reaches the surface, no
    // atmosphere) and gas-giant (no ice layer at all): real ice giants
    // (Uranus, Neptune) are a small rocky/metallic core wrapped in a
    // deep water/ammonia/methane "ices" mantle, topped with a
    // comparatively thin H/He/CH4 atmosphere -- the defining
    // three-layer structure that separates them from gas giants.
    materialForShell: fractionalRecipe([
      [1 / 5, 'ferrostone'], // small rocky/metallic core
      [4 / 5, 'ice99'], // deep icy mantle -- auto-permeates via hydrosphere.js
      [1, 'glassite'], // thin translucent outer atmosphere
    ]),
  },
};

// Builds a full body in one call: the given center becomes the
// Blackstar-Glassite gravity core (overwriting whatever was there --
// "generate a planetoid here" means this location becomes the new
// anchor, a deliberate replacement like New World, not an incremental
// grow). Skips cells that already exist (never overwrites other real
// player-built matter) and respects canPlaceMaterial (the Star System
// frost line) exactly like Fill mode does -- restricted candidates are
// simply skipped, not blocked as a whole action.
//
// Selects cells by TRUE Euclidean distance from center (<= radius),
// not raw BFS shell membership -- a BFS "shell" in this 12-neighbor
// lattice is a rhombic-dodecahedron-shaped level set of the graph
// metric (this project's own voxel shape, expressed at planetoid
// scale), not a sphere: build.js's roundStructure already documents
// shell N's real distances ranging from N up to N*sqrt(2), which is
// exactly why a raw shell-fill body reads as faceted/pointed rather
// than round. cellsInShells(..., radius) is still the right candidate
// pool -- shell N's minimum real distance is exactly N, so no cell
// within Euclidean `radius` can ever sit at a BFS shell greater than
// `radius` -- but membership is now decided by real distance, giving a
// genuinely round body instead of a shell-shaped one needing a
// separate Round pass afterward. `shell` (BFS integer) is still stamped
// per cell for compatibility with everything else that groups by it
// (gravity core-cavity sizing, the ring panel, Round/Excavate).
export function generatePlanetoid(world, type, centerX, centerY, centerZ, radius, canPlaceMaterial = () => true) {
  const recipe = PLANETOID_RECIPES[type];
  if (!recipe) return;
  const centerKey = cellKey(centerX, centerY, centerZ);

  world.addCell(centerX, centerY, centerZ, {
    material: 'blackstar-glassite',
    shellCenter: centerKey,
    generatorType: type,
  });

  for (const cell of cellsInShells(centerX, centerY, centerZ, radius)) {
    if (world.has(cell.x, cell.y, cell.z)) continue;
    const dist = Math.hypot(cell.x - centerX, cell.y - centerY, cell.z - centerZ);
    if (dist > radius) continue;
    const material = recipe.materialForShell(dist, radius);
    if (!canPlaceMaterial(material, cell.x, cell.y, cell.z)) continue;
    world.addCell(cell.x, cell.y, cell.z, {
      material,
      shell: cell.shell,
      shellCenter: centerKey,
      generatorType: type,
    });
  }
}
