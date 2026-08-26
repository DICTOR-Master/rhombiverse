// World-state persistence backend (localStorage for now, swappable later).
// Full rationale: docs/code-notes/core/persistence.md
const STORAGE_KEY = 'rhombiverse-world';

// The BCC dual-lattice build (geometry-extensions/bcc-build.md) is a
// second, independent world store -- its own localStorage key rather
// than a field merged into the main world's JSON, so none of the many
// existing `saveToLocalStorage(world.toJSON())` call sites (undo, Shared
// World sync, Clear World, ...) need to change to also carry BCC data,
// and none of them can accidentally clobber it either.
export const BCC_STORAGE_KEY = 'rhombiverse-bcc-world';

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
