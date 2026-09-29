// 1D Construct: a world of its own (Wizard → 1D → Construct), the
// construction microscope of DICTO's Dimensional Construction Interface
// (docs/DIMENSIONAL_CONSTRUCTION_INTERFACE.md; the model is
// geometry-extensions/construction.js).
//
// Redesigned 2026-09-29 (direct feedback on the first version: "horrible
// and confusing", "I wanted a square, not a grid", "looks like 1960s Open
// University graphics, nothing like the rest of the app", "supposed to be
// staged to make it as simple as possible"). Decisions: one cell per tap,
// cyan like Signal, a fixed square of 5 cells per side (SQUARE_N), slender cells,
// seen straight on.
// - One line at a time: only the side you're on shows (its empty cells
//   faint, plain) until the square closes. The next cell is orange: tap
//   (anywhere) to fill it. Up the screen along X first; at the corner a
//   junction glows and Y joins (X stays); clockwise along the top, down
//   the far side (a second X line, parallel to the first), back along
//   the bottom. Closing
//   the loop, the square fills in, and can open in 2D ("same animal,
//   different zoo").
// - Then the cube (direct decisions, 2026-09-29: "first 10 cells by hand,
//   then one tap per edge, with axes numbered and ghosting after
//   finished"; "turn, with perspective"): the view turns to three-quarters
//   and Z rises from the start corner, cell by cell; then each tap fills a
//   whole edge (the other Z edges, then the top square). Finished edges
//   ghost; the one just finished stays solid; edges carry their numbered
//   names (X1, Z3, …) until the cube closes.
// - The cube lattice (direct request, "c - cube lattice"): once the cube
//   closes, the lattice button shows it tiling space, the cubes around it
//   as ghosts, and the view pulls back to take them in. The closed square
//   has its lattice too ("we need square lattice too"), seen straight on.
// - Then the tesseract (direct decisions, 2026-09-29: "same as the cube",
//   "cube within a cube", "slow W-rotation", "straight into its lattice",
//   "Open in 4D"): W rises from the start corner, pointing inward (the
//   classic picture: W as perspective, the second cube smaller inside the
//   first); its first edge by hand, then one tap per numbered edge. It
//   closes straight into its lattice; a tap sets it turning slowly
//   through W, the inner and outer cubes trading places (the lattice
//   hides meanwhile: turned, its outer shells swell past the screen), and
//   another stops it; the lattice button brings the lattice back.
// - Families (direct decision, 2026-09-29: "Wizard cards"): Square (→
//   cube → tesseract), Kagome (its star unit → the Kagome lattice), each
//   a plan in construction.js; each keeps its own progress.
// - Long-press takes back the last cell.
// - Cells are the shared 1D bullet (bullet-cell.js), nose along the way
//   round, in Signal's cyan, matte, shaded cups.
import * as THREE from 'three';
import { PLANS, edgeCells, SQUARE_N } from '../geometry-extensions/construction.js';
import { bulletGeometry, plainCellGeometry } from './bullet-cell.js';
import { t } from './i18n.js';
import { getSettings, onSettingsChange } from './settings.js';

const STORAGE_KEY = 'rhombiverse-1d-construct-world';
// Five cells a side, each twice as long, so edges keep their length
// (direct request: "edges same length as before, just longer cells").
const U = 1; // world units per cell
// Slender, more like an axis than a fat tube (direct request).
const R = 0.055;
const PAD = 0.004;
const CYAN = 0x22c3e6;
const NEXT = 0xf59e0b; // the 1D worlds' orange "tap here"
const W_TURN = 0.3; // radians per second through W, once the tesseract closes
const lang = () => getSettings().language;

