// Dimension-select wizard (2026-09-22): the app's real entry gate --
// force-opened once on every load (see render.js's init(), right after
// this module's factory is called) and reachable again any time via the
// Home wheel's "Change Dimension" face. Picks which dimension tier
// (2D/3D/4D/5D/6D) you're building in, then which lattice family within
// it is active first (families coexist once inside -- this only sets the
// default, same as picking a piece from the existing Piece wheel today).
//
// Direct correction, same session: an earlier draft put this ON the
// Rhombic Wheel itself (a WHEEL_DIMENSION/WHEEL_LATTICE_3D config pair in
// rhombic-wheel-3d-core.js). "As in polyhedraverse one list two routes" --
// polyhedraverse keeps its wheel (PolyhedralWheel) and its card list
// (ShapeBrowser) as two deliberately SEPARATE surfaces, not one folded
// into the other (confirmed directly against polyhedraverse's own
// page.tsx wiring). This is rhombiverse's own version of that list: a
// real wireframe-card overlay, structurally the almanac.js factory
// pattern (create*() -> {open,close,toggle}, CSS injected once, not
// welcome.js's simpler self-mounting <script> pattern -- this has no
// dedicated always-visible trigger button of its own, same reasoning
// almanac.js's own header already gives). "The wheel has breakdown
// family shapes as in 3D currently" -- the wheel keeps doing exactly
// what it already does (Piece -> RD Family), untouched; this file is the
// ONLY place dimension/family selection itself lives now.
//
// "Wheel has simplified 2D symbol shapes [and the] wizard has
// wireframes" -- direct distinction from the same conversation: this
// file's previews are real wireframe line drawings (plain SVG, no THREE/
// WebGL -- a second simultaneous full WebGL render alongside render.js's
// own main scene is a real, already-fixed perf mistake in this codebase,
// see welcome.js's own header), NOT wheel-icons.js's hand-authored
// symbol marks -- a different, more literal visual language for a
// different job (browsing/picking real geometry vs. a compact nav icon).
//
// "Simplicity is key... when all primitives are available, the UI
// should close everything down to simple selections with no extraneous
// out of scope steps visible" -- direct instruction. Only 3D is real in
// Phase 1: its card is the only clickable one, with a real wireframe and
// real description; 2D/4D/5D/6D render dark/disabled, label only, no
// fabricated preview of geometry that doesn't exist yet (matches this
// project's own standing "disclose departures honestly" principle,
// RHOMBIVERSE_PRINCIPLES.md section 0 -- a confident-looking wireframe
// for content that isn't built would be exactly the kind of oversold
// claim that principle already had to correct once, for 4D/6D). As each
// tier actually ships, flip its DIMENSIONS entry below from disabled to
// real -- no other structural change needed.
import { buildRDFaces } from './rhombic-wheel-3d-core.js';
import { truncatedOctahedronVertices } from '../geometry-extensions/dual-lattice.js';

