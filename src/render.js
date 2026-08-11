// Three.js scene, camera, RD mesh generation, instanced rendering.
// Phase 1 (RHOMBIVERSE_PLAN.md section 4): renderer + lattice math, camera
// orbit. Phase 2: wires build.js's click-to-add/remove controller onto
// the same InstancedMesh, re-syncing it after every world-state change.
// Phase 3: every change also saves to localStorage, and wires the New
// World / Export / Import buttons.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { rdRawVerts, cellToWorld } from './lattice.js';
import { loadWorld, createWorldStore } from './worldstate.js';
import { createBuildController, removeShell, recolorShell } from './build.js';
import {
  saveToLocalStorage,
  loadFromLocalStorage,
  clearLocalStorage,
  exportWorldFile,
  importWorldFile,
} from './persistence.js';

const SCALE = 1;
// Fixed InstancedMesh capacity. Cumulative cells through shell 8 alone is
// ~2057 (see lattice.js's shellCount); 20000 leaves headroom for several
// shell-fills plus hand-building. Revisit for real player counts.
const MAX_CELLS = 20000;
// Real, enforced cap on the shell-count/hollow-from UI inputs --
// cumulative cells through shell 15 is 12431 (1 + sum of shellCount(n)
// for n=1..15), leaving real headroom under MAX_CELLS for hand-built
// cells or a second structure. Previously these had inconsistent,
// PURELY COSMETIC max= HTML attributes that didn't actually stop anyone
// from typing past them -- a real bug (shell-count had nothing stopping
// a request for shell 100, ~200k+ cells, far past MAX_CELLS) as well as
// a confusing inconsistency, caught by the user.
const MAX_SHELL = 15;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05050a);

const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(6, 5, 8);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.localClippingEnabled = true; // required once, globally, for any clippingPlanes to take effect
document.getElementById('app').appendChild(renderer.domElement);

// Section view: a single cutaway clipping plane through the whole scene
// (RHOMBIVERSE_PLAN.md doesn't cover this -- added at the user's request
// so the shell system, previously invisible from outside a solid
// structure, can actually be seen and understood). Disabled by default
// (empty clippingPlanes array); #section-enable populates
// material.clippingPlanes with this same Plane object, so mutating its
// normal/constant here is picked up automatically next frame with no
// separate "apply" step.
const sectionPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
function updateSectionPlane() {
  const axis = document.getElementById('section-axis').value;
  const flip = document.getElementById('section-flip').checked;
  const pos = Number(document.getElementById('section-pos').value) || 0;
  // The plane's own position (a point on it) is always `pos` along the
  // chosen axis, regardless of flip -- only the normal direction (which
  // side gets kept vs. clipped) should change when flipping, not where
  // the plane physically sits.
  const axisVec = new THREE.Vector3(
    axis === 'x' ? 1 : 0,
    axis === 'y' ? 1 : 0,
    axis === 'z' ? 1 : 0
  );
  const pointOnPlane = axisVec.clone().multiplyScalar(pos);
  const normal = flip ? axisVec.clone().negate() : axisVec.clone();
  sectionPlane.setFromNormalAndCoplanarPoint(normal, pointOnPlane);
}

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0, 0);
// Right-click is reserved for block removal (build.js), not camera pan.
controls.mouseButtons.RIGHT = null;

scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(5, 8, 4);
scene.add(sun);

// Builds one RD's geometry via convex hull over its 14 raw vertices --
// the JS equivalent of the scipy ConvexHull step this project family's
// own `build_polyhedron` (dictoroids_tetraroid.py) uses for every solid.
// Only triangulated faces are needed for rendering, not build_polyhedron's
// merged N-gon face structure, which is a physics-layer concern this
// project doesn't have yet.
function buildRDGeometry(scale = 1) {
  const points = rdRawVerts(scale).map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const geometry = new ConvexGeometry(points);
  geometry.computeVertexNormals();
  return geometry;
}

// Base color per material (RHOMBIVERSE_SPEC_PLANETOID_GRAVITY.md's
// Glassite family, RHOMBIVERSE_SPEC_ASTEROIDS.md's Garnet/Ferrostone,
// RHOMBIVERSE_SPEC_WATER_ICE.md's Water/Ice 9.9). The shared
// InstancedMesh material's own .color is left white (see init()) so
// these show through unmodified via setColorAt -- cosmetic only for now,
// no material has functional behavior yet (gravity/hydrosphere land in
// Phase 5.5).
const MATERIAL_COLORS = {
  base: 0x8899aa,
  garnet: 0x8b2e2e,
  ferrostone: 0x5a5a5a,
  glassite: 0xbfe3f0,
  'star-glassite': 0xdff3ff,
  'blackstar-glassite': 0x1a1a22,
  ice99: 0xd8f0ff,
  water: 0x2e6f9e,
};

