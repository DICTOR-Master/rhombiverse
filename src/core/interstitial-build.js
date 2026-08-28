// Interstitial-lattice store: disphenoid cells for the BCC interstitial-
// site tessellation (geometry-extensions/interstitial-lattice.js). The
// actual click-to-build logic lives in core/build.js's own
// handleInterstitialClick, integrated the same way the TO piece tier is
// (an early-routed branch inside the universal Add/Remove controller,
// not a separate addEventListener-based controller) -- that was this
// file's first draft, reverted once it became clear a second, parallel
// set of click/contextmenu listeners would double-handle every click
// alongside core/build.js's own. Full design rationale: docs/code-notes/
// core/interstitial-build.md
import { disphenoidKey } from '../geometry-extensions/interstitial-lattice.js';

// Deliberately NOT core/worldstate-core.js's createWorldStore: that
// store's whole schema/API is keyed on cellKey(x,y,z), a single integer
// triple -- disphenoid cells have no such single index (each is 4 real
// lattice points, not 1), so this is its own small store, the same
// reasoning bcc-build.js already applies to keep its own store separate
// from the main one.
export function createInterstitialStore(savedJSON) {
  const cells = new Map(Object.entries(savedJSON?.cells ?? {}));
  return {
    has(key) { return cells.has(key); },
    get(key) { return cells.get(key); },
    addDisphenoid(verts, data) {
      const key = disphenoidKey(verts);
      cells.set(key, { verts, ...data });
      return key;
    },
    removeDisphenoid(key) { cells.delete(key); },
    replaceAll(worldJSON) {
      cells.clear();
      for (const [key, data] of Object.entries(worldJSON?.cells ?? {})) cells.set(key, data);
    },
    entries() {
      return Array.from(cells.entries()).map(([key, data]) => ({ key, ...data }));
    },
    toJSON() {
      return { worldName: 'Interstitial Lattice', version: 1, cells: Object.fromEntries(cells) };
    },
  };
}
