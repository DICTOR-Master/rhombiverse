// First-run welcome/entry overlay: rotating RD logo with a static
// integrated "ENTER" label, Mode choice, legal-doc links. Purely a
// DOM/localStorage concern, independent of render.js/world state. Full
// design rationale/history: docs/code-notes/app/welcome.md
import { getSettings, updateSettings } from './settings.js';
import { buildRDFaces } from './rhombic-wheel-3d-core.js';

const SKIP_KEY = 'rhombiverse-skip-intro';

// Migration Path Phase C's Rhombeometry/Full World mode choice -- see
// companion doc for why picking a different mode reloads immediately.

// --- Geometry: real 3D RD wireframe, built from the SAME shared source as
// the Rhombic Wheel 3D / HUD Wheel (buildRDFaces()) -- see companion doc.
// Plain vertex math, no THREE/WebGL: render.js's own main renderer is
// already running behind this overlay, and a second simultaneous full
// WebGL render is a real, already-fixed perf mistake in this codebase --
// see hud-wheel-3d.js's header.

const RD_FACES = buildRDFaces();

function buildRDEdges() {
  const seen = new Map();
  for (const face of RD_FACES) {
    const v = face.verts;
    for (let i = 0; i < v.length; i++) {
      const a = v[i], b = v[(i + 1) % v.length];
      const key = [a, b].sort().join('|'); // undirected, dedupes the two faces sharing this edge
      if (!seen.has(key)) seen.set(key, [a, b]);
    }
  }
  return [...seen.values()];
}
const RD_EDGES_3D = buildRDEdges();

// ENTER: history of how this got here, briefly --
//  - Originally a fixed button below the logo; direct feedback
//    2026-08-26 said that read "too similar to the old version," so it
//    became two antipodal faces on the rotating RD itself that lit up
//    (an opalescent glow fill) as they swung toward the viewer.
//  - Entry-flow audit 2026-09-02 found that real: those faces were only
//    clickable while actually facing the viewer, with no visible hint
//    that a plain Enter keypress worked at any time. Fixed by adding a
//    second, large, POSITION-STATIC "ENTER" label centered over the
//    logo -- always visible, always clickable, no facing/timing gate.
//  - Direct follow-up feedback, same day: the swinging opalescent glow
//    faces were no longer needed once the static label became the real
//    entry point, so they're gone entirely now -- the RD just rotates
//    as a plain wireframe logo, and the static label is the only ENTER
//    affordance. This keeps ENTER "on the shape" in spirit (it's
//    centered on the logo, not a separately-positioned button) without
//    any per-face geometry/winding/normal-facing machinery at all.

const LOGO_SCALE = 30; // RD vertices have max norm 2 -- 30 keeps the whole shape inside the viewBox below with margin
const LOGO_TILT = 0.5; // fixed static tilt (radians) so the auto-rotate never looks like a flat side-on view
// rad/SECOND, not rad/frame -- driven by real elapsed time in startLogoSpin
// below, not a frame counter. This Pi doesn't hold 60fps once render.js's
// own WebGL scene is also live behind the overlay; a fixed rad/frame step
// (the first version of this code) made the spin track actual frame rate
// instead of wall-clock time -- confirmed via a real Playwright probe.
// rad/second keeps the spin's real-world pace correct regardless of how
// many frames the machine actually manages.
const SPIN_SPEED = 0.48; // ~13s/revolution
const PULSE_SPEED = 3.0; // ~2.1s breathing cycle, independent of spin -- an attention cue on the static ENTER label

function rotateX([x, y, z], a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [x, y * c - z * s, y * s + z * c];
}
function rotateY([x, y, z], a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [x * c + z * s, y, -x * s + z * c];
}
function transform(p, angle) { return rotateY(rotateX(p, LOGO_TILT), angle); }

function logoSvg() {
  const lines = RD_EDGES_3D.map((_, i) => `<line class="rd-edge" data-i="${i}" />`).join('');
  return `
    <svg id="welcome-logo-svg" viewBox="-70 -70 140 140" width="180" height="180" role="img" aria-label="Rhombiverse logo: a rotating wireframe rhombic dodecahedron. Click ENTER, centered on the logo, to begin.">
      <g stroke="#7cf" stroke-width="1.5" stroke-linecap="round" fill="none">${lines}</g>
      <!-- Static ENTER label: fixed at the SVG's own center, outside the
           rotating group above, so it never turns or tilts with the RD.
           Always full pointer-events -- clicking it never depends on
           rotation phase. A gentle opacity breathe (driven by pulsePhase
           in startLogoSpin) is the only animation it gets. -->
      <text id="static-enter-label" x="0" y="1" text-anchor="middle" dominant-baseline="central"
            font-family="system-ui, sans-serif" font-weight="800" font-size="19" letter-spacing="1.5"
            fill="#eafcff" style="cursor:pointer"
            stroke="#04141c" stroke-width="2.5" paint-order="stroke">ENTER</text>
    </svg>`;
}

