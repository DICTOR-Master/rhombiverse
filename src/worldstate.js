// Load/save/serialize the world-state JSON (schema: RHOMBIVERSE_PLAN.md
// section 3), and an in-memory mutable store over it. Actually persisting
// to storage (localStorage) lives in persistence.js -- this module only
// tracks state in memory and knows how to turn it back into JSON.
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
// entries() list for rendering. The store is a single long-lived object
// (render.js holds one reference for the whole session) -- replaceAll
// mutates it in place rather than requiring callers to swap to a new
// store, so existing closures (build.js's controller, etc.) keep working
// after a "New World" reset or a JSON import.
export function createWorldStore(worldJSON) {
  let worldName = worldJSON.worldName;
  let version = worldJSON.version;
  let meta = { ...worldJSON.meta };
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
    // Serializes back to the full RHOMBIVERSE_PLAN.md section 3 shape,
    // for persistence.js to save/export.
    toJSON() {
      return {
        worldName,
        version,
        cells: Object.fromEntries(cells),
        meta: { ...meta, lastModified: new Date().toISOString() },
      };
    },
    // Replaces the entire world in place (New World reset, JSON import).
    replaceAll(newWorldJSON) {
      worldName = newWorldJSON.worldName;
      version = newWorldJSON.version;
      meta = { ...newWorldJSON.meta };
      cells.clear();
      for (const [key, data] of Object.entries(newWorldJSON.cells)) {
        cells.set(key, data);
      }
    },
  };
}