const CSS = `
.dim-wizard-overlay {
  display: none;
  position: fixed; inset: 0; z-index: 991;
  align-items: center; justify-content: center;
  background: rgba(5, 5, 10, 0.92);
  backdrop-filter: blur(2px);
  padding: 24px 12px;
  box-sizing: border-box;
}
.dim-wizard-overlay.open { display: flex; }
.dim-wizard-card {
  width: 100%; max-width: 560px; max-height: 88vh;
  overflow-y: auto;
  color: #ddd; font: 14px/1.5 system-ui, sans-serif;
  background: rgba(15, 15, 25, 0.97);
  border: 1px solid rgba(124, 204, 255, 0.35);
  border-radius: 10px;
  padding: 18px 22px 22px;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.6);
}
.dim-wizard-header {
  display: flex; align-items: center; justify-content: space-between;
  font: 700 16px system-ui, sans-serif;
  color: #9de0ff;
  margin-bottom: 4px;
}
.dim-wizard-close { background: none; border: none; color: #9de0ff; cursor: pointer; font: 15px system-ui, sans-serif; }
.dim-wizard-back {
  background: none; border: none; color: #9de0ff; cursor: pointer;
  font: 13px system-ui, sans-serif; padding: 0; margin-bottom: 10px;
}
.dim-wizard-sub { color: #99a; font-size: 12px; margin-bottom: 14px; }
/* A vertical LIST of rows (like polyhedraverse's own family tabs/list),
   not a box grid -- direct correction, same session: "each dimension is
   lists like polyhedraverse not boxes"/"run through a list with all
   dimensions like polyhedra families." */
.dim-wizard-grid {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.dim-wizard-card-btn {
  display: flex; flex-direction: row; align-items: center; gap: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(124, 204, 255, 0.3);
  border-radius: 8px;
  padding: 8px 12px;
  color: #eee;
  cursor: pointer;
  text-align: left;
  width: 100%;
}
.dim-wizard-card-btn:hover { background: rgba(124, 204, 255, 0.1); border-color: rgba(124, 204, 255, 0.6); }
.dim-wizard-card-btn.disabled {
  cursor: default;
  opacity: 0.38;
  border-style: dashed;
  border-color: rgba(255, 255, 255, 0.18);
}
.dim-wizard-card-btn.disabled:hover { background: rgba(255, 255, 255, 0.03); border-color: rgba(255, 255, 255, 0.18); }
.dim-wizard-preview { width: 40px; height: 40px; flex: 0 0 auto; }
.dim-wizard-row-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.dim-wizard-label { font: 700 13px system-ui, sans-serif; color: #fff; }
.dim-wizard-desc { font-size: 11px; color: #9ab; line-height: 1.35; }
`;

function injectCssOnce() {
  if (document.getElementById('dim-wizard-style')) return;
  const style = document.createElement('style');
  style.id = 'dim-wizard-style';
  style.textContent = CSS;
  document.head.appendChild(style);
}

// Generic wireframe-edge derivation for any vertex-transitive convex
// solid with uniform edge length -- both RD (rhombic dodecahedron: all
// 24 edges equal) and TO (truncated octahedron: all 36 edges equal) are
// real examples of this, so one small technique covers both real
// previews below without hand-authoring or hull-computing either one:
// find the minimum pairwise distance among the raw vertex list, then
// connect every pair that's at (within float tolerance of) that exact
// distance. Real, verifiable geometry, not an approximation.
function edgesByMinDistance(points) {
  const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  let minD2 = Infinity;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const d2 = dist2(points[i], points[j]);
      if (d2 < minD2) minD2 = d2;
    }
  }
  const eps = minD2 * 1e-6;
  const edges = [];
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      if (Math.abs(dist2(points[i], points[j]) - minD2) < eps) edges.push([points[i], points[j]]);
    }
  }
  return edges;
}

// Fixed, non-animated isometric-ish projection (unlike welcome.js's
// spinning logo -- these are small static card thumbnails, a spin per
// card would be visual noise, not clarity) -- rotate a bit on X then Y
// so no edge lands exactly edge-on, then a plain orthographic drop of Z.
const TILT_X = 0.5;
const TILT_Y = 0.6;
function project([x, y, z]) {
  const cx = Math.cos(TILT_X), sx = Math.sin(TILT_X);
  let y1 = y * cx - z * sx;
  let z1 = y * sx + z * cx;
  const cy = Math.cos(TILT_Y), sy = Math.sin(TILT_Y);
  let x1 = x * cy + z1 * sy;
  return [x1, y1];
}

function wireframeSvg(edges, scale) {
  const lines = edges.map(([a, b]) => {
    const [ax, ay] = project(a);
    const [bx, by] = project(b);
    return `<line x1="${(ax * scale).toFixed(2)}" y1="${(ay * scale).toFixed(2)}" x2="${(bx * scale).toFixed(2)}" y2="${(by * scale).toFixed(2)}" />`;
  }).join('');
  return `<svg class="dim-wizard-preview" viewBox="-40 -40 80 80" role="img" aria-hidden="true">
    <g stroke="#7cf" stroke-width="1.3" stroke-linecap="round" fill="none">${lines}</g>
  </svg>`;
}