function materialColor(material) {
  return new THREE.Color(MATERIAL_COLORS[material] ?? MATERIAL_COLORS.base);
}

// Tint for a cell by its shell-fill distance (lattice.js's
// cellsInShells), so shells placed by the shift+click fill tool are
// visually distinguishable outward. Cells with no `shell` (plain single
// clicks, or the original seed) get white -- an identity multiplier, no
// tint. Hue cycles per shell (0.15 turns/shell) rather than a fixed
// palette, so it stays distinct for any shell count the UI allows.
const _shellColorCache = new Map();
function shellTint(shell) {
  if (!shell) return new THREE.Color(1, 1, 1);
  if (!_shellColorCache.has(shell)) {
    _shellColorCache.set(shell, new THREE.Color().setHSL((shell * 0.15) % 1, 0.65, 0.55));
  }
  return _shellColorCache.get(shell);
}

// Final per-instance color: the cell's material color, lightly blended
// (35%) toward its shell tint so shell rings stay visible without
// obscuring which material a cell actually is.
function instanceColorFor(cell) {
  const base = materialColor(cell.material);
  if (!cell.shell) return base;
  return base.clone().lerp(shellTint(cell.shell), 0.35);
}

// instanceId -> {x, y, z, ...cellData}, refreshed on every rebuild. Read
// by build.js's raycast controller to turn a clicked instance back into
// lattice coordinates.
let cellOrder = [];

function rebuildInstances(mesh, world) {
  cellOrder = world.entries();
  const m = new THREE.Matrix4();
  cellOrder.forEach((cell, i) => {
    const [wx, wy, wz] = cellToWorld(cell.x, cell.y, cell.z, SCALE);
    m.makeTranslation(wx, wy, wz);
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, instanceColorFor(cell));
  });
  mesh.count = cellOrder.length;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  // InstancedMesh.raycast() only computes its bounding-sphere pre-check
  // lazily, ONCE, then caches it forever (three.js's own source: `if
  // (this.boundingSphere === null) this.computeBoundingSphere()`). It is
  // never auto-invalidated when `count` grows or instances move, so
  // without forcing a recompute here, any click outside whatever sphere
  // happened to be cached on the first-ever raycast is silently dropped
  // before per-instance testing even runs -- the exact cause of a real
  // bug where only cells near the very first click's bounding sphere
  // could ever be built.
  mesh.computeBoundingSphere();
}

