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
// file's previews are real wireframe line drawings (2D canvas, no THREE/
// WebGL -- a second simultaneous full WebGL render alongside render.js's
// own main scene is a real, already-fixed perf mistake in this codebase,
// see welcome.js's own header), NOT wheel-icons.js's hand-authored
// symbol marks -- a different, more literal visual language for a
// different job (browsing/picking real geometry vs. a compact nav icon).
//
// "Simplicity is key... when all primitives are available, the UI
// should close everything down to simple selections with no extraneous
// out of scope steps visible" -- direct instruction. All wording goes
// through i18n.js ('wiz.*' and 'cat.*'); lattice, piece and tile names
// stay English.
import { mountWireframePreview } from './wireframe-preview.js';
import { cellStructure, rotation4, matVec, project4, A4_FIRST } from '../geometry-extensions/lattice-4d.js';
import { START_LATTICE_ANGLE, LATTICE_PRIMITIVES, LATTICE_PRIMITIVE_IMPLS } from '../geometry-extensions/lattice-2d.js';
import { VALID_TRIPLES, unitTileVertices } from '../geometry-extensions/growth.js';
import { PRISM_HEIGHT } from '../geometry-extensions/quasicrystal.js';
import { loadCatalogue, findBySerial, pieceCount } from '../geometry-extensions/quasicrystal-catalogue.js';
import { t, tn } from './i18n.js';
import { getSettings } from './settings.js';

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
.dim-wizard-preview { width: 40px; height: 40px; flex: 0 0 auto; }
.dim-wizard-section { display: flex; flex-direction: column; gap: 2px; margin: 10px 0 2px; }
.dim-wizard-section:first-child { margin-top: 0; }
.dim-wizard-piece { margin-left: 14px; width: calc(100% - 14px); }
.dim-wizard-row-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.dim-wizard-label { font: 700 13px system-ui, sans-serif; color: #fff; }
.dim-wizard-desc { font-size: 11px; color: #9ab; line-height: 1.35; }
.dim-wizard-serial-row { display: flex; gap: 6px; margin-bottom: 4px; }
.dim-wizard-serial-row input {
  flex: 1; min-width: 0; font: 16px system-ui, sans-serif; color: #eee;
  background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(124, 204, 255, 0.35); border-radius: 8px; padding: 8px 10px;
}
.dim-wizard-serial-row button {
  font: 600 14px system-ui, sans-serif; color: #9de0ff; background: rgba(124, 204, 255, 0.12);
  border: 1px solid rgba(124, 204, 255, 0.45); border-radius: 8px; padding: 8px 16px; cursor: pointer;
}
.dim-wizard-fold {
  background: none; border: none; padding: 6px 0 2px; text-align: left; cursor: pointer; color: inherit; font: inherit; width: 100%;
}
.dim-wizard-serial-msg { min-height: 16px; font-size: 12px; color: #f9a; margin-bottom: 8px; }
`;

function injectCssOnce() {
  if (document.getElementById('dim-wizard-style')) return;
  const style = document.createElement('style');
  style.id = 'dim-wizard-style';
  style.textContent = CSS;
  document.head.appendChild(style);
}

// 2D lattice tier (Phase 3): one generic wireframe builder for all 12
// (angle, primitive) combinations, reusing geometry-extensions/
// lattice-2d.js's own real tileVerts functions DIRECTLY (via
// LATTICE_PRIMITIVE_IMPLS) rather than re-deriving the same corner math
// a second time here -- same "real corner coordinates, not guessed"
// discipline the old Square/Hexagon/Triangle wireframes each separately
// re-implemented, now guaranteed to match the real placed geometry
// exactly (a single source of truth, not 2 independently-hand-written
// copies of the same construction that could silently drift apart).
function lattice2dEdges(combo) {
  // Flat outline only (the tile's top face), flagged `coin` so the
  // preview spins it like a coin -- edge-on and back -- instead of
  // tumbling a 3D prism (direct request 2026-09-25: 2D previews "should
  // be 2D rotating and disappearing into edge like spinning coins").
  const impl = LATTICE_PRIMITIVE_IMPLS[combo.primitiveId];
  const verts = impl.tileVerts(combo.angleDeg, 1, 1);
  const top = verts.slice(0, verts.length / 2).map(([x, y]) => [x, y, 0]);
  const edges = top.map((p, i) => [p, top[(i + 1) % top.length]]);
  edges.coin = true;
  return edges;
}

// DIMENSIONS: the dimension-select screen's own 5 cards (descriptions:
// 'wiz.dim.<id>').
const DIMENSIONS = [
  // Phase 6 (2026-09-23): 3 real primitives (Parallelogram/Triangle/
  // Hexagon), each its own real store -- picking one here (or from
  // LATTICE_FAMILIES_2D below) just sets a starting default; the ACTUAL
  // angle control (4 named NAMED_LATTICE_ANGLES) lives entirely in
  // render.js's own persistent on-screen toggle panel now, not here --
  // direct correction ("the toggle should work for groups of cells...
  // it just needs to be able to do for real"): angle used to be baked
  // into which of 12 separate (angle, primitive) stores was active,
  // which meant toggling angle silently swapped to an unrelated store
  // instead of reshaping the one you'd actually built. See
  // lattice2dSeedCell's own header in render.js for the full incident.
  { id: '2D', label: '2D', preview: () => lattice2dEdges({ primitiveId: LATTICE_PRIMITIVES[0].id, angleDeg: START_LATTICE_ANGLE.angleDeg }) },
  { id: '3D', label: '3D', previewAction: 'tool:pieceType:rd' },
  { id: '4D', label: '4D', preview: () => edges4D('cell24') },
  { id: '5D', label: '5D', preview: () => edges5D() },
  { id: '6D', label: '6D', preview: () => edges6D() },
];

// 6D thumbnail: a prolate golden rhombohedron, the same tile world-quasicrystal.js
// places (growth.js's unit tile). Edges join corners one step apart.
function edges6D() {
  const v = unitTileVertices(VALID_TRIPLES.find((t) => t.type === 'acute').dirs);
  const c = [0, 1, 2].map((x) => v.reduce((s, p) => s + p[x], 0) / 8);
  const p = v.map((q) => q.map((x, i) => x - c[i]));
  const out = [];
  for (let a = 0; a < 8; a++) for (const bit of [1, 2, 4]) if (!(a & bit)) out.push([p[a], p[a | bit]]);
  return out;
}

// 5D thumbnail: a thick Penrose rhombus prism (72 degrees, edge 1,
// height PRISM_HEIGHT), the piece world-quasicrystal.js places.
function edges5D() {
  const a = (2 * Math.PI) / 5;
  const e1 = [1, 0, 0], e2 = [Math.cos(a), 0, Math.sin(a)], up = [0, PRISM_HEIGHT, 0];
  const v = [];
  for (const i of [0, 1]) for (const j of [0, 1]) for (const k of [0, 1]) v.push([0, 1, 2].map((x) => i * e1[x] + j * e2[x] + k * up[x]));
  const c = [0, 1, 2].map((x) => v.reduce((s, p) => s + p[x], 0) / 8);
  const p = v.map((q) => q.map((x, i) => x - c[i]));
  const out = [];
  for (let m = 0; m < 8; m++) for (const bit of [1, 2, 4]) if (!(m & bit)) out.push([p[m], p[m | bit]]);
  return out;
}

// LATTICE_FAMILIES_2D: 2D's own lattice-family screen. Same "reuse the
// existing real action, one tool one doorway" reasoning as
// LATTICES_3D below. Phase 6: one row per LATTICE_PRIMITIVES
// entry (3, not 12) -- picking one here just sets which primitive
// starts active; its own angle defaults to START_LATTICE_ANGLE
// (Triangular) and from there is controlled entirely by render.js's own
// persistent toggle panel, not by anything on this screen. Action is
// 'tool:pieceType:lattice2d:<primitiveId>', matching core/build.js's
// own `lattice2d` param and render.js's dimensionAllowsMesh's own
// 'lattice2d:' prefix check exactly.
const LATTICE_FAMILIES_2D = LATTICE_PRIMITIVES.map((primitive) => ({
  id: primitive.id,
  label: primitive.label,
  action: `tool:pieceType:lattice2d:${primitive.id}`,
  preview: () => lattice2dEdges({ primitiveId: primitive.id, angleDeg: START_LATTICE_ANGLE.angleDeg }),
}));

// LATTICES_3D (wizard parity, 2026-09-24): direct decision -- "every
// piece listed under the lattice it inhabits", wireframes in the wizard,
// symbols on the wheels. Each lattice is a section header; each piece
// under it is its own row, dispatching the SAME action its wheel face
// already uses. Wireframes are NOT built here: render.js supplies each
// piece's edges from its own real placed geometry (createDimensionWizard's
// pieceEdges param -- the same geometry + EdgesGeometry pipeline Lattice
// View and Skeleton already draw with), so there's one geometry source. Every piece here is reachable on a wheel today (Hemi
// 3/4/Tri/Ring aren't -- they have store support but no UI entry -- so
// they're deliberately not listed). Row names "RD Dual" and "BCC
// Interstitial" reuse the code's own existing descriptions of those
// lattices; they are placeholders pending the user's own naming.
export const LATTICES_3D = [
  { key: 'fcc', label: 'FCC', pieces: [
    { label: 'RD', action: 'tool:pieceType:rd' },
    { label: 'Hemi RD', action: 'tool:pieceType:halfrd' },
    { label: 'Hourglass', action: 'tool:pieceType:hourglass' },
    { label: 'RD Quarter', action: 'tool:pieceType:rdquarter' },
    { label: 'Cube', action: 'tool:pieceType:cube' },
    { label: 'Pyramid', action: 'tool:pieceType:pyramid' },
  ] },
  { key: 'rdDual', label: 'RD Dual', pieces: [
    { label: 'CO', action: 'tool:cuboctaBuild' },
    { label: 'Octahedron', action: 'tool:pieceType:octahedron' },
  ] },
  { key: 'bcc', label: 'BCC', pieces: [
    { label: 'TO', action: 'tool:pieceType:to' },
  ] },
  { key: 'bccGaps', label: 'BCC Interstitial', pieces: [
    { label: 'Flattened Octahedron', action: 'tool:pieceType:ioct' },
    { label: 'Disphenoid', action: 'tool:pieceType:idis' },
  ] },
  { key: 'ed', label: 'ED', pieces: [
    { label: 'ED', action: 'tool:pieceType:elongdodeca' },
  ] },
  { key: 'hex', label: 'Hexagonal', pieces: [
    { label: 'Hex Prism', action: 'tool:pieceType:hexprism' },
  ] },
  { key: 'rhombohedral', label: 'Rhombohedral', pieces: [
    { label: 'Rhombohedra', action: 'tool:pieceType:rhombohedra' },
  ] },
  { key: 'pyrochlore', label: 'Pyrochlore (3D Kagome)', pieces: [
    { label: 'Truncated Tetrahedron', action: 'tool:pieceType:pyrochlore' },
  ] },
  { key: 'shells', label: 'Shells', pieces: [
    { label: 'Shells', action: 'tool:shellsWorld' },
  ] },
  { key: 'golden', label: 'Golden Rhombohedra', pieces: [
    { label: 'Golden Rhombohedra', action: 'tool:goldenWorld' },
  ] },
];

// 4D thumbnails (direct decision, option B): each cell's 4D edges turned
// by a slight oblique XW 20 / YW 15 / ZW 10 degree rotation, then a
// parallel shadow into 3D (vertex-first collapses the 24-cell and
// tesseract to the same RD outline; cell-first hides the 4D-ness), then
// the same rotating preview as every other card. Real geometry from
// lattice-4d.js (verify:4d), nothing hand-drawn.
const OBLIQUE_4D = rotation4({ xw: 20 * Math.PI / 180, yw: 15 * Math.PI / 180, zw: 10 * Math.PI / 180 });
const FIRST_4D_CENTER = { tesseract: [0, 0, 0, 0], cell24: [0, 0, 0, 0], cell16: [0.5, 0.5, 0.5, 0.5], ...A4_FIRST };
function edges4D(kind) {
  const c = FIRST_4D_CENTER[kind];
  const s = cellStructure(kind, c);
  const p = s.offsets.map((o) => project4(matVec(OBLIQUE_4D, o), false));
  return s.edges.map(([i, j]) => [p[i], p[j]]);
}

// LATTICES_4D: the three 4D worlds (direct decision: wizard = three
// worlds, the 4D wheel = six cells).
export const LATTICES_4D = [
  { key: 'z4', label: 'Z4 (Hypercubic)', pieces: [
    { label: 'Tesseract', action: 'tool:pieceType:tesseract', preview: () => edges4D('tesseract') },
  ] },
  { key: 'd4', label: 'D4', pieces: [
    { label: '24-cell', action: 'tool:pieceType:cell24', preview: () => edges4D('cell24') },
    { label: '16-cell', action: 'tool:pieceType:cell16', preview: () => edges4D('cell16') },
  ] },
  { key: 'a4', label: 'Hyper-pyrochlore (4D Kagome)', pieces: [
    { label: 'Truncated 5-cell', action: 'tool:pieceType:a4trunc', preview: () => edges4D('a4trunc') },
    { label: 'Bitruncated 5-cell', action: 'tool:pieceType:a4bitrunc', preview: () => edges4D('a4bitrunc') },
    { label: '5-cell', action: 'tool:pieceType:a4cell5', preview: () => edges4D('a4cell5') },
  ] },
];

export function createDimensionWizard({ onSelectFamily, pieceEdges }) {
  injectCssOnce();

  // Rotating previews (wireframe-preview.js): each rendered screen
  // registers its canvases' edge sources here, mounts them after its
  // innerHTML lands, and every screen change / close disposes them so
  // the shared animation loop only ever ticks canvases actually shown.
  let previewSources = [];
  let previewDisposers = [];
  function previewSlot(getEdges) {
    previewSources.push(getEdges);
    return `<canvas class="dim-wizard-preview" data-preview="${previewSources.length - 1}"></canvas>`;
  }
  function resetPreviews() {
    previewDisposers.forEach((dispose) => dispose());
    previewDisposers = [];
    previewSources = [];
  }
  function mountPreviews() {
    bodyEl.querySelectorAll('canvas[data-preview]').forEach((canvas) => {
      previewDisposers.push(mountWireframePreview(canvas, previewSources[Number(canvas.dataset.preview)](), 40));
    });
  }

  const overlay = document.createElement('div');
  overlay.className = 'dim-wizard-overlay';
  overlay.innerHTML = `
    <div class="dim-wizard-card">
      <div class="dim-wizard-header"><span class="dim-wizard-title"></span><button type="button" class="dim-wizard-close">✕</button></div>
      <div class="dim-wizard-body"></div>
    </div>`;
  document.body.appendChild(overlay);
  const bodyEl = overlay.querySelector('.dim-wizard-body');
  const titleEl = overlay.querySelector('.dim-wizard-title');

  function showDimensions() {
    resetPreviews();
    const L = getSettings().language;
    titleEl.textContent = t('wiz.title', L);
    let grid = '';
    for (const dim of DIMENSIONS) {
      grid += `
        <button type="button" class="dim-wizard-card-btn" data-dim="${dim.id}">
          ${previewSlot(dim.previewAction ? () => pieceEdges(dim.previewAction) : dim.preview)}
          <span class="dim-wizard-row-text">
            <span class="dim-wizard-label">${dim.label}</span>
            <span class="dim-wizard-desc">${t(`wiz.dim.${dim.id}`, L)}</span>
          </span>
        </button>`;
    }
    bodyEl.innerHTML = `<div class="dim-wizard-sub">${t('wiz.sub', L)}</div><div class="dim-wizard-grid">${grid}</div>`;
    mountPreviews();
    bodyEl.querySelectorAll('.dim-wizard-card-btn').forEach((el) => {
      el.addEventListener('click', () => {
        const dim = el.dataset.dim;
        if (dim === '3D') showLattice3D();
        else if (dim === '2D') showLattice2D();
        else if (dim === '4D') showLattice4D();
        else if (dim === '5D' || dim === '6D') showCatalogue(dim);
      });
    });
  }

  function showLattice2D() {
    resetPreviews();
    const L = getSettings().language;
    let grid = '';
    for (const fam of LATTICE_FAMILIES_2D) {
      grid += `
        <button type="button" class="dim-wizard-card-btn" data-action="${fam.action}">
          ${previewSlot(fam.preview)}
          <span class="dim-wizard-row-text">
            <span class="dim-wizard-label">${fam.label}</span>
            <span class="dim-wizard-desc">${t(`wiz.2d.${fam.id}`, L)}</span>
          </span>
        </button>`;
    }
    bodyEl.innerHTML = `
      <button type="button" class="dim-wizard-back">${t('wiz.back', L)}</button>
      <div class="dim-wizard-sub">${t('wiz.2d.sub', L)}</div>
      <div class="dim-wizard-grid">${grid}</div>`;
    mountPreviews();
    bodyEl.querySelector('.dim-wizard-back').addEventListener('click', showDimensions);
    bodyEl.querySelectorAll('.dim-wizard-card-btn[data-action]').forEach((el) => {
      el.addEventListener('click', () => {
        close();
        onSelectFamily('2D', el.dataset.action);
      });
    });
  }

  function showLatticeSections(dimension, lattices, edgesFor) {
    resetPreviews();
    const L = getSettings().language;
    const d = dimension.toLowerCase();
    let grid = '';
    for (const lat of lattices) {
      grid += `
        <div class="dim-wizard-section">
          <span class="dim-wizard-label">${lat.label}</span>
          <span class="dim-wizard-desc">${t(`wiz.${d}.${lat.key}`, L)}</span>
        </div>`;
      for (const piece of lat.pieces) {
        grid += `
        <button type="button" class="dim-wizard-card-btn dim-wizard-piece" data-action="${piece.action}">
          ${previewSlot(() => edgesFor(piece))}
          <span class="dim-wizard-row-text">
            <span class="dim-wizard-label">${piece.label}</span>
          </span>
        </button>`;
      }
    }
    bodyEl.innerHTML = `
      <button type="button" class="dim-wizard-back">${t('wiz.back', L)}</button>
      <div class="dim-wizard-sub">${t(`wiz.${d}.sub`, L)}</div>
      <div class="dim-wizard-grid">${grid}</div>`;
    mountPreviews();
    bodyEl.querySelector('.dim-wizard-back').addEventListener('click', showDimensions);
    bodyEl.querySelectorAll('.dim-wizard-card-btn[data-action]').forEach((el) => {
      el.addEventListener('click', () => {
        close();
        onSelectFamily(dimension, el.dataset.action);
      });
    });
  }
  // 5D/6D: one world each (the tiling picks every piece's shape), so the
  // screen is the catalogue: build freely, or summon an item, from the list
  // or by serial number (any tier's serial works from either screen).
  // Sections: zonohedra open, the vertex-star sections folded until tapped
  // (each open row runs a rotating preview, too many at once for a phone).
  const openSections = new Set(['zonohedron']);
  async function showCatalogue(dim) {
    resetPreviews();
    const L = getSettings().language;
    titleEl.textContent = t('cat.title', L, { dim });
    const entries = await loadCatalogue();
    const tier = dim.toLowerCase();
    const k = tier === '6d' ? 3 : 2;
    const mine = entries.filter((x) => x.tier === tier);
    const buildRow = `
        <button type="button" class="dim-wizard-card-btn" data-action="build">
          ${previewSlot(DIMENSIONS.find((x) => x.id === dim).preview)}
          <span class="dim-wizard-row-text">
            <span class="dim-wizard-label">${t('cat.buildFreely', L)}</span>
            <span class="dim-wizard-desc">${t('cat.buildFreelyDesc', L)}</span>
          </span>
        </button>`;
    const row = (x) => {
      const n = pieceCount({ k }, x);
      return `
        <button type="button" class="dim-wizard-card-btn dim-wizard-piece" data-action="summon:${x.serial}">
          ${previewSlot(() => pieceEdges(`summon:${x.serial}`))}
          <span class="dim-wizard-row-text">
            <span class="dim-wizard-label">${x.name}</span>
            <span class="dim-wizard-desc">#${x.serial} · ${tn('cat.pieces', L, n)}</span>
          </span>
        </button>`;
    };
    const sections = [
      { id: 'zonohedron', label: t('cat.zonohedra', L), desc: t('cat.zonohedraDesc', L), items: mine.filter((x) => x.kind === 'zonohedron') },
      { id: 'polytope', label: t('cat.polytopes', L), desc: t('cat.polytopesDesc', L), items: mine.filter((x) => x.kind === 'polytope') },
      { id: 'bridge', label: t('cat.bridges', L), desc: t('cat.bridgesDesc', L), items: mine.filter((x) => x.kind === 'bridge') },
      ...[1, 2, 3].map((r) => ({
        id: `patch${r}`,
        label: r === 1 ? t('cat.stars', L) : t('cat.starsRings', L, { n: r }),
        desc: t(r === 1 ? 'cat.starsDesc' : `cat.stars${r}Desc`, L),
        items: mine.filter((x) => x.kind === 'patch' && x.rings === r),
      })),
    ].filter((sec) => sec.items.length);
    const rows = sections.map((sec) => {
      const open = openSections.has(sec.id);
      return `
        <button type="button" class="dim-wizard-section dim-wizard-fold" data-section="${sec.id}" aria-expanded="${open}">
          <span class="dim-wizard-label">${open ? '▾' : '▸'} ${sec.label} (${sec.items.length})</span>
          <span class="dim-wizard-desc">${sec.desc}</span>
        </button>${open ? sec.items.map(row).join('') : ''}`;
    }).join('');
    bodyEl.innerHTML = `
      <button type="button" class="dim-wizard-back">${t('wiz.back', L)}</button>
      <div class="dim-wizard-sub">${t('cat.sub', L, { dim })}</div>
      <div class="dim-wizard-serial-row">
        <input type="number" inputmode="numeric" min="1" placeholder="${t('cat.serial', L)}" aria-label="${t('cat.serial', L)}">
        <button type="button" class="dim-wizard-serial-go">${t('cat.summon', L)}</button>
      </div>
      <div class="dim-wizard-serial-msg" aria-live="polite"></div>
      <div class="dim-wizard-grid">
        ${buildRow}
        ${rows}
      </div>`;
    mountPreviews();
    bodyEl.querySelector('.dim-wizard-back').addEventListener('click', showDimensions);
    bodyEl.querySelectorAll('.dim-wizard-fold').forEach((el) => {
      el.addEventListener('click', () => {
        const id = el.dataset.section;
        if (openSections.has(id)) openSections.delete(id); else openSections.add(id);
        const top = bodyEl.parentElement.scrollTop;
        showCatalogue(dim).then(() => { bodyEl.parentElement.scrollTop = top; });
      });
    });
    bodyEl.querySelectorAll('.dim-wizard-card-btn[data-action]').forEach((el) => {
      el.addEventListener('click', () => {
        close();
        onSelectFamily(dim, el.dataset.action === 'build' ? null : el.dataset.action);
      });
    });
    const input = bodyEl.querySelector('.dim-wizard-serial-row input');
    const msg = bodyEl.querySelector('.dim-wizard-serial-msg');
    const go = () => {
      const serial = Number(input.value);
      const entry = Number.isInteger(serial) ? findBySerial(entries, serial) : null;
      if (!entry) { msg.textContent = input.value ? t('cat.noSerial', L, { serial: input.value }) : t('cat.typeSerial', L); return; }
      close();
      onSelectFamily(entry.tier.toUpperCase(), `summon:${entry.serial}`);
    };
    bodyEl.querySelector('.dim-wizard-serial-go').addEventListener('click', go);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  }

  function showLattice3D() {
    showLatticeSections('3D', LATTICES_3D, (piece) => pieceEdges(piece.action));
  }
  function showLattice4D() {
    showLatticeSections('4D', LATTICES_4D, (piece) => piece.preview());
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
    resetPreviews();
    overlay.classList.remove('open');
  }

  // Straight to a 5D/6D catalogue (the in-world Catalogue button).
  function openCatalogue(dim) {
    overlay.classList.add('open');
    showCatalogue(dim);
  }
  // Straight to one dimension's screen (the welcome screen's 2D ... 6D).
  function openDimension(dim) {
    overlay.classList.add('open');
    titleEl.textContent = t('wiz.title', getSettings().language); // the lattice screens keep the list's title
    if (dim === '2D') showLattice2D();
    else if (dim === '3D') showLattice3D();
    else if (dim === '4D') showLattice4D();
    else if (dim === '5D' || dim === '6D') showCatalogue(dim);
    else showDimensions();
  }

  return { open, openCatalogue, openDimension, close, get isOpen() { return overlay.classList.contains('open'); } };
}