export function createConstructWorld({ scene, camera, controls, onOpenIn = () => {}, onChange = () => {}, showHudPrompt = () => {} }) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  const N = SQUARE_N;
  const plans = Object.fromEntries(Object.entries(PLANS).map(([id, make]) => [id, make(N)]));
  let family = 'square';
  let plan = plans[family];
  const progress = Object.fromEntries(Object.keys(plans).map((id) => [id, 0]));
  const clampSteps = (id, v) => (Number.isInteger(v) ? Math.max(0, Math.min(plans[id].steps.length, v)) : 0);
  function readProgress(data) {
    // v3: the square alone; v4: every family.
    if (data?.version === 3 && data.n === N) progress.square = clampSteps('square', data.filled);
    if (data?.version === 4 && data.n === N) for (const id of Object.keys(plans)) progress[id] = clampSteps(id, data.filled?.[id]);
  }
  try { readProgress(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')); } catch { /* corrupt or blocked storage: start empty */ }
  // Progress saved for another square size (v2: the 4-per-side square)
  // is dropped, so the build starts again on the first, vertical side.
  let filled = progress[family];
  let active = false;
  const toJSON = () => { progress[family] = filled; return { version: 4, n: N, filled: { ...progress } }; };
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(toJSON())); } catch { /* best-effort */ }
  }
  const edges = () => plan.edges;
  const steps = () => plan.steps;
  const complete = () => filled === plan.steps.length;
  const milestoneAt = () => plan.milestones.find((m) => m.at === filled) ?? null;
  const reachedMilestone = () => [...plan.milestones].reverse().find((m) => m.at <= filled) ?? null;
  const nextMilestone = () => plan.milestones.find((m) => m.at > filled) ?? null;
  const flatStage = () => filled < plan.flat;
  const wholeEdges = () => milestoneAt()?.whole ?? 0;
  // The closed shape's lattice shown around it. The cube, the tesseract
  // and the Kagome star close straight into theirs (direct request: "cube
  // should immediately be part of the lattice").
  let latticeOn = !!milestoneAt()?.autoLattice;
  const latticeReady = () => !!milestoneAt();
  // The dimension being built toward (or just closed, at the end).
  const stageDim = () => (nextMilestone() ?? reachedMilestone())?.dim ?? 2;
  const flatView = () => stageDim() === 2 || (latticeOn && milestoneAt()?.dim === 2);
  let turning = false; // the finished tesseract turning through W
  let theta = 0;

  // ---- drawing ----
  const geo = bulletGeometry(U, R, PAD);
  const plainGeo = plainCellGeometry(U, R);
  const edgeGhostGeo = plainCellGeometry(N * U, R); // a finished edge, ghosted: one plain rod
  const filledMat = new THREE.MeshStandardMaterial({ color: CYAN, vertexColors: true, roughness: 0.8, metalness: 0.05 });
  const nextMat = new THREE.MeshStandardMaterial({ color: NEXT, emissive: NEXT, emissiveIntensity: 0.35, vertexColors: true }); // opaque: no nested nose showing through
  const emptyMat = new THREE.MeshStandardMaterial({ color: CYAN, vertexColors: true, transparent: true, opacity: 0.08, depthWrite: false });
  const ghostMat = new THREE.MeshStandardMaterial({ color: CYAN, vertexColors: true, transparent: true, opacity: 0.22, depthWrite: false });
  const faceMat = new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide });
  const latticeMat = new THREE.MeshStandardMaterial({ color: CYAN, vertexColors: true, transparent: true, opacity: 0.21, depthWrite: false }); // "one tone brighter" than first shown
  const junctionMat = new THREE.MeshBasicMaterial({ color: NEXT, transparent: true, opacity: 0.45, depthWrite: false });
  // Rounded corners (direct requests: "corners should become rounded when
  // reached; the dome should reach the far side of the diameter", "all
  // rounded corners"): a corner's arriving nose domes out over it; while
  // only the departing line shows, a dome the cells' width stands in for
  // that hidden nose, and a closed shape gets one at every corner.
  const cornerMat = new THREE.MeshStandardMaterial({ color: CYAN, roughness: 0.8, metalness: 0.05 });
  const cornerGeo = new THREE.SphereGeometry(R, 48, 24);
  const catchPlane = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
  catchPlane.position.z = -R - 0.05;
  group.add(catchPlane);
  const pickTargets = [catchPlane];
  const layer = new THREE.Group();
  group.add(layer);
  const up = new THREE.Vector3(0, 1, 0);
  // The first line (X) runs up the screen, like Signal's (direct
  // request: "can't we start at the vertical axis?"); X is only the first
  // direction's name, not "horizontal". Y then turns off to the side, Z
  // comes out toward you, and W points inward: a point at w is drawn
  // scaled toward the shape's centre by n / (n + w) (a perspective view
  // from w = -n), so the tesseract's second cube sits inside the first at
  // half size and straight edges stay straight as it turns in the X–W
  // plane by theta.
  const C = N / 2;
  function project(p) {
    let x = p[0], w = p[3] ?? 0;
    if (theta) {
      const dx = x - C, dw = w - C, c = Math.cos(theta), s = Math.sin(theta);
      x = C + dx * c - dw * s;
      w = C + dx * s + dw * c;
    }
    const f = N / (N + w);
    return { v: new THREE.Vector3(((p[1] - C) * f + C) * U, ((x - C) * f + C) * U, (((p[2] ?? 0) - C) * f + C) * U), f };
  }
  const world = (p) => project(p).v;
  // What the view frames: the shape being built (its bounding box), or its
  // lattice.
  function bounds(segs) {
    const box = new THREE.Box3();
    for (const [a, b] of segs) { box.expandByPoint(world(a)); box.expandByPoint(world(b)); }
    return box;
  }
  const stageEdges = () => {
    const m = nextMilestone() ?? reachedMilestone();
    return plan.edges.slice(0, m ? m.whole : plan.edges.length).map((e) => [e.from, e.to]);
  };

  // Numbered edge names: small text sprites, made once each.
  const labelCache = new Map();
  function labelSprite(text, opacity) {
    if (!labelCache.has(text)) {
      const c = document.createElement('canvas');
      c.width = 128; c.height = 64;
      const g = c.getContext('2d');
      g.font = '600 40px system-ui, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#bfefff';
      g.fillText(text, 64, 34);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      labelCache.set(text, tex);
    }
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelCache.get(text), transparent: true, opacity, depthWrite: false }));
    sp.scale.set(0.18 * N * U, 0.09 * N * U, 1); // sized to the shape
    sp.userData.ownMaterial = true;
    return sp;
  }

  // Every drawn piece keeps its ℝ⁴ ends, so the turning tesseract can be
  // re-placed each frame without rebuilding anything.
  const placed = [];
  function placeSegment(obj, from, to, length) {
    const a = project(from), b = project(to);
    obj.position.copy(a.v).add(b.v).multiplyScalar(0.5);
    const d = b.v.clone().sub(a.v);
    obj.quaternion.setFromUnitVectors(up, d.clone().normalize());
    const f = (a.f + b.f) / 2;
    obj.scale.set(f, d.length() / length, f); // W's perspective: thinner inside
  }
  function cellMesh(c, mat, g = geo, length = U) {
    const m = new THREE.Mesh(g, mat);
    placeSegment(m, c.from, c.to, length);
    placed.push({ obj: m, from: c.from, to: c.to, length });
    return m;
  }
  const rod = (from, to, mat) => cellMesh({ from, to }, mat, edgeGhostGeo, N * U);
  function placePoint(obj, p) { const { v, f } = project(p); obj.position.copy(v); obj.scale.setScalar(f); }
  function dome(p) {
    const d = new THREE.Mesh(cornerGeo, cornerMat);
    placed.push({ obj: d, at: p });
    placePoint(d, p);
    return d;
  }
  function face(corners) {
    const g = new THREE.BufferGeometry().setFromPoints(corners.map(world));
    const idx = [];
    for (let i = 1; i + 1 < corners.length; i++) idx.push(0, i, i + 1);
    g.setIndex(idx);
    const m = new THREE.Mesh(g, faceMat);
    m.userData.own = true;
    return m;
  }
  function junction(p) {
    const dot = new THREE.Mesh(new THREE.SphereGeometry(R * 2.2, 32, 16), junctionMat);
    dot.userData.own = true;
    dot.position.copy(world(p));
    return dot;
  }
  const same = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-6);
  const lineStart = (line) => plan.steps.findIndex((s) => plan.edges[s.edge].line === line);

  // The first, flat stage: one line at a time (direct requests: "this is
  // 1D, so only one axis should show at a time", "only one axis showing
  // till complete"): the line you're on, the lines already built kept as
  // ghosts ("a ghost of what is already constructed stays").
  function drawFlatStage() {
    const step = plan.steps[filled];
    const current = plan.edges[step.edge];
    const doneCells = (e) => plan.steps.slice(0, filled).filter((s) => s.edge === e.instance).reduce((n, s) => n + s.cells.length, 0);
    for (const e of plan.edges) {
      if (e.line < current.line) { layer.add(rod(e.from, e.to, ghostMat)); continue; }
      if (e.line > current.line) continue;
      const done = doneCells(e);
      if (e.instance < current.instance) edgeCells(e).forEach((c) => layer.add(cellMesh(c, filledMat)));
      else if (e.instance > current.instance) layer.add(rod(e.from, e.to, emptyMat));
      else if (step.cells.length > 1) edgeCells(e).forEach((c) => layer.add(cellMesh(c, nextMat)));
      else edgeCells(e).forEach((c, i) => layer.add(i < done ? cellMesh(c, filledMat) : i === done ? cellMesh(c, nextMat) : cellMesh(c, emptyMat, plainGeo)));
    }
    // The corner you've come round: a dome for the hidden nose; the one
    // just reached glows (a junction).
    const first = plan.edges.find((e) => e.line === current.line);
    const prev = plan.edges[first.instance - 1];
    if (prev && same(prev.to, first.from)) layer.add(dome(first.from));
    if (current.line > 0 && filled === lineStart(current.line)) layer.add(junction(first.from));
  }
  // After it: finished edges ghost, the one just finished stays solid, the
  // next is orange (cell by cell on a new direction's first edge, whole
  // after that); edges carry their names. A shape just closed shows whole
  // and solid.
  function drawBuildStage() {
    const doneCells = new Array(plan.edges.length).fill(0);
    for (let k = 0; k < filled; k++) doneCells[plan.steps[k].edge] += plan.steps[k].cells.length;
    const finished = (e) => doneCells[e.instance] === edgeCells(e).length;
    const last = plan.steps[filled - 1].edge;
    const next = complete() ? -1 : plan.steps[filled].edge;
    const whole = wholeEdges();
    const centre = frameTarget();
    for (const e of plan.edges) {
      const cells = edgeCells(e);
      let shown = true;
      if (e.instance < whole || (finished(e) && e.instance === last)) cells.forEach((c) => layer.add(cellMesh(c, filledMat)));
      else if (finished(e)) layer.add(rod(e.from, e.to, ghostMat));
      else if (e.instance === next) {
        if (plan.steps[filled].cells.length === 1) {
          cells.forEach((c, i) => layer.add(i < doneCells[e.instance] ? cellMesh(c, filledMat) : i === doneCells[e.instance] ? cellMesh(c, nextMat) : cellMesh(c, emptyMat, plainGeo)));
        } else cells.forEach((c) => layer.add(cellMesh(c, nextMat)));
      } else shown = false;
      if (shown && !whole) {
        const mid = world(e.from).add(world(e.to)).multiplyScalar(0.5);
        const out = mid.clone().sub(centre);
        if (e.axis < 3) out.setComponent(e.axis === 0 ? 1 : e.axis === 1 ? 0 : 2, 0); // push out square to the edge only
        const sp = labelSprite(e.label, finished(e) && e.instance !== last ? 0.5 : 1);
        sp.position.copy(mid).add(out.setLength(0.09 * N * U));
        layer.add(sp);
      }
    }
    // Tracing Kagome's star: back at a hexagon corner, two of its lines
    // cross there.
    if (next >= 0 && !milestoneAt() && plan.crossings?.some((p) => same(p, plan.edges[next].from))) layer.add(junction(plan.edges[next].from));
    const m = milestoneAt();
    if (!m) return;
    m.corners.forEach((p) => layer.add(dome(p)));
    m.faces.forEach((f) => layer.add(face(f)));
    if (latticeOn) drawLattice(m.lattice);
    if (!complete()) layer.add(junction(plan.edges[next].from)); // the next direction joins here
  }
  let latticeMesh = null;
  function drawLattice(segs) {
    latticeMesh = new THREE.InstancedMesh(edgeGhostGeo, latticeMat, segs.length);
    latticeMesh.userData.segs = segs;
    latticeMesh.frustumCulled = false;
    placeLattice();
    layer.add(latticeMesh);
  }
  const tmp = new THREE.Object3D();
  function placeLattice() {
    if (!latticeMesh) return;
    latticeMesh.userData.segs.forEach(([a, b], i) => {
      placeSegment(tmp, a, b, N * U);
      tmp.updateMatrix();
      latticeMesh.setMatrixAt(i, tmp.matrix);
    });
    latticeMesh.instanceMatrix.needsUpdate = true;
  }
  function draw() {
    for (const child of [...layer.children]) {
      layer.remove(child);
      if (child.userData.own) child.geometry.dispose();
      if (child.userData.ownMaterial) child.material.dispose();
      if (child.isInstancedMesh) child.dispose();
    }
    placed.length = 0;
    latticeMesh = null;
    if (!active) return;
    if (flatStage()) drawFlatStage();
    else drawBuildStage();
    renderPanel();
  }
  // The finished tesseract turning through W: re-place everything drawn.
  let turnRaf = 0, turnLast = 0;
  function turn(now) {
    turnRaf = 0;
    if (!active || !turning || !milestoneAt()?.turn) return;
    theta = (theta + ((now - turnLast) / 1000) * W_TURN) % (2 * Math.PI);
    turnLast = now;
    for (const p of placed) p.at ? placePoint(p.obj, p.at) : placeSegment(p.obj, p.from, p.to, p.length);
    placeLattice();
    turnRaf = requestAnimationFrame(turn);
  }
  function setTurning(on) {
    turning = on;
    if (on && active && milestoneAt()?.turn && !turnRaf) { turnLast = performance.now(); turnRaf = requestAnimationFrame(turn); }
  }
  // The flat stage is seen straight on (direct request: "this vertical
  // should be pure, without perspective"), so its lines stay truly
  // vertical and horizontal. Once a third direction joins, the view turns
  // to three-quarters so the depth shows ("turn, with perspective"),
  // from the front left: off the cube's (0,0,0)–centre diagonal, along
  // which W's first edge runs (seen end-on from the front right). With
  // the lattice on, it pulls back to take it in.
  const showingLattice = () => latticeOn && latticeReady();
  function frameBox() {
    const theta0 = theta; theta = 0;
    const box = bounds(showingLattice() ? milestoneAt().lattice : stageEdges());
    theta = theta0;
    return box;
  }
  function frameTarget() { const c = frameBox().getCenter(new THREE.Vector3()); if (flatView()) c.z = 0; return c; }
  function pose() {
    const box = frameBox();
    const size = box.getSize(new THREE.Vector3());
    const extent = Math.max(size.x, size.y, size.z, U);
    const c = box.getCenter(new THREE.Vector3());
    const flat = flatView();
    if (flat) c.z = 0;
    const dir = flat ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(-0.5, 0.32, 0.8).normalize();
    const k = flat ? (showingLattice() ? 2.15 : 2.3) : (showingLattice() ? 3.5 : 3.6);
    return { target: c, position: c.clone().add(dir.multiplyScalar(extent * k)) };
  }
  let tween = 0;
  function frame(animate = false) {
    cancelAnimationFrame(tween);
    const to = pose();
    camera.up.set(0, 1, 0);
    if (!animate) {
      controls.target.copy(to.target);
      camera.position.copy(to.position);
      controls.update();
      return;
    }
    const fromT = controls.target.clone(), fromP = camera.position.clone();
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / 1400);
      const e = k * k * (3 - 2 * k);
      controls.target.lerpVectors(fromT, to.target, e);
      camera.position.lerpVectors(fromP, to.position, e);
      controls.update();
      if (k < 1 && active) tween = requestAnimationFrame(step);
    };
    tween = requestAnimationFrame(step);
  }

  // ---- building ----
  function commit(before) {
    const hadLattice = latticeOn, wasFlat = before < plan.flat || before === undefined;
    if (latticeOn && !latticeReady()) latticeOn = false;
    if (!milestoneAt()?.turn) { theta = 0; setTurning(false); }
    save(); draw(); onChange();
    if (hadLattice !== latticeOn || wasFlat !== flatStage() || (before !== undefined && (plan.milestones.some((m) => m.at === before) || milestoneAt()))) frame(true);
  }
  // Where the "one tap per edge" prompt shows: the first time in each
  // stage that by-hand cells give way to whole edges.
  const edgePromptAt = new Set();
  function computeEdgePrompts() {
    edgePromptAt.clear();
    let stage = -1;
    plan.steps.forEach((s, k) => {
      const m = plan.milestones.findIndex((x) => k < x.at);
      if (k > 0 && s.cells.length > 1 && plan.steps[k - 1].cells.length === 1 && m !== stage) { edgePromptAt.add(k); stage = m; }
    });
  }
  computeEdgePrompts();
  const axisLabel = (axis) => plan.axisNames?.[axis] ?? ['X', 'Y', 'Z', 'W'][axis];
  function handleTap(hit, mode) {
    if (mode === 'paint') return false;
    const before = filled;
    if (mode === 'chisel') {
      if (!filled) return false;
      filled -= 1;
      commit(before);
      return true;
    }
    // The finished tesseract: a tap starts or stops its turning.
    if (complete()) {
      if (!milestoneAt()?.turn) return false;
      if (turning) setTurning(false);
      else {
        if (latticeOn) { latticeOn = false; draw(); frame(true); }
        setTurning(true);
      }
      return true;
    }
    filled += 1;
    const m = milestoneAt();
    if (m?.autoLattice) latticeOn = true;
    commit(before);
    if (m) showHudPrompt(t(m.prompt, lang(), { n: m.whole * N }), 6000);
    else if (edgePromptAt.has(filled)) showHudPrompt(t('con.prompt.edges', lang()), 5000);
    else if (flatStage()) {
      // A new direction's first line: a junction.
      const e = plan.edges[plan.steps[filled].edge];
      const isNew = !plan.edges.slice(0, e.instance).some((x) => x.axis === e.axis);
      if (isNew && filled === lineStart(e.line)) showHudPrompt(t(plan.junctionPrompt?.[e.axis] ?? 'con.prompt.junction', lang(), { axis: axisLabel(e.axis) }), 4000);
    }
    return true;
  }

  // ---- panel: the lattice, and the hand-off once a shape closes ----
  const panel = document.createElement('div');
  panel.id = 'world1dconstruct-panel';
  panel.className = 'qc-panel';
  panel.innerHTML = '<div class="w4d-row w4d-options"><button type="button" class="sig-sym" data-lattice><svg viewBox="-12 -12 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="-10" y="-10" width="20" height="20" rx="1.5"/><path d="M-3.3,-10v20M3.3,-10v20M-10,-3.3h20M-10,3.3h20"/></svg></button><button type="button" class="sig-send" data-open></button></div>';
  document.body.appendChild(panel);
  const openBtn = panel.querySelector('[data-open]');
  const latticeBtn = panel.querySelector('[data-lattice]');
  latticeBtn.addEventListener('click', () => {
    latticeOn = !latticeOn;
    if (latticeOn && theta) { setTurning(false); theta = 0; } // the lattice shows squared up
    draw(); frame(true);
  });
  // Each closed shape opens in its own dimension.
  function renderPanel() {
    panel.classList.toggle('visible', active && latticeReady());
    const open = milestoneAt()?.open;
    openBtn.hidden = !open;
    if (open) openBtn.textContent = t('con.open', lang(), { dim: open.dim });
    latticeBtn.hidden = !latticeReady();
    latticeBtn.classList.toggle('active', latticeOn);
    latticeBtn.title = t('con.lattice', lang());
    latticeBtn.setAttribute('aria-label', latticeBtn.title);
  }
  openBtn.addEventListener('click', () => { const open = milestoneAt()?.open; if (open) onOpenIn(open.dim, open.piece); });
  let shownLang = lang();
  onSettingsChange((st) => { if (st.language !== shownLang) { shownLang = st.language; if (active) renderPanel(); } });

  function enterFamily(id) {
    progress[family] = filled;
    family = id;
    plan = plans[id];
    filled = progress[id];
    latticeOn = !!milestoneAt()?.autoLattice;
    theta = 0; turning = false;
    computeEdgePrompts();
  }

  return {
    group,
    meshes: () => pickTargets,
    handleTap,
    /** Which family is built: 'square' (→ cube → tesseract) or 'kagome'. */
    setFamily(id) {
      if (!plans[id] || id === family) return;
      enterFamily(id);
      save();
      if (active) { draw(); frame(); if (!filled) showHudPrompt(t(plan.startPrompt, lang()), 5000); }
    },
    get family() { return family; },
    setActive(on) {
      if (on === active) return;
      active = on;
      group.visible = on;
      if (!on) { cancelAnimationFrame(tween); camera.up.set(0, 1, 0); panel.classList.remove('visible'); }
      draw();
      if (on) { frame(); setTurning(turning); if (!filled) showHudPrompt(t(plan.startPrompt, lang()), 5000); }
    },
    /** How many dimensions are built so far: 1 (lines), then each closed shape's. */
    reached: () => reachedMilestone()?.dim ?? 1,
    get isEmpty() { return filled === 0; },
    clear() { const before = filled; filled = 0; commit(before); if (active) showHudPrompt(t(plan.startPrompt, lang()), 5000); },
    snapshot: toJSON,
    restore(json) {
      const before = filled;
      readProgress(json);
      filled = progress[family];
      commit(before);
    },
    toJSON,
  };
}
