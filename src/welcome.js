// First-run welcome/entry overlay: logo, plain-language description, and
// links to the legal docs every small public web app carries
// (TERMS.md/PRIVACY.md/SECURITY.md, already written for Phase 4's public
// deploy -- see CLAUDE.md). No "under construction" framing (dropped
// 2026-08-19 -- undermined trust/permanence per user feedback). Purely a DOM/
// localStorage concern, deliberately independent of render.js/world
// state -- this can run (and the game can be dismissed into) even if
// nothing else on the page has finished loading yet.
const SKIP_KEY = 'rhombiverse-skip-intro';

// Same wireframe rhombic dodecahedron coordinates as favicon.svg --
// this project's own voxel shape (lattice.js's rdRawVerts: 8 cube verts
// at radius 0.5, 6 octa verts at radius 1.0), rotated to a non-axis-
// aligned angle and orthographically projected so no vertex overlaps
// another on screen, not generic art. Kept as a plain coordinate list
// here (rather than re-deriving via lattice.js at runtime) since it's
// static presentation geometry, not gameplay math. Redrawn 2026-08-23
// (rx=20 ry=40 rz=30 around the same real cube/octa vertex set, direct
// reference image) to a shallower, more oblique angle with muted/
// uniform-weight styling -- less "bright icon," more technical diagram.
const RD_EDGES = [
  [-20.99, 25.56, -25.83, 14.91], [-20.99, 25.56, 10.88, 35.97], [-20.99, 25.56, -27.03, 0.23],
  [6.04, 25.33, -25.83, 14.91], [6.04, 25.33, 10.88, 35.97], [6.04, 25.33, 27.03, -0.23],
  [-31.87, -10.41, -25.83, 14.91], [-31.87, -10.41, -10.88, -35.97], [-31.87, -10.41, -27.03, 0.23],
  [-4.84, -10.64, -25.83, 14.91], [-4.84, -10.64, -10.88, -35.97], [-4.84, -10.64, 27.03, -0.23],
  [4.84, 10.64, 25.83, -14.91], [4.84, 10.64, 10.88, 35.97], [4.84, 10.64, -27.03, 0.23],
  [31.87, 10.41, 25.83, -14.91], [31.87, 10.41, 10.88, 35.97], [31.87, 10.41, 27.03, -0.23],
  [-6.04, -25.33, 25.83, -14.91], [-6.04, -25.33, -10.88, -35.97], [-6.04, -25.33, -27.03, 0.23],
  [20.99, -25.56, 25.83, -14.91], [20.99, -25.56, -10.88, -35.97], [20.99, -25.56, 27.03, -0.23],
];
const RD_CUBE_VERTS = [
  [-20.99, 25.56], [6.04, 25.33], [-31.87, -10.41], [-4.84, -10.64],
  [4.84, 10.64], [31.87, 10.41], [-6.04, -25.33], [20.99, -25.56],
];
const RD_OCTA_VERTS = [
  [25.83, -14.91], [-25.83, 14.91], [-10.88, -35.97], [10.88, 35.97], [27.03, -0.23], [-27.03, 0.23],
];

function logoSvg() {
  const lines = RD_EDGES.map(([x1, y1, x2, y2]) => `<path d="M ${x1} ${y1} L ${x2} ${y2}" />`).join('');
  const cubeDots = RD_CUBE_VERTS.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.6" />`).join('');
  const octaDots = RD_OCTA_VERTS.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.0" />`).join('');
  return `
    <svg viewBox="-45 -45 90 90" width="110" height="110" role="img" aria-label="Rhombiverse logo: a wireframe rhombic dodecahedron">
      <g stroke="#6fb3d9" stroke-width="1.0" stroke-linecap="round" fill="none">${lines}</g>
      <g fill="#9fd0ec">${cubeDots}</g>
      <g fill="#6fb3d9">${octaDots}</g>
    </svg>`;
}

// Fallback only -- shown until loadLatestUpdate() resolves, or if the
// fetch fails outright (offline, localStorage-only dev server oddity).
// The real tagline is always sourced from data/changelog.json's newest
// entry (see init()), not hand-maintained here, so it can't go stale
// the way a hardcoded line already had (2026-08-23, direct request:
// "welcome should be based on changelog").
const FALLBACK_TAGLINE = 'A browser-based instrument for exploring and sculpting space with rhombic dodecahedra.';

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
          <div class="identity-item" data-persona="rhombiologist" role="button" tabindex="0"><strong>Rhombiologist</strong> -- grow real, evolving life</div>
        </div>
      </div>
      <p class="quickstart"><strong>Tab</strong> / <strong>Space</strong> opens the Rhombic Wheel. Click a face to build, right-click to remove -- or open Sculpt for symmetry tools, no World required. Export your World anytime to keep a copy.</p>
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
    const lead = entry.items?.[0] ?? '';
    tagline.innerHTML = lead
      ? `<strong>${entry.title}</strong> -- ${lead}`
      : entry.title;
  });

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
