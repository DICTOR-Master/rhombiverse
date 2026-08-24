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
  // Bring-Your-Own-AI-Key (requested mid-B5): 'none' | 'anthropic' | 'openai'.
  // The key/model live ONLY here (this visitor's own localStorage) --
  // see byok.js, never sent to this site's own server.
  byokProvider: 'none',
  byokApiKey: '',
  byokModel: '',
  // Migration Path Phase C (RHOMBIVERSE_PLAN.md): "Rhombeometry" mode --
  // World Systems (mining/economy/achievements/animals/hazards/
  // hydrosphere) forced off, geometry-only. Defaults to true -- direct
  // instruction, matching "the geometry comes first" (the 2026-08-23
  // changelog's own framing): a first-time visitor lands in Rhombeometry,
  // not Full World, unless they choose otherwise. Read by features.js at
  // module-eval time, before render.js's init() ever gates a single
  // World Systems import -- so changing this needs a reload to take
  // effect (see welcome.js/render.js's own toggle wiring).
  pureGeometry: true,
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
