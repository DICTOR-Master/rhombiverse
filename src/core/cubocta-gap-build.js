// Cuboctahedron gap-octahedron build controller -- the manually-placed
// companion to the doubled-density Cuboctahedron Build (cubocta-build.js),
// filling the triangular-face gaps that appear once cuboctahedra occupy
// both lattice parities. Real geometry, verified numerically this session
// (not assumed): a plain axis-aligned regular octahedron, radius 0.5s --
// the SAME reach scale the existing CO already uses -- centered at a unit
// lattice cell's own cube-center. Its own coordinate frame is genuinely
// offset from the main integer grid (world position (i+0.5,j+0.5,k+0.5)*s
// for index (i,j,k)), same reasoning geometry-extensions/bcc-detail-
// lattice.js already establishes for a differently-scaled/offset
// sub-lattice -- still a single 3-integer address, so a plain
// createWorldStore works, just in this offset frame.
import * as THREE from 'three';

export function octGapCellToWorld(i, j, k, s = 1) {
  return [(i + 0.5) * s, (j + 0.5) * s, (k + 0.5) * s];
}

// Every cuboctahedron has 8 candidate gap-octahedron neighbors, one per
// body-diagonal direction. Direction (sx,sy,sz) maps to the octahedron
// cell whose own (i+0.5,j+0.5,k+0.5) sits on that side of the CO's
// integer cell (x,y,z) -- e.g. sx>0 means the octahedron's own i+0.5
// must be x+0.5, so i=x; sx<0 means i+0.5=x-0.5, so i=x-1.
const BODY_DIAGONAL_OFFSETS = [
  [1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1],
  [-1, 1, 1], [-1, 1, -1], [-1, -1, 1], [-1, -1, -1],
];
const BODY_DIAGONAL_DIRECTIONS = BODY_DIAGONAL_OFFSETS.map(
  ([x, y, z]) => new THREE.Vector3(x, y, z).normalize()
);

export function matchBodyDiagonalByDirection(dir) {
  let bestIdx = 0;
  let bestDot = -Infinity;
  BODY_DIAGONAL_DIRECTIONS.forEach((axis, i) => {
    const dot = axis.dot(dir);
    if (dot > bestDot) {
      bestDot = dot;
      bestIdx = i;
    }
  });
  return BODY_DIAGONAL_OFFSETS[bestIdx];
}

export function octGapCellForCOCell(coCell, [sx, sy, sz]) {
  return [
    sx > 0 ? coCell.x : coCell.x - 1,
    sy > 0 ? coCell.y : coCell.y - 1,
    sz > 0 ? coCell.z : coCell.z - 1,
  ];
}

export function createCuboctaGapBuildController({
  renderer,
  camera,
  cuboctaMesh, // the CO build's own InstancedMesh -- clicked to grow a new octahedron
  octGapMesh,
  cuboctaCellAt,
  octGapCellAt,
  octGapWorld,
  onChange,
  getMaterial,
  isActive, // () => boolean -- Gap Octahedron sub-piece currently selected within Cuboctahedron Build mode (and not walking)
}) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  function pick(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    // Own mesh checked first, same defensive pick-order cubocta-build.js
    // itself documents (its own header, "no 'nearest point' snap needed"
    // bug) -- costs nothing here even though gap-octahedra sit in real
    // empty space (not nested inside a larger cell the way CO sits
    // inside its host FCC cell), so the original failure mode doesn't
    // apply, but keeping the same ordering is free and consistent.
    const gapHits = raycaster.intersectObject(octGapMesh);
    if (gapHits.length > 0) return gapHits[0];
    const coHits = raycaster.intersectObject(cuboctaMesh);
    return coHits.length > 0 ? coHits[0] : null;
  }

  function onClick(event) {
    if (!isActive()) return;
    const hit = pick(event);
    if (!hit || hit.instanceId === undefined) return;
    // Clicking an existing octahedron is a no-op here -- there's no
    // meaningful "grow from octahedron" direction (adjacent
    // gap-octahedra only ever touch at a single point, never a face;
    // every new octahedron is placed by clicking a real CO instead).
    if (hit.object !== cuboctaMesh) return;

    const cell = cuboctaCellAt(hit.instanceId);
    if (!cell) return;
    const m = new THREE.Matrix4();
    cuboctaMesh.getMatrixAt(hit.instanceId, m);
    const worldCenter = new THREE.Vector3().setFromMatrixPosition(m);
    const dir = hit.point.clone().sub(worldCenter).normalize();
    const offset = matchBodyDiagonalByDirection(dir);
    const [nx, ny, nz] = octGapCellForCOCell(cell, offset);

    if (octGapWorld.has(nx, ny, nz)) return;
    const material = getMaterial();
    octGapWorld.addCell(nx, ny, nz, { material });
    onChange();
  }

  function onContextMenu(event) {
    if (!isActive()) return;
    event.preventDefault();
    const hit = pick(event);
    if (!hit || hit.instanceId === undefined || hit.object !== octGapMesh) return;
    const cell = octGapCellAt(hit.instanceId);
    if (!cell) return;
    octGapWorld.removeCell(cell.x, cell.y, cell.z);
    onChange();
  }

  // Touch long-press -> removal, same duplicated pattern cubocta-
  // build.js itself uses (and documents why: core/build.js's own
  // long-press timer on the same canvas calls preventDefault() on
  // touchend, so the real 'contextmenu' DOM event this listener depends
  // on never arrives on touch at all).
  let touchStartX = 0;
  let touchStartY = 0;
  let longPressTimer = null;
  const LONG_PRESS_MS = 500;
  const LONG_PRESS_MOVE_TOLERANCE = 12;
  function onTouchStart(event) {
    if (!isActive() || event.touches.length !== 1) { clearTimeout(longPressTimer); return; }
    const t = event.touches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
    clearTimeout(longPressTimer);
    longPressTimer = setTimeout(() => {
      onContextMenu({ preventDefault: () => {}, clientX: touchStartX, clientY: touchStartY });
    }, LONG_PRESS_MS);
  }
  function onTouchMove(event) {
    if (event.touches.length !== 1) { clearTimeout(longPressTimer); return; }
    const t = event.touches[0];
    const moved = Math.hypot(t.clientX - touchStartX, t.clientY - touchStartY);
    if (moved > LONG_PRESS_MOVE_TOLERANCE) clearTimeout(longPressTimer);
  }
  function onTouchEnd() { clearTimeout(longPressTimer); }

  renderer.domElement.addEventListener('click', onClick);
  renderer.domElement.addEventListener('contextmenu', onContextMenu);
  renderer.domElement.addEventListener('touchstart', onTouchStart, { passive: true });
  renderer.domElement.addEventListener('touchmove', onTouchMove, { passive: true });
  renderer.domElement.addEventListener('touchend', onTouchEnd, { passive: true });
  return function dispose() {
    renderer.domElement.removeEventListener('click', onClick);
    renderer.domElement.removeEventListener('contextmenu', onContextMenu);
    renderer.domElement.removeEventListener('touchstart', onTouchStart);
    renderer.domElement.removeEventListener('touchmove', onTouchMove);
    renderer.domElement.removeEventListener('touchend', onTouchEnd);
    clearTimeout(longPressTimer);
  };
}
