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
// - Long-press takes back the last cell. No other controls.
// - Cells are the shared 1D bullet (bullet-cell.js), nose along the way
//   round, in Signal's cyan, matte, shaded cups.
import * as THREE from 'three';
import { cubeEdges, cubeSteps, edgeCells, SQUARE_N } from '../geometry-extensions/construction.js';
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
const lang = () => getSettings().language;

export function createConstructWorld({ scene, camera, controls, onOpenIn = () => {}, onChange = () => {}, showHudPrompt = () => {} }) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  const edges = cubeEdges(SQUARE_N);
  const steps = cubeSteps(SQUARE_N);
  const SQUARE_STEPS = 4 * SQUARE_N; // the square closes here
  const HAND_STEPS = 5 * SQUARE_N; // the first Z edge, by hand, ends here
  let filled = 0;
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (data?.version === 3 && data.n === SQUARE_N && Number.isInteger(data.filled)) filled = Math.max(0, Math.min(steps.length, data.filled));
  } catch { /* corrupt or blocked storage: start empty */ }
  // Progress saved for another square size (v2: the 4-per-side square)
  // is dropped, so the build starts again on the first, vertical side.
  let active = false;
  const toJSON = () => ({ version: 3, n: SQUARE_N, filled });
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(toJSON())); } catch { /* best-effort */ }
  }
  const complete = () => filled === steps.length;
  let latticeOn = false; // the finished square's or cube's lattice shown around it
  const latticeReady = () => complete() || filled === 4 * SQUARE_N;
  const squareLattice = () => latticeOn && filled === 4 * SQUARE_N;
  const squareStage = () => filled < SQUARE_STEPS;

  // ---- drawing ----
  const geo = bulletGeometry(U, R, PAD);
  const plainGeo = plainCellGeometry(U, R);
  const edgeGhostGeo = plainCellGeometry(SQUARE_N * U, R); // a finished edge, ghosted: one plain rod
  const filledMat = new THREE.MeshStandardMaterial({ color: CYAN, vertexColors: true, roughness: 0.8, metalness: 0.05 });
  const nextMat = new THREE.MeshStandardMaterial({ color: NEXT, emissive: NEXT, emissiveIntensity: 0.35, vertexColors: true }); // opaque: no nested nose showing through
  const emptyMat = new THREE.MeshStandardMaterial({ color: CYAN, vertexColors: true, transparent: true, opacity: 0.08, depthWrite: false });
  const ghostMat = new THREE.MeshStandardMaterial({ color: CYAN, vertexColors: true, transparent: true, opacity: 0.22, depthWrite: false });
  const faceMat = new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide });
  const latticeMat = new THREE.MeshStandardMaterial({ color: CYAN, vertexColors: true, transparent: true, opacity: 0.13, depthWrite: false });
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
  // direction's name, not "horizontal". Y then turns off to the side, and
  // Z comes out toward you.
  const world = (p) => new THREE.Vector3(p[1] * U, p[0] * U, (p[2] ?? 0) * U);
  const SIDE = SQUARE_N * U;
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

  function cellMesh(c, mat, g = geo) {
    const m = new THREE.Mesh(g, mat);
    const a = world(c.from), b = world(c.to);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(up, b.clone().sub(a).normalize());
    return m;
  }
  const dome = (p) => { const d = new THREE.Mesh(cornerGeo, cornerMat); d.position.copy(world(p)); return d; };
  function face(corners) {
    const g = new THREE.BufferGeometry().setFromPoints(corners.map(world));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    const m = new THREE.Mesh(g, faceMat);
    m.userData.own = true;
    return m;
  }
  const N = SQUARE_N;
  const SQUARE_FACE = [[0, 0, 0], [N, 0, 0], [N, N, 0], [0, N, 0]];
  const CUBE_FACES = [
    SQUARE_FACE, [[0, 0, N], [N, 0, N], [N, N, N], [0, N, N]],
    [[0, 0, 0], [N, 0, 0], [N, 0, N], [0, 0, N]], [[0, N, 0], [N, N, 0], [N, N, N], [0, N, N]],
    [[0, 0, 0], [0, N, 0], [0, N, N], [0, 0, N]], [[N, 0, 0], [N, N, 0], [N, N, N], [N, 0, N]],
  ];
  const CUBE_CORNERS = [0, N].flatMap((x) => [0, N].flatMap((y) => [0, N].map((z) => [x, y, z])));

  function drawSquareStage() {
    // One line at a time (direct requests: "this is 1D, so only one axis
    // should show at a time", "only one axis showing till complete"):
    // the side you're on, with the sides already built kept as ghosts
    // ("a ghost of what is already constructed stays").
    const here = steps[filled].edge;
    for (const e of edges.slice(0, here)) layer.add(cellMesh({ from: e.from, to: e.to }, ghostMat, edgeGhostGeo));
    steps.slice(0, SQUARE_STEPS).forEach(({ cells: [c] }, k) => {
      if (c.instance !== here) return;
      if (k < filled) layer.add(cellMesh(c, filledMat));
      else if (k === filled) layer.add(cellMesh(c, nextMat));
      else layer.add(cellMesh(c, emptyMat, plainGeo));
    });
    // The corner you've come round: a dome for the hidden nose; the one
    // just reached glows (a junction: Y joins X there).
    const side = edges[here];
    if (here > 0) layer.add(dome(side.from));
    if (filled === here * SQUARE_N && here > 0) {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(R * 2.2, 32, 16), junctionMat);
      dot.userData.own = true;
      dot.position.copy(world(side.from));
      layer.add(dot);
    }
  }
  function drawCubeStage() {
    // Which edges are finished, and the one just finished (it stays solid).
    const doneCells = new Array(edges.length).fill(0);
    for (let k = 0; k < filled; k++) doneCells[steps[k].edge] += steps[k].cells.length;
    const finished = (e) => doneCells[e.instance] === SQUARE_N;
    const last = steps[filled - 1].edge;
    const next = complete() ? -1 : steps[filled].edge;
    const lastWhole = filled === SQUARE_STEPS; // the square, just closed: whole and solid
    for (const e of edges) {
      const cells = edgeCells(e);
      let shown = true;
      if (complete() || (finished(e) && (e.instance === last || (lastWhole && e.instance < 4)))) cells.forEach((c) => layer.add(cellMesh(c, filledMat)));
      else if (finished(e)) {
        const rod = cellMesh({ from: e.from, to: e.to }, ghostMat, edgeGhostGeo);
        layer.add(rod);
      } else if (e.instance === next) {
        if (filled < HAND_STEPS) {
          cells.forEach((c, i) => layer.add(i < doneCells[e.instance] ? cellMesh(c, filledMat) : i === doneCells[e.instance] ? cellMesh(c, nextMat) : cellMesh(c, emptyMat, plainGeo)));
        } else cells.forEach((c) => layer.add(cellMesh(c, nextMat)));
      } else shown = false;
      if (shown && !complete() && !lastWhole) {
        const mid = world(e.from).add(world(e.to)).multiplyScalar(0.5);
        const out = mid.clone().sub(centre());
        out.setComponent(e.axis === 0 ? 1 : e.axis === 1 ? 0 : 2, 0); // push out square to the edge only
        const sp = labelSprite(e.label, finished(e) && e.instance !== last ? 0.5 : 1);
        sp.position.copy(mid).add(out.setLength(0.45));
        layer.add(sp);
      }
    }
    if (lastWhole) {
      SQUARE_FACE.forEach((p) => layer.add(dome(p)));
      layer.add(face(SQUARE_FACE));
      if (latticeOn) drawLattice(2);
      // Z joins at the start corner.
      const dot = new THREE.Mesh(new THREE.SphereGeometry(R * 2.2, 32, 16), junctionMat);
      dot.userData.own = true;
      dot.position.copy(world([0, 0, 0]));
      layer.add(dot);
    }
    if (complete()) {
      CUBE_CORNERS.forEach((p) => layer.add(dome(p)));
      CUBE_FACES.forEach((f) => layer.add(face(f)));
      if (latticeOn) drawLattice();
    }
  }
  // The 3×3×3 block of cubes around the finished one: every lattice edge
  // on the grid lines -N, 0, N, 2N, but the cube's own twelve.
  // The square's is its 3×3 in the plane (Z stays 0).
  function drawLattice(dims = 3) {
    const G = [-N, 0, N, 2 * N];
    const own = (a, b) => [...a, ...b].every((v) => v === 0 || v === N);
    for (let axis = 0; axis < dims; axis++) {
      if (dims === 2) {
        for (const u of G) for (let k = 0; k < 3; k++) {
          const from = [0, 0, 0], to = [0, 0, 0];
          from[1 - axis] = to[1 - axis] = u;
          from[axis] = G[k]; to[axis] = G[k + 1];
          if (!own(from, to)) layer.add(cellMesh({ from, to }, latticeMat, edgeGhostGeo));
        }
        continue;
      }
      for (const u of G) for (const v of G) {
        for (let k = 0; k < 3; k++) {
          const from = [0, 0, 0], to = [0, 0, 0];
          const [p, q] = [0, 1, 2].filter((d) => d !== axis);
          from[p] = to[p] = u; from[q] = to[q] = v;
          from[axis] = G[k]; to[axis] = G[k + 1];
          if (own(from, to)) continue;
          layer.add(cellMesh({ from, to }, latticeMat, edgeGhostGeo));
        }
      }
    }
  }
  function draw() {
    for (const child of [...layer.children]) {
      layer.remove(child);
      if (child.userData.own) child.geometry.dispose();
      if (child.userData.ownMaterial) child.material.dispose();
    }
    if (!active) return;
    if (squareStage()) drawSquareStage();
    else drawCubeStage();
    renderPanel();
  }
  // The square is seen straight on (direct request: "this vertical should
  // be pure, without perspective"), so its lines stay truly vertical and
  // horizontal. Once Z joins, the view turns to three-quarters so the
  // cube's depth shows ("turn, with perspective").
  function pose() {
    const c = centre();
    const flat = squareStage() || squareLattice();
    const dir = flat ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0.5, 0.32, 0.8).normalize();
    const dist = squareStage() ? 2.3 : squareLattice() ? 6.4 : latticeOn && complete() ? 8.5 : 3.6;
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
    if (latticeOn && !latticeReady()) { latticeOn = false; frame(true); }
    save(); draw(); onChange();
    if ((before < SQUARE_STEPS) !== squareStage()) frame(true); // the square closed or reopened: turn
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
    if (complete()) return false;
    filled += 1;
    commit(before);
    if (complete()) showHudPrompt(t('con.prompt.done', lang(), { name: 'Cube', n: 12 * SQUARE_N }), 5000);
    else if (filled === SQUARE_STEPS) showHudPrompt(t('con.prompt.square', lang(), { n: SQUARE_STEPS }), 6000);
    else if (filled === HAND_STEPS) showHudPrompt(t('con.prompt.edges', lang()), 5000);
    else if (filled % SQUARE_N === 0 && filled < SQUARE_STEPS) showHudPrompt(t('con.prompt.junction', lang(), { axis: 'Y' }), 4000);
    return true;
  }

  // ---- panel: Clear, and the hand-off once the square is complete ----
  const panel = document.createElement('div');
  panel.id = 'world1dconstruct-panel';
  panel.className = 'qc-panel';
  // Clear (direct request: "we need a (full) clear button"): the whole
  // build in one tap; Undo brings it back.
  panel.innerHTML = '<div class="w4d-row w4d-options"><button type="button" class="con-clear" data-clear>⊘</button><button type="button" class="sig-sym" data-lattice><svg viewBox="-12 -12 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="-10" y="-10" width="20" height="20" rx="1.5"/><path d="M-3.3,-10v20M3.3,-10v20M-10,-3.3h20M-10,3.3h20"/></svg></button><button type="button" class="sig-send" data-open="2D"></button></div>';
  document.body.appendChild(panel);
  const openBtn = panel.querySelector('[data-open]');
  const clearBtn = panel.querySelector('[data-clear]');
  const latticeBtn = panel.querySelector('[data-lattice]');
  latticeBtn.addEventListener('click', () => { latticeOn = !latticeOn; draw(); frame(true); });
  function renderPanel() {
    panel.classList.toggle('visible', active && filled > 0);
    openBtn.hidden = filled !== SQUARE_STEPS;
    latticeBtn.hidden = !latticeReady();
    latticeBtn.classList.toggle('active', latticeOn);
    latticeBtn.title = t('con.lattice', lang());
    latticeBtn.setAttribute('aria-label', latticeBtn.title);
    openBtn.textContent = t('con.open', lang(), { dim: '2D' });
    clearBtn.title = t('con.clear', lang());
    clearBtn.setAttribute('aria-label', clearBtn.title);
  }
  clearBtn.addEventListener('click', () => {
    const before = filled;
    filled = 0;
    commit(before);
    showHudPrompt(t('con.prompt.start', lang()), 5000);
  });
  openBtn.addEventListener('click', () => onOpenIn('2D', 'square'));
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
      if (on) { frame(); if (!filled) showHudPrompt(t('con.prompt.start', lang()), 5000); }
    },
    /** How many dimensions are built so far: 1 (lines), 2 (the square closed), 3 (the cube). */
    reached: () => (complete() ? 3 : squareStage() ? 1 : 2),
    get isEmpty() { return filled === 0; },
    clear() { const before = filled; filled = 0; commit(before); },
    snapshot: toJSON,
    restore(json) {
      const before = filled;
      if (json?.version === 3 && json.n === SQUARE_N && Number.isInteger(json.filled)) filled = Math.max(0, Math.min(steps.length, json.filled));
      save(); draw(); onChange();
      if ((before < SQUARE_STEPS) !== squareStage()) frame(true);
    },
    toJSON,
  };
}
