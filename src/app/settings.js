// Single source of truth for the B1 Settings panel, a tiny pub/sub
// store. Full design rationale/history: docs/code-notes/app/settings.md
const SETTINGS_KEY = 'rhombiverse-settings';

export const QUALITY_PIXEL_RATIO_FACTOR = {
  low: 0.5,
  medium: 0.75,
  high: 1,
};

// Ordered lowest -> highest, for the auto-degrade guardrail (reframe
// Stage 6) to step down one level at a time -- see render.js's own
// sustained-low-FPS check.
export const QUALITY_LEVELS_ASCENDING = ['low', 'medium', 'high'];

const DEFAULTS = {
  sensitivity: 1,
  invertY: false,
  fov: 50,
  quality: 'high',
  volume: 0.5,
  // Performance guardrail (reframe Stage 6): the meter itself is opt-in
  // ("optional FPS meter"), but the auto-degrade safety net it's
  // attached to runs regardless of whether the meter is shown -- see
  // render.js's animate().
  showFPSMeter: false,
  // Bring-Your-Own-AI-Key: key/model live ONLY here (this visitor's own
  // localStorage), never sent to this site's server -- see byok.js and
  // the companion doc.
  byokProvider: 'none',
  byokApiKey: '',
  byokModel: '',
  // Rhombeometry mode default -- see companion doc for why this is true
  // and why changing it needs a reload.
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

export function onSettingsChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