async function init() {
  // A saved build takes priority over the static seed -- that's the
  // whole point of Phase 3 (refreshing preserves the build).
  const worldJSON = loadFromLocalStorage() ?? (await loadWorld('./data/starter-world.json'));
  const world = createWorldStore(worldJSON);

  const geometry = buildRDGeometry(SCALE);
  // White base color: actual per-cell color comes entirely from
  // setColorAt (instanceColorFor) via the multiplicative USE_INSTANCING_
  // COLOR shader path, so white here is an identity multiplier that lets
  // the per-instance color show through unmodified.
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.15,
    roughness: 0.55,
    flatShading: true,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, MAX_CELLS);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(mesh);

  rebuildInstances(mesh, world);

  // Undo: a full-world-JSON snapshot stack, not a diff/command log --
  // simpler to reason about correctly than tracking per-operation
  // inverses, and every operation (build/fill/round/excavate/ring
  // remove/New World/Import) already produces a full JSON via
  // world.toJSON(), so this covers all of them uniformly for free.
  // lastSnapshot always holds the state as of the END of the previous
  // onChange -- i.e. exactly the state right before whatever mutation
  // onChange is currently reporting -- so pushing it captures the
  // correct "before" state without needing to hook every individual
  // world.addCell/removeCell call site.
  const undoStack = [];
  const MAX_UNDO = 20;
  let lastSnapshot = JSON.stringify(world.toJSON());

  function updateUndoButton() {
    const btn = document.getElementById('undo-btn');
    btn.disabled = undoStack.length === 0;
    btn.textContent = undoStack.length > 0 ? `Undo (${undoStack.length})` : 'Undo';
  }

  // Ring list: "standard view" of the last-clicked structure's shells,
  // each with its own remove button -- added per direct request, to
  // replace the onion-skin min/max number inputs (view-only, removed)
  // with something that both shows the structure at a glance AND lets
  // individual shells be permanently removed, safety-netted by the undo
  // button above.
  let focusedCenterKey = null;

  // Same hue formula as shellTint() above, so a shell's color in this 2D
  // diagram matches its tint in the actual 3D view -- one color means
  // the same thing everywhere, deliberately, for the "idiot proof" goal.
  function shellHue(shell) {
    return ((shell * 0.15) % 1) * 360;
  }

  const SVG_NS = 'http://www.w3.org/2000/svg';

  // Concentric-circle "bullseye" diagram: painted largest shell first so
  // each smaller circle draws on top and covers the larger one's center,
  // leaving only its own ring-shaped band visible -- the standard, simple
  // way to get real donut-shaped click targets without annulus/arc path
  // math. Kept alongside the text list below (not replacing it): a thin
  // visual ring is easy to mis-click, so the list is the precise fallback
  // for actually hitting one specific shell.
  function renderRingDiagram(shells, counts) {
    const size = 176;
    const cx = size / 2;
    const cy = size / 2;
    const maxRadius = size / 2 - 6;
    const maxShell = shells[shells.length - 1];
    const radiusFor = (n) => (n / maxShell) * maxRadius;

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);

    for (let i = shells.length - 1; i >= 0; i--) {
      const shell = shells[i];
      const circle = document.createElementNS(SVG_NS, 'circle');
      circle.setAttribute('cx', cx);
      circle.setAttribute('cy', cy);
      circle.setAttribute('r', radiusFor(shell));
      circle.setAttribute('fill', `hsl(${shellHue(shell)}, 65%, 50%)`);
      circle.setAttribute('stroke', 'rgba(0,0,0,0.5)');
      circle.style.cursor = 'pointer';
      circle.addEventListener('click', () => {
        removeShell(world, focusedCenterKey, shell);
        onChange();
      });
      const title = document.createElementNS(SVG_NS, 'title');
      title.textContent = `Shell ${shell} · ${counts.get(shell)} cells (click to remove)`;
      circle.appendChild(title);
      svg.appendChild(circle);
    }

    const centerDot = document.createElementNS(SVG_NS, 'circle');
    centerDot.setAttribute('cx', cx);
    centerDot.setAttribute('cy', cy);
    centerDot.setAttribute('r', 3);
    centerDot.setAttribute('fill', '#fff');
    svg.appendChild(centerDot);

    return svg;
  }

  function renderRingList() {
    const container = document.getElementById('ring-list');
    container.innerHTML = '';
    if (!focusedCenterKey) {
      container.innerHTML = '<div class="placeholder">Click a built structure to see its shells.</div>';
      return;
    }
    const structure = world
      .entries()
      .filter((c) => c.shellCenter === focusedCenterKey && c.shell !== undefined);
    if (structure.length === 0) {
      container.innerHTML = '<div class="placeholder">No shells in this structure.</div>';
      return;
    }
    const counts = new Map();
    for (const c of structure) counts.set(c.shell, (counts.get(c.shell) || 0) + 1);
    const shells = [...counts.keys()].sort((a, b) => a - b);

    container.appendChild(renderRingDiagram(shells, counts));

    for (const shell of shells) {
      const row = document.createElement('div');
      row.className = 'ring-item';
      const label = document.createElement('span');
      label.textContent = `Shell ${shell} · ${counts.get(shell)} cells`;
      const recolorBtn = document.createElement('button');
      recolorBtn.type = 'button';
      recolorBtn.className = 'ring-recolor';
      recolorBtn.textContent = 'Recolor';
      recolorBtn.title = 'Set this shell to the selected material';
      recolorBtn.addEventListener('click', () => {
        recolorShell(world, focusedCenterKey, shell, materialSelect.value);
        onChange();
      });
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'ring-remove';
      removeBtn.textContent = '×';
      removeBtn.title = `Remove shell ${shell}`;
      removeBtn.addEventListener('click', () => {
        removeShell(world, focusedCenterKey, shell);
        onChange();
      });
      row.appendChild(label);
      row.appendChild(recolorBtn);
      row.appendChild(removeBtn);
      container.appendChild(row);
    }
  }

  function onChange() {
    rebuildInstances(mesh, world);
    const afterJSON = world.toJSON();
    const afterStr = JSON.stringify(afterJSON);
    if (afterStr !== lastSnapshot) {
      undoStack.push(lastSnapshot);
      if (undoStack.length > MAX_UNDO) undoStack.shift();
    }
    lastSnapshot = afterStr;
    saveToLocalStorage(afterJSON);
    updateUndoButton();
    renderRingList();
  }

  document.getElementById('undo-btn').addEventListener('click', () => {
    if (undoStack.length === 0) return;
    const prev = undoStack.pop();
    world.replaceAll(JSON.parse(prev));
    lastSnapshot = prev;
    rebuildInstances(mesh, world);
    saveToLocalStorage(world.toJSON());
    updateUndoButton();
    renderRingList();
  });
  updateUndoButton();

  // Section view (clipping plane): #section-enable toggles whether
  // material.clippingPlanes contains sectionPlane at all, AND whether the
  // axis/position/flip sub-controls are even shown -- no point showing
  // controls for a feature that's currently off. The other three
  // controls just mutate the same Plane object in place, picked up
  // automatically by the next rendered frame (no rebuild needed --
  // clipping is a GPU-side spatial test).
  function updateSectionEnabled() {
    const enabled = document.getElementById('section-enable').checked;
    material.clippingPlanes = enabled ? [sectionPlane] : [];
    document.getElementById('section-controls-row').style.display = enabled ? '' : 'none';
  }
  updateSectionPlane();
  updateSectionEnabled();
  document.getElementById('section-enable').addEventListener('change', updateSectionEnabled);
  for (const id of ['section-axis', 'section-flip', 'section-pos']) {
    document.getElementById(id).addEventListener('input', updateSectionPlane);
  }

  const shellCountInput = document.getElementById('shell-count');
  const hollowFromInput = document.getElementById('hollow-from');
  const materialSelect = document.getElementById('material-select');

  const getShellCount = () => Math.min(Math.max(1, Number(shellCountInput.value) || 1), MAX_SHELL);

  // Mode selector: exactly one #mode-btn is "active" at a time; a plain
  // click does whatever that mode does (build.js). Replaced an earlier
  // modifier-key scheme (Shift/Ctrl/Ctrl+Shift+click) that became
  // unmanageable -- see build.js's header comment for the full reasoning.
  //
  // Contextual UI, added because "all options seem available at same
  // time" was a real, separate complaint even after the fill logic
  // itself was verified correct by direct execution: each mode only
  // shows the shell inputs it actually reads (Fill uses both; Excavate
  // uses only "hollow from"; Round and Build use neither), and the hint
  // line states in plain language exactly what a click currently does --
  // so it's possible to tell whether something worked without needing
  // devtools. Material stays visible in every mode, unlike the shell
  // inputs: it's read by Build/Fill for what to place, AND by the ring
  // panel's Recolor button regardless of which mode is active, so hiding
  // it in Round/Excavate would make recoloring require a mode switch
  // just to see the dropdown.
  const MODE_HINTS = {
    build: 'Click a face to add one cell using the selected material.',
    fill: 'Click a cell to fill shells (hollow from–radius) outward around it, approximating a sphere. A second click on the same structure grows it further.',
    round: 'Click a shell-tagged cell to smooth its outer boundary by true distance from center.',
    excavate: 'Click a shell-tagged structure to hollow out its interior below "Hollow from shell".',
  };
  function updateModeUI() {
    const showRadius = currentMode === 'fill';
    const showHollowFrom = currentMode === 'fill' || currentMode === 'excavate';
    document.getElementById('shell-radius-row').style.display = showRadius ? '' : 'none';
    document.getElementById('hollow-from-row').style.display = showHollowFrom ? '' : 'none';
    document.getElementById('mode-hint').textContent = MODE_HINTS[currentMode];
  }

  let currentMode = 'build';
  const modeButtons = document.querySelectorAll('.mode-btn');
  modeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      currentMode = btn.dataset.mode;
      modeButtons.forEach((b) => b.classList.toggle('active', b === btn));
      updateModeUI();
    });
  });
  updateModeUI();

  createBuildController({
    renderer,
    camera,
    mesh,
    cellAt: (instanceId) => cellOrder[instanceId],
    world,
    onChange,
    getMode: () => currentMode,
    getShellCount,
    getMinShell: () => Math.min(Math.max(1, Number(hollowFromInput.value) || 1), getShellCount()),
    getMaterial: () => materialSelect.value,
    onCellClicked: (cell) => {
      focusedCenterKey = cell.shellCenter || null;
      renderRingList();
    },
  });

  document.getElementById('new-world').addEventListener('click', async () => {
    if (!confirm('Start a new world? This clears your current build.')) return;
    clearLocalStorage();
    const fresh = await loadWorld('./data/starter-world.json');
    world.replaceAll(fresh);
    onChange();
  });

  document.getElementById('export-json').addEventListener('click', () => {
    exportWorldFile(world.toJSON());
  });

  const importInput = document.getElementById('import-json');
  importInput.addEventListener('change', async () => {
    const file = importInput.files[0];
    if (!file) return;
    try {
      const parsed = await importWorldFile(file);
      world.replaceAll(parsed);
      onChange();
    } catch (err) {
      alert('That file is not valid Rhombiverse world JSON.');
      console.warn('Rhombiverse: import failed', err);
    } finally {
      importInput.value = '';
    }
  });
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onResize);

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

init();
animate();
