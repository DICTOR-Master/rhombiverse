// World-state persistence backend. localStorage for now (Phase 3),
// swappable for a realtime store later (Phase 5) without a schema
// change -- both would just implement the same save/load shape.
const STORAGE_KEY = 'rhombiverse-world';

// Wrapped in try/catch: a quota-exceeded or private-browsing localStorage
// failure should not break building -- it's a real, recoverable
// possibility, not a hypothetical worth ignoring, since MAX_CELLS=20000
// shell-fills can produce a JSON blob large enough to matter.
export function saveToLocalStorage(worldJSON) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(worldJSON));
  } catch (err) {
    console.warn('Rhombiverse: failed to save world to localStorage', err);
  }
}

export function loadFromLocalStorage() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Rhombiverse: saved world was corrupt JSON, ignoring', err);
    return null;
  }
}

export function clearLocalStorage() {
  localStorage.removeItem(STORAGE_KEY);
}

// Triggers a browser download of the given world JSON as a .json file --
// the portable, manually-shareable form the plan's Phase 3 calls for.
export function exportWorldFile(worldJSON, filename = 'rhombiverse-world.json') {
  const blob = new Blob([JSON.stringify(worldJSON, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Reads a File (from an <input type="file"> change event) and resolves
// to its parsed JSON. Rejects if it isn't valid JSON -- callers should
// handle that as a user-facing "invalid file" case, not a crash.
export async function importWorldFile(file) {
  const text = await file.text();
  return JSON.parse(text);
}
