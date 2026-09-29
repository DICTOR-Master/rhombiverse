// 1D Construct: a world of its own (Wizard → 1D → Construct), the
// construction microscope of DICTO's Dimensional Construction Interface
// (docs/DIMENSIONAL_CONSTRUCTION_INTERFACE.md; the model is
// geometry-extensions/construction.js).
//
// Redesigned 2026-09-29 (direct feedback on the first version: "horrible
// and confusing", "I wanted a square, not a grid", "looks like 1960s Open
// University graphics, nothing like the rest of the app", "supposed to be
// staged to make it as simple as possible"). Decisions: one cell per tap,
// cyan like Signal, a fixed square of 10 cells per side, slender cells,
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
// - Long-press takes back the last cell.
// - Cells are the shared 1D bullet (bullet-cell.js), nose along the way
//   round, in Signal's cyan, matte, shaded cups.
import * as THREE from 'three';
import { tesseractEdges, tesseractSteps, edgeCells, SQUARE_N } from '../geometry-extensions/construction.js';
import { bulletGeometry, plainCellGeometry } from './bullet-cell.js';
import { t } from './i18n.js';
import { getSettings, onSettingsChange } from './settings.js';

const STORAGE_KEY = 'rhombiverse-1d-construct-world';
const U = 0.5; // world units per cell
// Slender, more like an axis than a fat tube (direct request).
const R = 0.055;
const PAD = 0.004;
const CYAN = 0x22c3e6;
const NEXT = 0xf59e0b; // the 1D worlds' orange "tap here"
// W as true perspective, n·f(w) = n / (n + w)·n: the inner cube half the
// outer, and straight edges stay straight as the tesseract turns.
const W_TURN = 0.3; // radians per second through W, once the tesseract closes
const lang = () => getSettings().language;

