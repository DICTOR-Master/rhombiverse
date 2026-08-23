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
import { cellsInShells, cellKey } from '../core/lattice.js';

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

// Deterministic pseudo-random value noise -- the standard GLSL
// sine-hash technique (borrowed, not invented, per Grounded Simplicity),
// quantized to a patch grid so nearby cells usually land in the same
// bucket and read as chunky coastlines/lake patches rather than
// salt-and-pepper speckle. Same input always produces the same output,
// so a generated body is reproducible from its own coordinates alone --
// no seed needs to be stored anywhere.
function surfaceNoise(x, y, z, patchSize) {
  const px = Math.floor(x / patchSize);
  const py = Math.floor(y / patchSize);
  const pz = Math.floor(z / patchSize);
  const s = Math.sin(px * 12.9898 + py * 78.233 + pz * 37.719) * 43758.5453;
  return s - Math.floor(s);
}

// A layered body with OPEN water on the surface (oceans/lakes), distinct
// from ice-moon/ice-giant's icy-mantle-reaches-the-surface design: per
// direct request, ice belongs NEAR THE CORE (a buried layer, same real
// basis as Europa/Enceladus subsurface oceans -- ice-moon's own existing
// justification, reused here) while the crust itself is a genuine mix of
// dry land and standing water bodies, so there's always land to plant
// RHOMBIVERSE_SPEC_PENROSE_GROWTH.md's growth-layer life on. `waterFraction`
// (0..1) is the one tunable knob varying the three presets below --
// higher means more of the crust reads as ocean rather than continent.
// The subsurface ice band still auto-permeates to (subsurface) water via
// hydrosphere.js the instant the body loads, same established mechanic
// as ice-moon/ice-giant -- not prevented here, since a buried liquid
// layer under solid crust is the correct real-world reading (a
// subsurface ocean), not a bug to work around.
function oceanicRecipe(waterFraction, patchSize = 2.2) {
  return (cell, dist, radius) => {
    const f = dist / radius;
    if (f <= 0.18) return 'ferrostone'; // dense core
    if (f <= 0.4) return 'ice99'; // buried ice layer near the core -- auto-permeates to a subsurface ocean
    if (f <= 0.62) return 'garnet'; // rocky mantle separating the subsurface ocean from the crust
    // Crust: dry land by default, open water in patches sized/positioned
    // by surfaceNoise -- 'water' is placed directly (already the
    // terminal liquid material, no permeation step needed) so oceans/
    // lakes are visible immediately on generation, not only after
    // hydrosphere.js's next pass.
    const n = surfaceNoise(cell.x, cell.y, cell.z, patchSize);
    return n < waterFraction ? 'water' : 'base';
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
  // Three points along one real gradient -- how much of a rocky body's
  // surface is open water vs. dry land -- rather than three unrelated
  // recipes, per the direct request for "varying water surface" bodies.
  // All three share the exact same layering (core -> subsurface ice ->
  // rocky mantle -> land/water crust); only waterFraction differs.
  'arid-world': {
    label: 'Arid World',
    materialForCell: oceanicRecipe(0.12), // scattered oases/inland lakes, mostly dry land -- roomiest for sowing life
  },
  continental: {
    label: 'Continental World',
    materialForCell: oceanicRecipe(0.42), // Earth-like balance of continents and oceans/seas
  },
  'ocean-world': {
    label: 'Ocean World',
    materialForCell: oceanicRecipe(0.72), // mostly ocean with scattered islands -- land is the rare resource here
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
    // materialForCell (oceanicRecipe) needs the cell's own coordinates
    // for surface noise; materialForShell (every other recipe) only
    // ever needed depth, so it's untouched -- one or the other is
    // always defined, never both.
    const material = recipe.materialForCell
      ? recipe.materialForCell(cell, dist, radius)
      : recipe.materialForShell(dist, radius);
    if (!canPlaceMaterial(material, cell.x, cell.y, cell.z)) continue;
    world.addCell(cell.x, cell.y, cell.z, {
      material,
      shell: cell.shell,
      shellCenter: centerKey,
      generatorType: type,
    });
  }
}