// Recomputed every animation frame while the overlay is visible; started/
// stopped by show()/hide() below rather than left running once dismissed.
// `onEnterHit` fires on a click of the static center label -- always,
// regardless of rotation phase. See the module header for ENTER's history.
function startLogoSpin(onEnterHit) {
  const svg = document.getElementById('welcome-logo-svg');
  if (!svg) return () => {};
  const edgeEls = svg.querySelectorAll('.rd-edge');
  const staticLabel = document.getElementById('static-enter-label');
  let raf = null;
  let angle = 0;
  let pulsePhase = 0;
  let lastT = null;

  function frame(t) {
    // Clamp dt: a tab-switch/GC pause shouldn't make the shape jump --
    // just resume the same real-time pace from wherever it left off.
    const dt = lastT === null ? 0 : Math.min(0.1, (t - lastT) / 1000);
    lastT = t;
    angle += SPIN_SPEED * dt;
    pulsePhase += PULSE_SPEED * dt;

    edgeEls.forEach((el, i) => {
      const [a, b] = RD_EDGES_3D[i];
      const [ax, ay] = transform(a, angle);
      const [bx, by] = transform(b, angle);
      el.setAttribute('x1', ax * LOGO_SCALE);
      el.setAttribute('y1', ay * LOGO_SCALE);
      el.setAttribute('x2', bx * LOGO_SCALE);
      el.setAttribute('y2', by * LOGO_SCALE);
    });

    // Static label: fixed position (set once, never touched here), just
    // a gentle always-substantially-visible breathe for attention --
    // never drops low enough to read as "off", and pointer-events stays
    // 'auto' unconditionally (set once below, not per frame).
    if (staticLabel) staticLabel.setAttribute('fill-opacity', String(0.82 + 0.18 * Math.sin(pulsePhase)));

    raf = requestAnimationFrame(frame);
  }
  const listeners = [];
  if (staticLabel) {
    staticLabel.style.pointerEvents = 'auto';
    const onStaticClick = () => onEnterHit();
    staticLabel.addEventListener('click', onStaticClick);
    listeners.push({ el: staticLabel, onClick: onStaticClick });
  }
  raf = requestAnimationFrame(frame);
  return () => {
    if (raf !== null) cancelAnimationFrame(raf);
    listeners.forEach(({ el, onClick }) => el.removeEventListener('click', onClick));
  };
}

// Shown until loadLatestUpdate() resolves; real tagline is always the
// newest data/changelog.json entry's title -- see companion doc.
const FALLBACK_TAGLINE = 'One shape. Everything grows from it.';

function overlayHtml() {
  return `
    <div id="welcome-card">
      <h1>Rhombiverse</h1>
      <p class="tagline" id="welcome-tagline">${FALLBACK_TAGLINE}</p>
      ${logoSvg()}
      <div class="mode-choice">
        <div class="mode-choice-prompt">Mode:</div>
        <button type="button" class="mode-choice-btn" data-mode="pure" id="mode-choice-pure">Pure Rhombeometry</button>
        <button type="button" class="mode-choice-btn" data-mode="full" id="mode-choice-full">Full World</button>
      </div>
      <label class="dont-show">
        <input type="checkbox" id="skip-intro-checkbox" />
        Don't show this again on this device
      </label>
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

  let stopLogoSpin = () => {};

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
    stopLogoSpin();
    stopLogoSpin = startLogoSpin(enterWorld);
  }
  function hide() {
    overlay.style.display = 'none';
    stopLogoSpin();
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

  function enterWorld() {
    persistSkipChoice();
    hide();
  }

  // Keyboard fallback -- the static ENTER label is always clickable, but
  // a literal Enter keypress works too, for anyone who reaches for the
  // keyboard instead of the mouse/touch. Only acts while the overlay is
  // actually shown.
  window.addEventListener('keydown', (e) => {
    if (overlay.style.display === 'none') return;
    if (e.code === 'Enter' || e.code === 'NumpadEnter') {
      e.preventDefault();
      enterWorld();
    }
  });

  aboutBtn.addEventListener('click', show);

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
