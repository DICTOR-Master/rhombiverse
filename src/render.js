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
import { createBuildController } from './build.js';
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
document.getElementById('app').appendChild(renderer.domElement);

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

// Tint for a cell by its shell-fill distance (lattice.js's
// cellsInShells), so shells placed by the shift+click fill tool are
// visually distinguishable outward. Cells with no `shell` (plain single
// clicks, or the original seed) get white -- an identity multiplier
// against the material's own base color, i.e. no visible tint change.
// Hue cycles per shell (0.15 turns/shell) rather than a fixed palette, so
// it stays distinct for any shell count the UI allows.
const _shellColorCache = new Map();
function shellColor(shell) {
  if (!shell) return new THREE.Color(1, 1, 1);
  if (!_shellColorCache.has(shell)) {
    _shellColorCache.set(shell, new THREE.Color().setHSL((shell * 0.15) % 1, 0.65, 0.55));
  }
  return _shellColorCache.get(shell);
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
    mesh.setColorAt(i, shellColor(cell.shell));
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
  const material = new THREE.MeshStandardMaterial({
    color: 0x8899aa,
    metalness: 0.15,
    roughness: 0.55,
    flatShading: true,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, MAX_CELLS);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(mesh);

  rebuildInstances(mesh, world);

  function onChange() {
    rebuildInstances(mesh, world);
    saveToLocalStorage(world.toJSON());
  }

  const shellCountInput = document.getElementById('shell-count');

  createBuildController({
    renderer,
    camera,
    mesh,
    cellAt: (instanceId) => cellOrder[instanceId],
    world,
    onChange,
    getShellCount: () => Math.max(1, Number(shellCountInput.value) || 1),
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
