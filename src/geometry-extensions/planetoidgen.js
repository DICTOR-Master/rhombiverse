// Formula-driven planetoid generation (rocky/ice-moon/gas-giant/etc. in
// one click). Full design rationale/history: docs/code-notes/geometry-extensions/planetoidgen.md
import { cellsInShells, cellKey } from '../core/lattice.js';

function fractionalRecipe(bands) {
  return (shell, totalShells) => {
    const f = shell / totalShells;
    for (const [endFraction, material] of bands) {
      if (f <= endFraction) return material;
    }
    return bands[bands.length - 1][1];
  };
}

function surfaceNoise(x, y, z, patchSize) {
  const px = Math.floor(x / patchSize);
  const py = Math.floor(y / patchSize);
  const pz = Math.floor(z / patchSize);
  const s = Math.sin(px * 12.9898 + py * 78.233 + pz * 37.719) * 43758.5453;
  return s - Math.floor(s);
}

function oceanicRecipe(waterFraction, patchSize = 2.2) {
  return (cell, dist, radius) => {
    const f = dist / radius;
    if (f <= 0.18) return 'ferrostone'; // dense core
    if (f <= 0.4) return 'ice99'; // buried ice layer near the core -- auto-permeates to a subsurface ocean
    if (f <= 0.62) return 'garnet'; // rocky mantle separating the subsurface ocean from the crust
    // Crust: dry land by default, open water in patches (see companion doc)
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
    // Three-layer real ice-giant structure (Uranus/Neptune) -- see companion doc
    materialForShell: fractionalRecipe([
      [1 / 5, 'ferrostone'], // small rocky/metallic core
      [4 / 5, 'ice99'], // deep icy mantle -- auto-permeates via hydrosphere.js
      [1, 'glassite'], // thin translucent outer atmosphere
    ]),
  },
  // Three points along one real gradient (dry land vs. open water) -- see companion doc
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

// Selects cells by TRUE Euclidean distance, not raw BFS shell membership -- see companion doc
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
