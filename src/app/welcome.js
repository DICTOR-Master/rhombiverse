// First-run welcome/entry overlay: rotating RD logo with an integrated
// "ENTER" face, Mode choice, legal-doc links. Purely a DOM/localStorage
// concern, independent of render.js/world state. Full design rationale/
// history: docs/code-notes/app/welcome.md
import { getSettings, updateSettings } from './settings.js';
import { buildRDFaces } from './rhombic-wheel-3d-core.js';

const SKIP_KEY = 'rhombiverse-skip-intro';

// Migration Path Phase C's Rhombeometry/Full Game World mode choice -- see
// companion doc for why picking a different mode reloads immediately.

// --- Geometry: real 3D RD wireframe, built from the SAME shared source as
// the Rhombic Wheel 3D / HUD Wheel (buildRDFaces()) -- see companion doc.
// Plain vertex math, no THREE/WebGL: render.js's own main renderer is
// already running behind this overlay, and a second simultaneous full
// WebGL render is a real, already-fixed perf mistake in this codebase --
// see hud-wheel-3d.js's header.

function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function norm(a) { const m = Math.hypot(...a); return m ? [a[0] / m, a[1] / m, a[2] / m] : a; }
function centroidOf(verts) {
  const c = [0, 0, 0];
  for (const v of verts) { c[0] += v[0]; c[1] += v[1]; c[2] += v[2]; }
  return c.map((x) => x / verts.length);
}

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

// The ENTER faces -- two antipodal rhombi double as the entry button,
// rather than a separately-positioned button below the logo. Direct
// feedback 2026-08-26: a fixed ENTER button read as "too similar to the
// old version"; the ask was for ENTER to live ON the rotating shape
// itself, appearing as a face swings toward the viewer. `top`-ring faces
// (not equator) per direct feedback -- they project as the upright,
// vertically-aligned diamond as they approach/leave the logo's central
// position (checked numerically: these also hit the highest peak
// facing-the-viewer value of all 12 faces under the fixed LOGO_TILT,
// ~0.96 vs equator faces' ~0.78). Both true geometric antipodes (RD is
// centered at the origin, so negating a face's own verts/centroid/normal
// gives its exact opposite) are lit up, not just one, per direct feedback
// ("double the opportunity to enter") -- each swings into view once per
// half-revolution instead of once per full one.
function prepareEnterFace(face) {
  let verts = face.verts;
  const centroid = centroidOf(verts);
  // Outward winding: for an origin-centered convex shape, a face's own
  // centroid vector already points outward, so a normal that agrees with
  // it is correctly wound (same technique as rhombic-wheel-3d-core.js's
  // ensureOutwardWinding, in plain arrays here since this file
  // deliberately has no THREE dependency -- see header above).
  let normal = cross(sub(verts[1], verts[0]), sub(verts[3], verts[0]));
  if (dot(normal, centroid) < 0) {
    verts = verts.slice().reverse();
    normal = cross(sub(verts[1], verts[0]), sub(verts[3], verts[0]));
  }
  return { verts, centroid, normal: norm(normal) };
}
const TOP_ENTER_FACE = RD_FACES.find((f) => f.ring === 'top' && f.sy === 1 && f.sz === 1);
const ENTER_FACES = [
  prepareEnterFace(TOP_ENTER_FACE),
  prepareEnterFace({ verts: TOP_ENTER_FACE.verts.map(([x, y, z]) => [-x, -y, -z]) }), // true antipode
];

const LOGO_SCALE = 30; // RD vertices have max norm 2 -- 30 keeps the whole shape inside the viewBox below with margin
const LOGO_TILT = 0.5; // fixed static tilt (radians) so the auto-rotate never looks like a flat side-on view
// rad/SECOND, not rad/frame -- driven by real elapsed time in startLogoSpin
// below, not a frame counter. This Pi doesn't hold 60fps once render.js's
// own WebGL scene is also live behind the overlay; a fixed rad/frame step
// (the first version of this code) made the spin (and therefore the ENTER
// face's approach) track actual frame rate instead of wall-clock time --
// confirmed via a real Playwright probe: fill-opacity barely moved in 14
// real seconds. rad/second keeps the spin's real-world pace correct
// regardless of how many frames the machine actually manages.
const SPIN_SPEED = 0.48; // ~13s/revolution
const PULSE_SPEED = 3.0; // ~2.1s breathing cycle, independent of spin -- an attention cue on the ENTER face itself

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
  const enterEls = ENTER_FACES.map((_, i) => `
      <polygon id="enter-face-poly-${i}" fill="#7cf" fill-opacity="0" stroke="#bfe6ff" stroke-width="1.5" stroke-opacity="0" />
      <text id="enter-face-label-${i}" x="0" y="0" text-anchor="middle" dominant-baseline="central"
            font-family="system-ui, sans-serif" font-weight="700" font-size="10.5" letter-spacing="0.6"
            fill="#eafcff" fill-opacity="0">ENTER</text>`).join('');
  return `
    <svg id="welcome-logo-svg" viewBox="-70 -70 140 140" width="180" height="180" role="img" aria-label="Rhombiverse logo: a rotating wireframe rhombic dodecahedron, two opposite faces doubling as Enter">
      <g stroke="#7cf" stroke-width="1.5" stroke-linecap="round" fill="none">${lines}</g>${enterEls}
    </svg>`;
}

