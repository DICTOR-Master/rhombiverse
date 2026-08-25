// First-run welcome/entry overlay: logo, description, legal-doc links.
// Purely a DOM/localStorage concern, independent of render.js/world
// state. Full design rationale/history: docs/code-notes/app/welcome.md
import { getSettings, updateSettings } from './settings.js';

const SKIP_KEY = 'rhombiverse-skip-intro';

// Migration Path Phase C's Rhombeometry/Full World mode choice -- see
// companion doc for why picking a different mode reloads immediately.

// Wireframe RD logo coords, same as favicon.svg -- see companion doc
// for the 2026-08-23 redraw/revert history.
const RD_EDGES = [
  [-29.48, 20.83, -33.10, -9.69], [-29.48, 20.83, 0.00, 38.94], [-29.48, 20.83, -25.86, 12.40],
  [-3.62, 8.43, -33.10, -9.69], [-3.62, 8.43, 0.00, 38.94], [-3.62, 8.43, 25.86, -12.40],
  [-29.48, -18.12, -33.10, -9.69], [-29.48, -18.12, 0.00, -38.94], [-29.48, -18.12, -25.86, 12.40],
  [-3.62, -30.51, -33.10, -9.69], [-3.62, -30.51, 0.00, -38.94], [-3.62, -30.51, 25.86, -12.40],
  [3.62, 30.51, 33.10, 9.69], [3.62, 30.51, 0.00, 38.94], [3.62, 30.51, -25.86, 12.40],
  [29.48, 18.12, 33.10, 9.69], [29.48, 18.12, 0.00, 38.94], [29.48, 18.12, 25.86, -12.40],
  [3.62, -8.43, 33.10, 9.69], [3.62, -8.43, 0.00, -38.94], [3.62, -8.43, -25.86, 12.40],
  [29.48, -20.83, 33.10, 9.69], [29.48, -20.83, 0.00, -38.94], [29.48, -20.83, 25.86, -12.40],
];

function logoSvg() {
  const lines = RD_EDGES.map(([x1, y1, x2, y2]) => `<path d="M ${x1} ${y1} L ${x2} ${y2}" />`).join('');
  return `
    <svg viewBox="-45 -45 90 90" width="110" height="110" role="img" aria-label="Rhombiverse logo: a wireframe rhombic dodecahedron">
      <g stroke="#7cf" stroke-width="1.5" stroke-linecap="round" fill="none">${lines}</g>
    </svg>`;
}

// Shown until loadLatestUpdate() resolves; real tagline is always the
// newest data/changelog.json entry's title -- see companion doc.
const FALLBACK_TAGLINE = 'One shape. Everything grows from it.';

function overlayHtml() {
  return `
    <div id="welcome-card">
      ${logoSvg()}
      <h1>Rhombiverse</h1>
      <p class="tagline" id="welcome-tagline">${FALLBACK_TAGLINE}</p>
      <div class="identity-block">
        <div class="identity-prompt">Start with:</div>
        <div class="identity-grid">
          <div class="identity-item" data-persona="rhombinaut" role="button" tabindex="0"><strong>Rhombinaut</strong> -- walk your worlds</div>
          <div class="identity-item" data-persona="rhombitect" role="button" tabindex="0"><strong>Rhombitect</strong> -- build whole planets</div>
          <div class="identity-item" data-persona="rhombisculptor" role="button" tabindex="0"><strong>Rhombisculptor</strong> -- model, chisel, create</div>
          <div class="identity-item" data-persona="rhombiologist" role="button" tabindex="0"><strong>Rhombiologist</strong> -- grow evolving lifeforms</div>
        </div>
      </div>
      <p class="quickstart">Click a face to build, right-click to remove.</p>
      <div class="mode-choice">
        <div class="mode-choice-prompt">Mode:</div>
        <button type="button" class="mode-choice-btn" data-mode="pure" id="mode-choice-pure">Pure Rhombeometry</button>
        <button type="button" class="mode-choice-btn" data-mode="full" id="mode-choice-full">Full World</button>
      </div>
      <label class="dont-show">
        <input type="checkbox" id="skip-intro-checkbox" />
        Don't show this again on this device
      </label>
      <button id="enter-world-btn" type="button">Enter the Rhombiverse →</button>
      <div class="legal-links">
        <a href="./TERMS.md" target="_blank" rel="noopener">Terms</a>
        · <a href="./PRIVACY.md" target="_blank" rel="noopener">Privacy</a>
        · <a href="./SECURITY.md" target="_blank" rel="noopener">Security</a>
        · <a href="https://github.com/DICTOR-Master/rhombiverse" target="_blank" rel="noopener">Source</a>
      </div>
    </div>`;
}

// Fire-and-forget from init() -- see companion doc for why it doesn't
// block first paint.
async function loadLatestUpdate() {
  try {
    const res = await fetch('./data/changelog.json');
    const entries = await res.json();
    return entries[0] ?? null;
  } catch (err) {
    console.warn('Rhombiverse: failed to load changelog for welcome tagline', err);
    return null;
  }
}

function init() {
  const overlay = document.createElement('div');
  overlay.id = 'welcome-overlay';
  overlay.innerHTML = overlayHtml();
  document.body.appendChild(overlay);

  loadLatestUpdate().then((entry) => {
    if (!entry) return;
    const tagline = document.getElementById('welcome-tagline');
    if (!tagline) return;
    tagline.textContent = entry.title;
  });

  const fullBtn = document.getElementById('mode-choice-full');
  const pureBtn = document.getElementById('mode-choice-pure');
  function refreshModeChoiceButtons() {
    const isPure = getSettings().pureGeometry;
    fullBtn.classList.toggle('active', !isPure);
    pureBtn.classList.toggle('active', isPure);
  }
  refreshModeChoiceButtons();
  function chooseMode(pureGeometry) {
    if (getSettings().pureGeometry === pureGeometry) return;
    updateSettings({ pureGeometry });
    window.location.reload();
  }
  fullBtn.addEventListener('click', () => chooseMode(false));
  pureBtn.addEventListener('click', () => chooseMode(true));

  const aboutBtn = document.createElement('button');
  aboutBtn.id = 'about-btn';
  aboutBtn.type = 'button';
  aboutBtn.title = 'About Rhombiverse';
  aboutBtn.textContent = 'ℹ';
  document.body.appendChild(aboutBtn);

  function show() {
    overlay.style.display = 'flex';
  }
  function hide() {
    overlay.style.display = 'none';
  }

  function persistSkipChoice() {
    if (document.getElementById('skip-intro-checkbox').checked) {
      try {
        localStorage.setItem(SKIP_KEY, 'true');
      } catch (err) {
        console.warn('Rhombiverse: failed to save intro preference', err);
      }
    }
  }

  document.getElementById('enter-world-btn').addEventListener('click', () => {
    persistSkipChoice();
    hide();
  });
  aboutBtn.addEventListener('click', show);

  // render.js listens for this and does the actual mode/panel switching
  // -- see companion doc.
  document.querySelectorAll('.identity-item').forEach((el) => {
    const choose = () => {
      window.dispatchEvent(new CustomEvent('rhombiverse:personaChosen', { detail: { persona: el.dataset.persona } }));
      persistSkipChoice();
      hide();
    };
    el.addEventListener('click', choose);
    el.addEventListener('keydown', (e) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        choose();
      }
    });
  });

  let skip = false;
  try {
    skip = localStorage.getItem(SKIP_KEY) === 'true';
  } catch (err) {
    // localStorage unavailable -- default to showing the intro.
  }
  if (skip) {
    hide();
  } else {
    show();
  }
}

init();
