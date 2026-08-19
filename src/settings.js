// Single source of truth for the B1 Settings panel (sensitivity, invert-Y,
// FOV, graphics quality, volume) -- reachable only via the Advanced/Lab
// entry point per RHOMBIVERSE_UIUX_BUILD_PLAN.md B1, never shown on the
// main screen. Kept as a tiny pub/sub store rather than scattering these
// five values across render.js/player.js's own module-level consts, so
// every consumer (camera FOV, OrbitControls rotateSpeed, player.js mouse
// look, sfx.js gain, renderer pixel ratio) reacts to a change the same way.
const SETTINGS_KEY = 'rhombiverse-settings';

export const QUALITY_PIXEL_RATIO_FACTOR = {
  low: 0.5,
  medium: 0.75,
  high: 1,
};

const DEFAULTS = {
  sensitivity: 1, // multiplier on both OrbitControls.rotateSpeed and player.js's own MOUSE_SENSITIVITY
  invertY: false,
  fov: 50, // matches the camera's original hardcoded PerspectiveCamera fov
  quality: 'high',
  volume: 0.5,
};

function loadSaved() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    return {};
  }
}

let current = { ...DEFAULTS, ...loadSaved() };
const listeners = new Set();

export function getSettings() {
  return current;
}

export function updateSettings(partial) {
  current = { ...current, ...partial };
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(current));
  } catch (err) {
    console.warn('Rhombiverse: failed to save settings', err);
  }
  listeners.forEach((fn) => fn(current));
}

// Returns an unsubscribe function, same shape as every other event-ish
// helper in this codebase (sync.js's subscribeToSharedWorld, etc.).
export function onSettingsChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
