// Minimise handle for a bottom control panel. A chevron at the panel's top
// folds its controls away, leaving only the handle, so the scene behind is
// visible. The state is remembered per panel (under `key`) on this device.
// Every panel with a row of controls gets one (CLAUDE.md, UI rule).

const STORAGE_KEY = 'rv-panel-min';

function readAll() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {}; } catch { return {}; }
}

function writeAll(all) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(all)); } catch { /* best-effort */ }
}

/**
 * @param {HTMLElement} panel  the fixed bottom panel, already in the DOM
 * @param {string} key         stable name for remembering this panel's state
 * @param {() => void} [onToggle]  called after a fold/unfold, e.g. to refit the camera
 */
export function addPanelMinimiser(panel, key, onToggle) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'panel-min';
  btn.setAttribute('aria-expanded', 'true');
  btn.setAttribute('aria-label', 'Minimise controls');
  btn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  panel.prepend(btn);

  function apply(minimised) {
    panel.classList.toggle('minimised', minimised);
    btn.setAttribute('aria-expanded', String(!minimised));
    btn.setAttribute('aria-label', minimised ? 'Show controls' : 'Minimise controls');
    btn.querySelector('path').setAttribute('d', minimised ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6');
  }

  apply(Boolean(readAll()[key]));

  btn.addEventListener('click', () => {
    const minimised = !panel.classList.contains('minimised');
    apply(minimised);
    const all = readAll();
    all[key] = minimised;
    writeAll(all);
    onToggle?.();
  });
}