// RD (FCC): reuses buildRDFaces()'s own 12-face list, deduped into
// edges the same way welcome.js's logo already does -- proven, no need
// for edgesByMinDistance here since the ordered face/vertex structure
// already gives real edges directly.
function rdWireframe() {
  const seen = new Map();
  for (const face of buildRDFaces()) {
    const v = face.verts;
    for (let i = 0; i < v.length; i++) {
      const a = v[i], b = v[(i + 1) % v.length];
      const key = [a, b].sort().join('|');
      if (!seen.has(key)) seen.set(key, [a, b]);
    }
  }
  return wireframeSvg([...seen.values()], 17);
}

// TO (BCC): no pre-built face/edge structure exists anywhere in this
// codebase for the truncated octahedron (only the raw ConvexGeometry
// point cloud dual-lattice.js's truncatedOctahedronVertices() already
// provides) -- edgesByMinDistance() derives its real 36 edges from that
// same point cloud rather than hand-authoring a second geometry source.
function toWireframe() {
  const points = truncatedOctahedronVertices(1);
  return wireframeSvg(edgesByMinDistance(points), 22);
}

// Square (2D tier): a real square prism, matching geometry-extensions/
// lattice-2d.js's own squareTileVerts EXACTLY (angle 90, 2 equal-length
// perpendicular vectors) -- direct correction 2026-09-23 reversed an
// earlier same-session rename to a 70-degree rhombus ("dont call square
// rhombus when its familiar name is square, this [is] geometry building
// not semantics"). A real, separate (non-square) Rhombus family is
// still planned, scheduled for after Triangular ships. NOT vertex-
// uniform-edge-length (the square's own side and the prism's height
// differ), so edgesByMinDistance()'s technique doesn't apply here the
// way it does for RD/TO above -- explicit topology instead, real corner
// coordinates, not guessed.
function squareWireframe() {
  const h = 0.5;
  const angleDeg = 90;
  const v0 = [1, 0];
  const v1 = [Math.cos((angleDeg * Math.PI) / 180), Math.sin((angleDeg * Math.PI) / 180)];
  const corners2d = [[0, 0], v0, [v0[0] + v1[0], v0[1] + v1[1]], v1];
  const cx = corners2d.reduce((s, p) => s + p[0], 0) / 4;
  const cy = corners2d.reduce((s, p) => s + p[1], 0) / 4;
  const shifted = corners2d.map(([x, y]) => [x - cx, y - cy]);
  const top = shifted.map(([x, y]) => [x, y, h]);
  const bot = shifted.map(([x, y]) => [x, y, -h]);
  const edges = [];
  for (let i = 0; i < 4; i++) {
    edges.push([top[i], top[(i + 1) % 4]]);
    edges.push([bot[i], bot[(i + 1) % 4]]);
    edges.push([top[i], bot[i]]);
  }
  return wireframeSvg(edges, 22);
}

// Hexagon (2D tier): a real hexagonal prism, matching geometry-extensions/
// hex-prism.js's own hexPrismVerts EXACTLY (vertices at 60k degrees,
// radius R=1, extruded by h) -- same "real corner coordinates, not
// guessed" discipline as squareWireframe above.
function hexagonWireframe() {
  const h = 0.5;
  const top = [];
  const bot = [];
  for (let k = 0; k < 6; k++) {
    const angle = (Math.PI / 3) * k;
    const x = Math.cos(angle);
    const y = Math.sin(angle);
    top.push([x, y, h]);
    bot.push([x, y, -h]);
  }
  const edges = [];
  for (let i = 0; i < 6; i++) {
    edges.push([top[i], top[(i + 1) % 6]]);
    edges.push([bot[i], bot[(i + 1) % 6]]);
    edges.push([top[i], bot[i]]);
  }
  return wireframeSvg(edges, 22);
}

