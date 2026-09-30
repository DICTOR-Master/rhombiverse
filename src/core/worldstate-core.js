// Load/save/serialize the world-state JSON ({ worldName, version, cells:
// { "x,y,z": { material, ... } }, meta }), and an in-memory mutable store
// over it. Persistence to
// storage lives in persistence.js -- this module only tracks state in
// memory.
import { cellKey, parseCellKey } from './lattice.js';

export async function loadWorld(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load world from ${url}: ${res.status}`);
  }
  return res.json();
}

export function createWorldStore(worldJSON, hooks = {}) {
  let worldName = worldJSON.worldName;
  let version = worldJSON.version;
  let meta = { ...worldJSON.meta };
  const cells = new Map(Object.entries(worldJSON.cells));
  // Memoized entries() copy -- a real perf bug found live (2026-08-24),
  // see notes. Invalidated (set back to null) by every mutator below and
  // by replaceAll; lazily rebuilt on the next read after that.
  let cellsEntriesCache = null;

  return {
    has(x, y, z) {
      return cells.has(cellKey(x, y, z));
    },
    addCell(x, y, z, data) {
      cells.set(cellKey(x, y, z), data);
      cellsEntriesCache = null;
      hooks.onAdd?.(x, y, z, data);
    },
    removeCell(x, y, z) {
      cells.delete(cellKey(x, y, z));
      cellsEntriesCache = null;
      hooks.onRemove?.(x, y, z);
    },
    entries() {
      if (cellsEntriesCache === null) {
        cellsEntriesCache = Array.from(cells.entries()).map(([key, data]) => {
          const [x, y, z] = parseCellKey(key);
          return { x, y, z, ...data };
        });
      }
      return cellsEntriesCache;
    },
    toJSON() {
      return {
        worldName,
        version,
        cells: Object.fromEntries(cells),
        meta: { ...meta, lastModified: new Date().toISOString() },
      };
    },
    replaceAll(newWorldJSON) {
      worldName = newWorldJSON.worldName;
      version = newWorldJSON.version;
      meta = { ...newWorldJSON.meta };
      cellsEntriesCache = null;
      cells.clear();
      for (const [key, data] of Object.entries(newWorldJSON.cells)) {
        cells.set(key, data);
      }
    },
  };
}
