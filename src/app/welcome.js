// First-run welcome/entry overlay: logo, plain-language description, and
// links to the legal docs every small public web app carries
// (TERMS.md/PRIVACY.md/SECURITY.md, already written for Phase 4's public
// deploy -- see CLAUDE.md). No "under construction" framing (dropped
// 2026-08-19 -- undermined trust/permanence per user feedback). Purely a DOM/
// localStorage concern, deliberately independent of render.js/world
// state -- this can run (and the game can be dismissed into) even if
// nothing else on the page has finished loading yet.
import { getSettings, updateSettings } from './settings.js';

const SKIP_KEY = 'rhombiverse-skip-intro';

// Migration Path Phase C (RHOMBIVERSE_PLAN.md): the same Rhombeometry
// choice render.js's Lab panel exposes, offered up front here too (per
// direct instruction -- both surfaces). settings.js is the single
// source of truth either way; picking a different mode than what's
// already active reloads immediately, since World Systems flags are
// only ever read once, at features.js's own module-eval time, and this
// overlay's own choice can otherwise race render.js's init() (loaded as
// a separate, unordered-relative-to-this <script type="module">).

// Same wireframe rhombic dodecahedron coordinates as favicon.svg --
// this project's own voxel shape (lattice.js's rdRawVerts: 8 cube verts
// at radius 0.5, 6 octa verts at radius 1.0), rotated to a non-axis-
// aligned angle and orthographically projected so no vertex overlaps
// another on screen, not generic art. Kept as a plain coordinate list
// here (rather than re-deriving via lattice.js at runtime) since it's
// static presentation geometry, not gameplay math.
//
// 2026-08-23: a same-day redraw at a different rotation with explicit
// vertex-dot circles was reverted -- direct feedback that it read as
// "too different" from the reference image and that the dots read as
// unwanted "explicit round nodes." Checked numerically against the
// reference (pixel-sampled vertex positions and stroke color) and this
// original rotation/color were already a close match; the dots (not
// the geometry) were the actual mismatch. So: original coordinates
// unchanged, dot circles removed, lines rely on stroke-linecap="round"
// alone for the soft vertex look the reference has.
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

// Fallback only -- shown until loadLatestUpdate() resolves, or if the
// fetch fails outright (offline, localStorage-only dev server oddity).
// The real tagline is always sourced from data/changelog.json's newest
// entry's OWN TITLE ONLY (see init()) -- not hand-maintained here, so
// it can't go stale the way a hardcoded line already had (2026-08-23,
// direct request: "welcome should be based on changelog"). Title only,
// not title + lead item, per direct feedback that the first attempt
// (which appended the item text) read as too wordy and too negatively
// framed for a first-impression line -- the changelog panel itself is
// still the place for that fuller, more detailed wording.
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

// Fetched fire-and-forget from init() below -- built synchronously with
// FALLBACK_TAGLINE first (same reasoning as changelog.js's own overlay:
// don't block the welcome card's very first paint on a network/disk
// round-trip), then patched in place once this resolves.
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

  // "Consider making the four personas clickable... letting a new player
  // pick 'Rhombiologist' and land with the grow wheel open would complete
  // the onboarding arc" -- render.js (loaded independently of this file,
  // see the header comment above) listens for this and does the actual
  // mode/panel switching; this module only knows DOM/localStorage, never
  // world state, so it can't do that part itself.
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
    // localStorage unavailable (private browsing, quota) -- default to
    // showing the intro rather than failing closed.
  }
  if (skip) {
    hide();
  } else {
    show();
  }
}

init();