// DIMENSIONS: the dimension-select screen's own 5 cards. Only `enabled`
// tiers get a real onOpen (advances to that tier's lattice screen) and a
// real wireframe; the rest are the honest, undecorated "planned, not
// built" treatment this file's own header explains.
const DIMENSIONS = [
  // Phase 2 (2026-09-22): Square shipped first, direct instruction
  // ("flat layer in the same 3D scene... start with Square"). Briefly
  // renamed Square to a 70-degree Rhombus same session ("why square for
  // 2D[,] all rhombi should be derived from same basic shape"), then
  // reverted just as directly ("dont call square rhombus when its
  // familiar name is square, this [is] geometry building not
  // semantics") -- a real, separate Rhombus family is still planned,
  // scheduled for after Triangular. Hexagon shipped next. Triangular
  // and the real Rhombi still planned -- desc says so honestly.
  { id: '2D', label: '2D', desc: 'Square and Hexagon (shipped) -- Triangular tiling and real Rhombi still planned.', enabled: true, preview: squareWireframe },
  { id: '3D', label: '3D', desc: 'FCC (Rhombic Dodecahedron) and BCC (Truncated Octahedron) -- this app’s existing lattice core.', enabled: true, preview: rdWireframe },
  { id: '4D', label: '4D', desc: 'Hypercubic (Tesseract) and D4 root lattice.', enabled: false },
  { id: '5D', label: '5D', desc: 'Decagonal quasicrystal.', enabled: false },
  { id: '6D', label: '6D', desc: 'Icosahedral quasicrystal.', enabled: false },
];

// LATTICE_FAMILIES_2D: 2D's own lattice-family screen. Same "reuse the
// existing real action, one tool one doorway" reasoning as
// LATTICE_FAMILIES_3D below. A real (non-square) Rhombus family belongs
// here too, once built -- deferred until after Triangular per direct
// instruction, not added yet.
const LATTICE_FAMILIES_2D = [
  { label: 'Square', desc: 'A flat layer of real square tiles -- own separate lattice, pinned to z=0 in this same scene.', action: 'tool:pieceType:square2d', preview: squareWireframe },
  { label: 'Hexagon', desc: 'A flat layer of real hexagon tiles -- same axial hex lattice as the 3D Hex Prism tier, own separate store, pinned to z=0 in this same scene.', action: 'tool:pieceType:hexagon2d', preview: hexagonWireframe },
];

// LATTICE_FAMILIES_3D: 3D's own lattice-family screen. Actions reuse
// WHEEL_PIECE's own real "tool:pieceType:rd"/"tool:pieceType:to" VERBATIM
// (not new actions) -- picking a family here does exactly what picking
// it from the Piece wheel already does, dispatched through render.js's
// own handleWheelAction (see createDimensionWizard's onSelectFamily
// param) -- "one tool, one doorway." Both stay fully reachable afterward
// via the normal Piece picker too (the confirmed "families coexist"
// decision -- this screen only sets which is active by default).
const LATTICE_FAMILIES_3D = [
  { label: 'FCC', desc: 'Rhombic Dodecahedron -- face-centered cubic, this app’s main World.', action: 'tool:pieceType:rd', preview: rdWireframe },
  // "The generic one" -- real, sourced fact (lattice-primitives.md,
  // citing Voronoi/Delaunay's parallelohedra classification): of 3D's 5
  // real parallelohedra (space-tiling-by-translation shapes), TO is the
  // sole "primitive"/generic one -- the "permutahedron" that generalizes
  // upward into every higher dimension. Worth surfacing here per that
  // doc's own suggestion, not invented.
  { label: 'BCC', desc: 'Truncated Octahedron -- body-centered cubic, a second nested lattice. The generic parallelohedron (“permutahedron”) -- the one that generalizes into every higher dimension.', action: 'tool:pieceType:to', preview: toWireframe },
];

