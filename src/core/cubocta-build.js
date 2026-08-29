// Cuboctahedron build controller -- the real, persistent counterpart to
// Lattice Quick-View's own 'cubocta' preview mode (render.js), the same
// relationship core/bcc-build.js already has to the BCC/TO preview: a
// genuinely separate, much smaller controller, its own store
// (cuboctaWorld), coexisting with (not replacing) the main FCC world.
//
// Growth model is deliberately DIFFERENT from bcc-build.js's own
// face-click-and-match-normal mechanic: a truncated octahedron's FACES
// point toward its 14 real neighbor directions by construction, so
// clicking a face and matching its normal to the nearest neighbor offset
// is unambiguous there. A cuboctahedron's VERTICES point toward its 12
// real FCC neighbors instead (core/lattice.js's own NEIGHBOR_OFFSETS,
// verified numerically before any of this was written -- see that
// file's own header) -- its faces point in unrelated directions, so
// face-normal matching doesn't carry over. Growth here instead matches
// the raycast hit POINT's own direction from the clicked cuboctahedron's
// center against the 12 real neighbor directions, i.e. "click near
// whichever vertex points toward the neighbor you want to grow into."
import * as THREE from 'three';
import { NEIGHBOR_OFFSETS } from './lattice.js';

const NEIGHBOR_DIRECTIONS = NEIGHBOR_OFFSETS.map(
  ([x, y, z]) => new THREE.Vector3(x, y, z).normalize()
);

export function matchNeighborOffsetByDirection(dir) {
  let bestIdx = 0;
  let bestDot = -Infinity;
  NEIGHBOR_DIRECTIONS.forEach((axis, i) => {
    const dot = axis.dot(dir);
    if (dot > bestDot) {
      bestDot = dot;
      bestIdx = i;
    }
  });
  return NEIGHBOR_OFFSETS[bestIdx];
}

export function createCuboctaBuildController({
  renderer,
  camera,
  fccMesh, // the main FCC world's InstancedMesh -- only used to bootstrap the first cuboctahedron near it, see onClick
  cuboctaMesh,
  fccCellAt,
  cuboctaCellAt,
  cuboctaWorld,
  onChange,
  getMaterial,
  isActive, // () => boolean -- Cuboctahedron mode currently selected (and not walking)
}) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  function pick(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    // Both meshes at once, closest hit wins -- lets a click resolve
    // against whichever real geometry is actually nearest the cursor,
    // the same way bcc-build.js's own pick() already does.
    const hits = raycaster.intersectObjects([cuboctaMesh, fccMesh]);
    return hits.length > 0 ? hits[0] : null;
  }

  function onClick(event) {
    if (!isActive()) return;
    const hit = pick(event);
    if (!hit || hit.instanceId === undefined) return;

    let nx, ny, nz;
    if (hit.object === cuboctaMesh) {
      // Normal case: grow from an existing cuboctahedron -- match the
      // hit POINT's own direction from that cuboctahedron's real center
      // against the 12 real neighbor axes (see module header for why
      // this uses the hit point, not the face normal, unlike bcc-
      // build.js's own onClick).
      const cell = cuboctaCellAt(hit.instanceId);
      if (!cell) return;
      // Real world-space center of the hit instance, read directly off
      // its own instance matrix -- SCALE-agnostic (this controller never
      // needs to know SCALE itself), and authoritative regardless of
      // whatever transform cuboctaMesh's own instances actually use.
      const m = new THREE.Matrix4();
      cuboctaMesh.getMatrixAt(hit.instanceId, m);
      const worldCenter = new THREE.Vector3().setFromMatrixPosition(m);
      const dir = hit.point.clone().sub(worldCenter).normalize();
      const [dx, dy, dz] = matchNeighborOffsetByDirection(dir);
      nx = cell.x + dx;
      ny = cell.y + dy;
      nz = cell.z + dz;
    } else {
      // Bootstrap case: no cuboctahedron to click yet -- clicking a face
      // of an existing FCC cell places one at that SAME real lattice
      // point (cuboctahedra live on the identical coordinate grid as the
      // main World, unlike BCC's own shifted lattice, so there's no
      // "nearest point" snap needed here). Overlap with the FCC world
      // is expected and allowed, same as bcc-build.js's own bootstrap
      // case -- this controller never checks for or prevents it.
      const cell = fccCellAt(hit.instanceId);
      if (!cell) return;
      nx = cell.x;
      ny = cell.y;
      nz = cell.z;
    }

    if (cuboctaWorld.has(nx, ny, nz)) return;
    const material = getMaterial();
    cuboctaWorld.addCell(nx, ny, nz, { material });
    onChange();
  }

  function onContextMenu(event) {
    if (!isActive()) return;
    event.preventDefault();
    const hit = pick(event);
    if (!hit || hit.instanceId === undefined || hit.object !== cuboctaMesh) return;
    const cell = cuboctaCellAt(hit.instanceId);
    if (!cell) return;
    cuboctaWorld.removeCell(cell.x, cell.y, cell.z);
    onChange();
  }

  renderer.domElement.addEventListener('click', onClick);
  renderer.domElement.addEventListener('contextmenu', onContextMenu);
  return function dispose() {
    renderer.domElement.removeEventListener('click', onClick);
    renderer.domElement.removeEventListener('contextmenu', onContextMenu);
  };
}