export function createConstructWorld({ scene, camera, controls, onOpenIn = () => {}, onChange = () => {}, showHudPrompt = () => {} }) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  const N = SQUARE_N;
  const edges = tesseractEdges(N);
  const steps = tesseractSteps(N);
  // Where each shape closes (a count of steps): the square, the cube, the
  // tesseract.
  const SQUARE_DONE = 4 * N;
  const CUBE_DONE = steps.findIndex((s) => s.edge === 12);
  const HAND_DONE = new Set([5 * N, CUBE_DONE + N]); // Z1, W1 finished: every other edge is one tap
  let filled = 0;
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (data?.version === 3 && data.n === N && Number.isInteger(data.filled)) filled = Math.max(0, Math.min(steps.length, data.filled));
  } catch { /* corrupt or blocked storage: start empty */ }
  // Progress saved for another square size (v2: the 4-per-side square)
  // is dropped, so the build starts again on the first, vertical side.
  let active = false;
  const toJSON = () => ({ version: 3, n: N, filled });
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(toJSON())); } catch { /* best-effort */ }
  }
  const complete = () => filled === steps.length;
  const squareStage = () => filled < SQUARE_DONE;
  // How many edges show whole and solid right now: a shape just closed.
  const wholeEdges = () => (filled === SQUARE_DONE ? 4 : filled === CUBE_DONE ? 12 : complete() ? edges.length : 0);
  // The closed shape's lattice shown around it. The cube and tesseract
  // close straight into theirs (direct request: "cube should immediately
  // be part of the lattice").
  let latticeOn = filled === CUBE_DONE || complete();
  const latticeReady = () => wholeEdges() > 0;
  const squareLattice = () => latticeOn && filled === SQUARE_DONE;
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
  // scaled toward the cube's centre by n / (n + w) (a perspective view
  // from w = -n), so the second cube sits inside the first at half size.
  // Once the tesseract closes, it can turn in the X–W plane by theta.
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
  const SIDE = N * U;
  const centre = () => new THREE.Vector3(SIDE / 2, SIDE / 2, squareStage() || squareLattice() ? 0 : SIDE / 2);

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
    sp.scale.set(0.9, 0.45, 1);
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
  function dome(p) {
    const d = new THREE.Mesh(cornerGeo, cornerMat);
    placed.push({ obj: d, at: p });
    placePoint(d, p);
    return d;
  }
  function placePoint(obj, p) { const { v, f } = project(p); obj.position.copy(v); obj.scale.setScalar(f); }
  function face(corners) {
    const g = new THREE.BufferGeometry().setFromPoints(corners.map(world));
    g.setIndex([0, 1, 2, 0, 2, 3]);
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
  const SQUARE_FACE = [[0, 0, 0], [N, 0, 0], [N, N, 0], [0, N, 0]];
  const CUBE_FACES = [
    SQUARE_FACE, [[0, 0, N], [N, 0, N], [N, N, N], [0, N, N]],
    [[0, 0, 0], [N, 0, 0], [N, 0, N], [0, 0, N]], [[0, N, 0], [N, N, 0], [N, N, N], [0, N, N]],
    [[0, 0, 0], [0, N, 0], [0, N, N], [0, 0, N]], [[N, 0, 0], [N, N, 0], [N, N, N], [N, 0, N]],
  ];
  const cornersOf = (count) => {
    const pts = new Map();
    for (const e of edges.slice(0, count)) for (const p of [e.from, e.to]) pts.set(String(p), p);
    return [...pts.values()];
  };

  function drawSquareStage() {
    // One line at a time (direct requests: "this is 1D, so only one axis
    // should show at a time", "only one axis showing till complete"):
    // the side you're on, with the sides already built kept as ghosts
    // ("a ghost of what is already constructed stays").
    const here = steps[filled].edge;
    for (const e of edges.slice(0, here)) layer.add(rod(e.from, e.to, ghostMat));
    steps.slice(0, SQUARE_DONE).forEach(({ cells: [c] }, k) => {
      if (c.instance !== here) return;
      if (k < filled) layer.add(cellMesh(c, filledMat));
      else if (k === filled) layer.add(cellMesh(c, nextMat));
      else layer.add(cellMesh(c, emptyMat, plainGeo));
    });
    // The corner you've come round: a dome for the hidden nose; the one
    // just reached glows (a junction: Y joins X there).
    const side = edges[here];
    if (here > 0) layer.add(dome(side.from));
    if (filled === here * N && here > 0) layer.add(junction(side.from));
  }
  // The cube and the tesseract: finished edges ghost, the one just
  // finished stays solid, the next is orange (cell by cell on a new
  // direction's first edge, whole after that); edges carry their names.
  // A shape just closed shows whole and solid.
  function drawBuildStage() {
    const doneCells = new Array(edges.length).fill(0);
    for (let k = 0; k < filled; k++) doneCells[steps[k].edge] += steps[k].cells.length;
    const finished = (e) => doneCells[e.instance] === N;
    const last = steps[filled - 1].edge;
    const next = complete() ? -1 : steps[filled].edge;
    const whole = wholeEdges();
    for (const e of edges) {
      const cells = edgeCells(e);
      let shown = true;
      if (e.instance < whole || (finished(e) && e.instance === last)) cells.forEach((c) => layer.add(cellMesh(c, filledMat)));
      else if (finished(e)) layer.add(rod(e.from, e.to, ghostMat));
      else if (e.instance === next) {
        if (steps[filled].cells.length === 1) {
          cells.forEach((c, i) => layer.add(i < doneCells[e.instance] ? cellMesh(c, filledMat) : i === doneCells[e.instance] ? cellMesh(c, nextMat) : cellMesh(c, emptyMat, plainGeo)));
        } else cells.forEach((c) => layer.add(cellMesh(c, nextMat)));
      } else shown = false;
      if (shown && !whole) {
        const mid = world(e.from).add(world(e.to)).multiplyScalar(0.5);
        const out = mid.clone().sub(centre());
        if (e.axis < 3) out.setComponent(e.axis === 0 ? 1 : e.axis === 1 ? 0 : 2, 0); // push out square to the edge only
        const sp = labelSprite(e.label, finished(e) && e.instance !== last ? 0.5 : 1);
        sp.position.copy(mid).add(out.setLength(0.45));
        layer.add(sp);
      }
    }
    if (!whole) return;
    cornersOf(whole).forEach((p) => layer.add(dome(p)));
    if (whole === 4) layer.add(face(SQUARE_FACE));
    if (whole === 12) CUBE_FACES.forEach((f) => layer.add(face(f)));
    if (latticeOn) drawLattice(whole === 4 ? 2 : whole === 12 ? 3 : 4);
    if (!complete()) layer.add(junction([0, 0, 0])); // the next direction joins at the start corner
  }
  // The closed shape's lattice, its neighbours as ghosts: the square's
  // 3×3 in the plane, the cube's 3×3×3; the tesseract's is the cube's
  // 3×3×3 at both W levels joined along W, and its next neighbour along W
  // (the smaller shell inside; the one outside sits at the eye). One
  // instanced mesh.
  const latticeSegments = (() => {
    const G = [-N, 0, N, 2 * N];
    const own = (a, b) => [...a, ...b].every((v) => v === 0 || v === N);
    const out = { 2: [], 3: [], 4: [] };
    const push = (dims, from, to) => { if (!own(from, to)) out[dims].push([from, to]); };
    for (let axis = 0; axis < 2; axis++) for (const u of G) for (let k = 0; k < 3; k++) {
      const from = [0, 0, 0, 0], to = [0, 0, 0, 0];
      from[1 - axis] = to[1 - axis] = u;
      from[axis] = G[k]; to[axis] = G[k + 1];
      push(2, from, to);
    }
    const cubeGrid = (w) => {
      const segs = [];
      for (let axis = 0; axis < 3; axis++) for (const u of G) for (const v of G) for (let k = 0; k < 3; k++) {
        const from = [0, 0, 0, w], to = [0, 0, 0, w];
        const [p, q] = [0, 1, 2].filter((d) => d !== axis);
        from[p] = to[p] = u; from[q] = to[q] = v;
        from[axis] = G[k]; to[axis] = G[k + 1];
        segs.push([from, to]);
      }
      return segs;
    };
    cubeGrid(0).forEach(([a, b]) => push(3, a, b));
    [...cubeGrid(0), ...cubeGrid(N)].forEach(([a, b]) => push(4, a, b));
    for (const x of G) for (const y of G) for (const z of G) push(4, [x, y, z, 0], [x, y, z, N]);
    const C8 = [0, N].flatMap((x) => [0, N].flatMap((y) => [0, N].map((z) => [x, y, z])));
    for (const [a, b] of cubeGrid(2 * N)) if ([...a.slice(0, 3), ...b.slice(0, 3)].every((v) => v === 0 || v === N)) push(4, a, b);
    for (const p of C8) push(4, [...p, N], [...p, 2 * N]);
    return out;
  })();
  let latticeMesh = null;
  function drawLattice(dims) {
    const segs = latticeSegments[dims];
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
    if (squareStage()) drawSquareStage();
    else drawBuildStage();
    renderPanel();
  }
  // The finished tesseract turning through W: re-place everything drawn.
  let turnRaf = 0, turnLast = 0;
  function turn(now) {
    turnRaf = 0;
    if (!active || !turning || !complete()) return;
    theta = (theta + ((now - turnLast) / 1000) * W_TURN) % (2 * Math.PI);
    turnLast = now;
    for (const p of placed) p.at ? placePoint(p.obj, p.at) : placeSegment(p.obj, p.from, p.to, p.length);
    placeLattice();
    turnRaf = requestAnimationFrame(turn);
  }
  function setTurning(on) {
    turning = on;
    if (on && active && complete() && !turnRaf) { turnLast = performance.now(); turnRaf = requestAnimationFrame(turn); }
  }
  // The square is seen straight on (direct request: "this vertical should
  // be pure, without perspective"), so its lines stay truly vertical and
  // horizontal. Once Z joins, the view turns to three-quarters so the
  // cube's depth shows ("turn, with perspective").
  function pose() {
    const c = centre();
    const flat = squareStage() || squareLattice();
    // From the front left: off the cube's (0,0,0)–centre diagonal, along
    // which W's first edge runs (seen end-on from the front right).
    const dir = flat ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(-0.5, 0.32, 0.8).normalize();
    const dist = squareStage() ? 2.3 : squareLattice() ? 6.4 : latticeOn && latticeReady() ? 10.5 : 3.6;
    return { target: c, position: c.clone().add(dir.multiplyScalar(SIDE * dist)) };
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
    const hadLattice = latticeOn;
    if (latticeOn && !latticeReady()) latticeOn = false;
    if (!complete()) { theta = 0; setTurning(false); }
    save(); draw(); onChange();
    if (hadLattice !== latticeOn || (before < SQUARE_DONE) !== squareStage()) frame(true);
  }
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
      if (turning) setTurning(false);
      else {
        if (latticeOn) { latticeOn = false; draw(); frame(true); }
        setTurning(true);
      }
      return true;
    }
    filled += 1;
    const closed = filled === CUBE_DONE || complete();
    if (closed) latticeOn = true;
    commit(before);
    if (closed) frame(true);
    if (complete()) showHudPrompt(t('con.prompt.tesseract', lang(), { n: edges.length * N }), 6000);
    else if (filled === CUBE_DONE) showHudPrompt(t('con.prompt.cube', lang(), { n: 12 * N }), 6000);
    else if (filled === SQUARE_DONE) showHudPrompt(t('con.prompt.square', lang(), { n: SQUARE_DONE }), 6000);
    else if (HAND_DONE.has(filled)) showHudPrompt(t('con.prompt.edges', lang()), 5000);
    else if (filled % N === 0 && filled < SQUARE_DONE) showHudPrompt(t('con.prompt.junction', lang(), { axis: 'Y' }), 4000);
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
  // The square opens in 2D, the cube in 3D, the tesseract in 4D.
  const openDim = () => (filled === SQUARE_DONE ? '2D' : filled === CUBE_DONE ? '3D' : complete() ? '4D' : null);
  function renderPanel() {
    panel.classList.toggle('visible', active && latticeReady());
    const dim = openDim();
    openBtn.hidden = !dim;
    if (dim) openBtn.textContent = t('con.open', lang(), { dim });
    latticeBtn.hidden = !latticeReady();
    latticeBtn.classList.toggle('active', latticeOn);
    latticeBtn.title = t('con.lattice', lang());
    latticeBtn.setAttribute('aria-label', latticeBtn.title);
  }
  openBtn.addEventListener('click', () => { const dim = openDim(); if (dim) onOpenIn(dim); });
  let shownLang = lang();
  onSettingsChange((st) => { if (st.language !== shownLang) { shownLang = st.language; if (active) renderPanel(); } });

  return {
    group,
    meshes: () => pickTargets,
    handleTap,
    setActive(on) {
      if (on === active) return;
      active = on;
      group.visible = on;
      if (!on) { cancelAnimationFrame(tween); camera.up.set(0, 1, 0); panel.classList.remove('visible'); }
      draw();
      if (on) { frame(); setTurning(turning); if (!filled) showHudPrompt(t('con.prompt.start', lang()), 5000); }
    },
    /** How many dimensions are built so far: 1 (lines), 2 (the square), 3 (the cube), 4 (the tesseract). */
    reached: () => (complete() ? 4 : filled >= CUBE_DONE ? 3 : squareStage() ? 1 : 2),
    get isEmpty() { return filled === 0; },
    clear() { const before = filled; filled = 0; commit(before); if (active) showHudPrompt(t('con.prompt.start', lang()), 5000); },
    snapshot: toJSON,
    restore(json) {
      const before = filled;
      if (json?.version === 3 && json.n === N && Number.isInteger(json.filled)) filled = Math.max(0, Math.min(steps.length, json.filled));
      commit(before);
    },
    toJSON,
  };
}
