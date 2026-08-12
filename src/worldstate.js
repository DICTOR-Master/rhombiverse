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
// hooks.onAdd(x,y,z,data)/onRemove(x,y,z), both optional, fire at the end
// of every addCell/removeCell call -- every mutation path in the app
// (build.js's click handlers, recolorShell/removeShell, and every
// apply*() derived-mechanic module) goes through these two methods, so
// this is the single point sync.js (Phase 5) needs to hook to push local
// changes to the shared backend, without worldstate.js knowing anything
// about Supabase/realtime itself. Deliberately NOT called by replaceAll
// -- a bulk local-view swap (Undo, New World, Import, Load preset) is a
// personal reset, not a real edit, and must never bulk-push/delete
// against a shared world (render.js additionally disables those controls
// entirely while Shared World sync is active, since replaceAll bypassing
// these hooks means they'd otherwise silently desync the shared view).
export function createWorldStore(worldJSON, hooks = {}) {
  let worldName = worldJSON.worldName;
  let version = worldJSON.version;
  let meta = { ...worldJSON.meta };
  const cells = new Map(Object.entries(worldJSON.cells));

  return {
    has(x, y, z) {
      return cells.has(cellKey(x, y, z));
    },
    // Stamps gravitySource/gravityWeight per the schema in
    // RHOMBIVERSE_SPEC_PLANETOID_GRAVITY.md section 5, for any cell whose
    // material is Blackstar-Glassite (and strips them otherwise, e.g. on
    // recolor away from it). These fields are NOT load-bearing --
    // gravity.js treats `material` as ground truth so worlds imported
    // from an older export (without these fields) still work correctly --
    // they exist for schema-compliance / future external tooling only.
    addCell(x, y, z, data) {
      const { gravitySource, gravityWeight, ...rest } = data;
      let stamped =
        data.material === 'blackstar-glassite'
          ? { ...rest, gravitySource: true, gravityWeight: gravityWeight ?? 1.0 }
          : rest;
      // Phase 5.8 moderation fields (RHOMBIVERSE_PLAN.md section 3 / Phase
      // 5.8): schema-ready on every cell, defaulted only when genuinely
      // absent -- an existing cell's own data (spread in via ...data by
      // every caller that re-adds a cell, e.g. recolor, hydrosphere,
      // black hole/star mechanics) already carries its real values here,
      // so this only ever stamps brand-new cells. `region` defaults to
      // 'open'/`status` to 'pending' per the plan's own "new builds
      // default to open/pending until reviewed" -- curated content
      // (data/starter-world.json, data/presets/*.json) sets 'core'/
      // 'approved' explicitly in its own JSON and bypasses this entirely
      // via replaceAll(), so it's never touched here.
      if (stamped.region === undefined) stamped = { ...stamped, region: 'open' };
      if (stamped.status === undefined) stamped = { ...stamped, status: 'pending' };
      cells.set(cellKey(x, y, z), stamped);
      hooks.onAdd?.(x, y, z, stamped);
    },
    removeCell(x, y, z) {
      cells.delete(cellKey(x, y, z));
      hooks.onRemove?.(x, y, z);
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