// Recomputed every animation frame while the overlay is visible; started/
// stopped by show()/hide() below rather than left running once dismissed.
// `onEnterHit` fires on a click while either ENTER face is actually
// toward the viewer -- see the module header for why ENTER lives here
// instead of a separately-positioned button, and for why there are two.
function startLogoSpin(onEnterHit) {
  const svg = document.getElementById('welcome-logo-svg');
  if (!svg) return () => {};
  const edgeEls = svg.querySelectorAll('.rd-edge');
  const enterEls = ENTER_FACES.map((f, i) => ({
    face: f,
    poly: document.getElementById(`enter-face-poly-${i}`),
    label: document.getElementById(`enter-face-label-${i}`),
    active: false,
  }));
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

    for (const e of enterEls) {
      const tVerts = e.face.verts.map((p) => transform(p, angle));
      const tNormal = transform(e.face.normal, angle);
      const tCentroid = transform(e.face.centroid, angle);
      // Orthographic drop-z projection: the viewer sits on +Z looking
      // toward the origin, so a rotated normal's own z-component IS how
      // much this face currently faces them (1 = dead-on, 0 = edge-on,
      // negative = away).
      const facing = tNormal[2];
      // Ramped, not linear -- the face reads as "off" for most of its
      // swing and only lights up on the final approach, instead of a
      // faint hint the whole time it's in view.
      const sweep = Math.max(0, Math.min(1, (facing - 0.2) / 0.6));
      // Pulsing/breathing per direct feedback 2026-08-26 ("enter script
      // appears and fades pulsing") -- multiplies the sweep rather than
      // replacing it, so it only breathes while genuinely the front
      // face, not throughout its whole approach/departure.
      const breathe = 0.6 + 0.4 * Math.sin(pulsePhase);
      const opacity = sweep * breathe;

      e.poly.setAttribute('points', tVerts.map(([x, y]) => `${x * LOGO_SCALE},${y * LOGO_SCALE}`).join(' '));
      // Full wireframe has no hidden-line removal (every edge, front and
      // back, is always drawn -- see buildRDEdges' header), so a subtle
      // fill read as visual clutter rather than a clear "this face is
      // lit up" cue; a stronger fill + a thickening stroke makes the
      // active face unambiguous against the busier crossing lines
      // behind/around it.
      e.poly.setAttribute('fill-opacity', String(opacity * 0.55));
      e.poly.setAttribute('stroke-opacity', String(opacity));
      e.poly.setAttribute('stroke-width', String(1.5 + 1.5 * opacity));
      e.label.setAttribute('x', String(tCentroid[0] * LOGO_SCALE));
      e.label.setAttribute('y', String(tCentroid[1] * LOGO_SCALE));
      e.label.setAttribute('fill-opacity', String(opacity));

      e.active = sweep > 0.35;
      e.poly.style.pointerEvents = e.active ? 'auto' : 'none';
      e.label.style.pointerEvents = e.active ? 'auto' : 'none';
      e.poly.style.cursor = e.active ? 'pointer' : 'default';
      e.label.style.cursor = e.active ? 'pointer' : 'default';
    }

    raf = requestAnimationFrame(frame);
  }
  const listeners = [];
  for (const e of enterEls) {
    const onClick = () => { if (e.active) onEnterHit(); };
    e.poly.addEventListener('click', onClick);
    e.label.addEventListener('click', onClick);
    listeners.push({ el: e.poly, onClick }, { el: e.label, onClick });
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
        <button type="button" class="mode-choice-btn" data-mode="full" id="mode-choice-full">Full Game World</button>
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

  // Keyboard fallback -- the ENTER face is only clickable while it's
  // actually facing the viewer, so a literal Enter keypress is the
  // reliable path when it's mid-swing. Only acts while the overlay is
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
