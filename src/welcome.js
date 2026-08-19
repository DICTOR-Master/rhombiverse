// First-run welcome/entry overlay: logo, plain-language description, an
// under-construction disclaimer, and links to the legal docs every small
// public web app carries (TERMS.md/PRIVACY.md/SECURITY.md, already
// written for Phase 4's public deploy -- see CLAUDE.md). Purely a DOM/
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
// static presentation geometry, not gameplay math.
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
const RD_CUBE_VERTS = [
  [-29.48, 20.83], [-3.62, 8.43], [-29.48, -18.12], [-3.62, -30.51],
  [3.62, 30.51], [29.48, 18.12], [3.62, -8.43], [29.48, -20.83],
];
const RD_OCTA_VERTS = [
  [33.10, 9.69], [-33.10, -9.69], [0.00, -38.94], [0.00, 38.94], [25.86, -12.40], [-25.86, 12.40],
];

function logoSvg() {
  const lines = RD_EDGES.map(([x1, y1, x2, y2]) => `<path d="M ${x1} ${y1} L ${x2} ${y2}" />`).join('');
  const cubeDots = RD_CUBE_VERTS.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.4" />`).join('');
  const octaDots = RD_OCTA_VERTS.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4.4" />`).join('');
  return `
    <svg viewBox="-45 -45 90 90" width="110" height="110" role="img" aria-label="Rhombiverse logo: a wireframe rhombic dodecahedron">
      <g stroke="#7cf" stroke-width="1.6" stroke-linecap="round" fill="none">${lines}</g>
      <g fill="#bde6ff">${cubeDots}</g>
      <g fill="#7cf">${octaDots}</g>
    </svg>`;
}

function overlayHtml() {
  return `
    <div id="welcome-card">
      ${logoSvg()}
      <h1>Rhombiverse</h1>
      <div class="construction-badge">🚧 Under Construction 🚧</div>
      <p class="tagline">Explore Rhombiverse. Explore yourself.</p>
      <div class="identity-block">
        <div class="identity-prompt">Who are you here?</div>
        <div class="identity-grid">
          <div class="identity-item" data-persona="rhombinaut" role="button" tabindex="0"><strong>Rhombinaut</strong> -- walk your worlds</div>
          <div class="identity-item" data-persona="rhombitect" role="button" tabindex="0"><strong>Rhombitect</strong> -- build whole planets</div>
          <div class="identity-item" data-persona="rhombisculptor" role="button" tabindex="0"><strong>Rhombisculptor</strong> -- model, chisel, create</div>
          <div class="identity-item" data-persona="rhombiologist" role="button" tabindex="0"><strong>Rhombiologist</strong> -- grow real, evolving life</div>
        </div>
      </div>
      <p class="quickstart"><strong>Tab</strong> / <strong>Space</strong> opens the Rhombic Wheel. Click a face to build, right-click to remove.</p>
      <div class="construction-notice">
        🚧 The future is under construction. So are you. Things may
        change or reset -- <strong>Export JSON</strong> to keep what you
        love. 🚧
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

function init() {
  const overlay = document.createElement('div');
  overlay.id = 'welcome-overlay';
  overlay.innerHTML = overlayHtml();
  document.body.appendChild(overlay);

  const aboutBtn = document.createElement('button');
  aboutBtn.id = 'about-btn';
  aboutBtn.type = 'button';
  aboutBtn.title = 'About Rhombiverse';
  aboutBtn.textContent = 'ℹ';
  document.body.appendChild(aboutBtn);

  // Persistent, low-key echo of the welcome card's own construction
  // badge -- the disclaimer stays visible during actual play, not just
  // on the one-time intro, without competing with the build controls.
  const constructionTag = document.createElement('div');
  constructionTag.id = 'construction-tag';
  constructionTag.textContent = '🚧 Under Construction';
  constructionTag.title = 'This world is a work in progress -- things may change or reset.';
  document.body.appendChild(constructionTag);

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
