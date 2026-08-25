// World-state persistence backend (localStorage for now, swappable later).
// Full rationale: docs/code-notes/core/persistence.md
const STORAGE_KEY = 'rhombiverse-world';

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
