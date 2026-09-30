// Single source of truth for the B1 Settings panel, a tiny pub/sub
// store.
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
  // UI-chrome language (src/app/i18n.js) -- shared with RHOMBIS via this
  // same SETTINGS_KEY, so a choice made in either app is honored in both.
  language: 'en',
  // Performance guardrail (reframe Stage 6): the meter itself is opt-in
  // ("optional FPS meter"), but the auto-degrade safety net it's
  // attached to runs regardless of whether the meter is shown -- see
  // render.js's animate().
  showFPSMeter: false,
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
  return { ...current };
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
