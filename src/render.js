// Three.js scene, camera, RD mesh generation, instanced rendering.
// Phase 1 (RHOMBIVERSE_PLAN.md section 4): one RD renders, camera orbits
// it with mouse drag. No build/placement logic yet.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { rdRawVerts, cellToWorld } from './lattice.js';
import { loadWorld, cellsOf } from './worldstate.js';

const SCALE = 1;

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

scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(5, 8, 4);
scene.add(sun);

// Builds one RD's geometry via convex hull over its 14 raw vertices --
// the JS equivalent of the scipy ConvexHull step this project family's
// own `build_polyhedron` (dictoroids_tetraroid.py) uses for every solid.
// Phase 1 only needs triangulated faces for rendering, not the merged
// N-gon face structure build_polyhedron produces for physics.
function buildRDGeometry(scale = 1) {
  const points = rdRawVerts(scale).map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const geometry = new ConvexGeometry(points);
  geometry.computeVertexNormals();
  return geometry;
}

async function init() {
  const world = await loadWorld('./data/starter-world.json');
  const cells = cellsOf(world);

  const geometry = buildRDGeometry(SCALE);
  const material = new THREE.MeshStandardMaterial({
    color: 0x8899aa,
    metalness: 0.15,
    roughness: 0.55,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, cells.length);

  const m = new THREE.Matrix4();
  cells.forEach(({ x, y, z }, i) => {
    const [wx, wy, wz] = cellToWorld(x, y, z, SCALE);
    m.makeTranslation(wx, wy, wz);
    mesh.setMatrixAt(i, m);
  });
  mesh.instanceMatrix.needsUpdate = true;
  scene.add(mesh);
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
