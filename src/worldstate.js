// Load/save/serialize the world-state JSON (schema: RHOMBIVERSE_PLAN.md
// section 3), and an in-memory mutable store over it for Phase 2's
// add/remove-cell build tool. Persisting mutations to storage lands in
// Phase 3 (persistence.js) -- this module only tracks state in memory.
import { cellKey, parseCellKey } from './lattice.js';

export async function loadWorld(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load world from ${url}: ${res.status}`);
  }
  return res.json();
}

// Wraps a loaded world JSON's `cells` map in a Map keyed the same way
// ("x,y,z"), with add/remove/has by coordinate and a stable-order
// entries() list for rendering.
export function createWorldStore(worldJSON) {
  const cells = new Map(Object.entries(worldJSON.cells));

  return {
    has(x, y, z) {
      return cells.has(cellKey(x, y, z));
    },
    addCell(x, y, z, data) {
      cells.set(cellKey(x, y, z), data);
    },
    removeCell(x, y, z) {
      cells.delete(cellKey(x, y, z));
    },
    entries() {
      return Array.from(cells.entries()).map(([key, data]) => {
        const [x, y, z] = parseCellKey(key);
        return { x, y, z, ...data };
      });
    },
  };
}
