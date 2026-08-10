// Load/save/serialize the world-state JSON (schema: RHOMBIVERSE_PLAN.md
// section 3). Phase 1 only needs read; save/serialize lands in Phase 3.
import { parseCellKey } from './lattice.js';

export async function loadWorld(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load world from ${url}: ${res.status}`);
  }
  return res.json();
}

// Flattens the `cells` map ("x,y,z" -> cell data) into an array of
// { x, y, z, ...cellData } records, convenient for rendering/iteration.
export function cellsOf(world) {
  return Object.entries(world.cells).map(([key, data]) => {
    const [x, y, z] = parseCellKey(key);
    return { x, y, z, ...data };
  });
}