export function createDimensionWizard({ onSelectFamily }) {
  injectCssOnce();

  const overlay = document.createElement('div');
  overlay.className = 'dim-wizard-overlay';
  overlay.innerHTML = `
    <div class="dim-wizard-card">
      <div class="dim-wizard-header"><span>Choose a Dimension</span><button type="button" class="dim-wizard-close">✕</button></div>
      <div class="dim-wizard-body"></div>
    </div>`;
  document.body.appendChild(overlay);
  const bodyEl = overlay.querySelector('.dim-wizard-body');

  function showDimensions() {
    let grid = '';
    for (const dim of DIMENSIONS) {
      const disabledCls = dim.enabled ? '' : ' disabled';
      const preview = dim.enabled ? dim.preview() : '';
      grid += `
        <button type="button" class="dim-wizard-card-btn${disabledCls}" data-dim="${dim.id}" ${dim.enabled ? '' : 'disabled title="Planned, not yet built."'}>
          ${preview}
          <span class="dim-wizard-row-text">
            <span class="dim-wizard-label">${dim.label}</span>
            <span class="dim-wizard-desc">${dim.desc}</span>
          </span>
        </button>`;
    }
    bodyEl.innerHTML = `<div class="dim-wizard-sub">Pick which dimension tier to build in.</div><div class="dim-wizard-grid">${grid}</div>`;
    bodyEl.querySelectorAll('.dim-wizard-card-btn:not(.disabled)').forEach((el) => {
      el.addEventListener('click', () => {
        const dim = el.dataset.dim;
        if (dim === '3D') showLattice3D();
        else if (dim === '2D') showLattice2D();
      });
    });
  }

  function showLattice2D() {
    let grid = '';
    for (const fam of LATTICE_FAMILIES_2D) {
      grid += `
        <button type="button" class="dim-wizard-card-btn" data-action="${fam.action}">
          ${fam.preview()}
          <span class="dim-wizard-row-text">
            <span class="dim-wizard-label">${fam.label}</span>
            <span class="dim-wizard-desc">${fam.desc}</span>
          </span>
        </button>`;
    }
    bodyEl.innerHTML = `
      <button type="button" class="dim-wizard-back">← Back</button>
      <div class="dim-wizard-sub">2D: pick which lattice family starts active.</div>
      <div class="dim-wizard-grid">${grid}</div>`;
    bodyEl.querySelector('.dim-wizard-back').addEventListener('click', showDimensions);
    bodyEl.querySelectorAll('.dim-wizard-card-btn[data-action]').forEach((el) => {
      el.addEventListener('click', () => {
        close();
        onSelectFamily('2D', el.dataset.action);
      });
    });
  }

  function showLattice3D() {
    let grid = '';
    for (const fam of LATTICE_FAMILIES_3D) {
      grid += `
        <button type="button" class="dim-wizard-card-btn" data-action="${fam.action}">
          ${fam.preview()}
          <span class="dim-wizard-row-text">
            <span class="dim-wizard-label">${fam.label}</span>
            <span class="dim-wizard-desc">${fam.desc}</span>
          </span>
        </button>`;
    }
    bodyEl.innerHTML = `
      <button type="button" class="dim-wizard-back">← Back</button>
      <div class="dim-wizard-sub">3D: pick which lattice family starts active (both stay reachable afterward via the Piece wheel).</div>
      <div class="dim-wizard-grid">${grid}</div>`;
    bodyEl.querySelector('.dim-wizard-back').addEventListener('click', showDimensions);
    bodyEl.querySelectorAll('.dim-wizard-card-btn[data-action]').forEach((el) => {
      el.addEventListener('click', () => {
        close();
        onSelectFamily('3D', el.dataset.action);
      });
    });
  }

  overlay.querySelector('.dim-wizard-close').addEventListener('click', () => close());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('open')) close();
  });

  function open() {
    showDimensions(); // always reset to the top-level dimension list on (re)open
    overlay.classList.add('open');
  }
  function close() {
    overlay.classList.remove('open');
  }

  return { open, close, get isOpen() { return overlay.classList.contains('open'); } };
}
