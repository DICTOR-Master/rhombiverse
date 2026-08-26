// BCC dual-lattice build controller -- the same face-click mechanic as
// core/build.js's own 'build' mode (hover a face, click, the next cell
// appears adjacent), but placing on the truncated octahedron's own 14
// faces (BCC_NEIGHBOR_OFFSETS) instead of the RD's 12, into its own
// separate bccWorld store rather than the main FCC one. A genuinely
// separate, much smaller controller -- not a generalization of
// build.js's own multi-mode (fill/round/excavate/generate/report) or
// ghost-preview/drag-placement machinery, which build.js's own shape is
// hard-wired around. Full design rationale: docs/code-notes/core/
// bcc-build.md
import * as THREE from 'three';
import { BCC_NEIGHBOR_OFFSETS, nearestBCCCell } from '../geometry-extensions/dual-lattice.js';

const BCC_NEIGHBOR_DIRECTIONS = BCC_NEIGHBOR_OFFSETS.map(
  ([x, y, z]) => new THREE.Vector3(x, y, z).normalize()
);

export function matchBCCNeighborOffset(faceNormal) {
  let bestIdx = 0;
  let bestDot = -Infinity;
  BCC_NEIGHBOR_DIRECTIONS.forEach((dir, i) => {
    const dot = dir.dot(faceNormal);
    if (dot > bestDot) {
      bestDot = dot;
      bestIdx = i;
    }
  });
  return BCC_NEIGHBOR_OFFSETS[bestIdx];
}

export function createBCCBuildController({
  renderer,
  camera,
  fccMesh, // the main FCC world's InstancedMesh -- only used to bootstrap the first BCC cell near it, see onClick
  bccMesh,
  fccCellAt,
  bccCellAt,
  bccWorld,
  onChange,
  getMaterial,
  isActive, // () => boolean -- BCC mode currently selected (and not walking)
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
    // the same way a single-mesh raycast would.
    const hits = raycaster.intersectObjects([bccMesh, fccMesh]);
    return hits.length > 0 ? hits[0] : null;
  }

  function onClick(event) {
    if (!isActive()) return;
    const hit = pick(event);
    if (!hit || hit.instanceId === undefined) return;

    let nx, ny, nz;
    if (hit.object === bccMesh) {
      // Normal case: extend the existing BCC lattice from one of its own
      // real neighbor directions, exactly like core/build.js's own
      // 'build' mode does for the RD lattice.
      const cell = bccCellAt(hit.instanceId);
      if (!cell) return;
      const [dx, dy, dz] = matchBCCNeighborOffset(hit.face.normal);
      nx = cell.x + dx;
      ny = cell.y + dy;
      nz = cell.z + dz;
    } else {
      // Bootstrap case: no BCC cell to click yet (or the player is
      // starting a new cluster elsewhere) -- clicking a face of an
      // existing FCC cell seeds the nearest real BCC lattice point in
      // that face's outward direction. Overlap with the FCC world here
      // is expected and allowed, not guarded against -- see companion
      // doc for why (direct instruction: cells may overlap to visually
      // join the two structures, this controller never checks for or
      // prevents it).
      const cell = fccCellAt(hit.instanceId);
      if (!cell) return;
      const n = hit.face.normal;
      [nx, ny, nz] = nearestBCCCell(cell.x + n.x, cell.y + n.y, cell.z + n.z);
    }

    if (bccWorld.has(nx, ny, nz)) return;
    const material = getMaterial();
    bccWorld.addCell(nx, ny, nz, { material });
    onChange();
  }

  function onContextMenu(event) {
    if (!isActive()) return;
    event.preventDefault();
    const hit = pick(event);
    if (!hit || hit.instanceId === undefined || hit.object !== bccMesh) return;
    const cell = bccCellAt(hit.instanceId);
    if (!cell) return;
    bccWorld.removeCell(cell.x, cell.y, cell.z);
    onChange();
  }

  renderer.domElement.addEventListener('click', onClick);
  renderer.domElement.addEventListener('contextmenu', onContextMenu);
  return function dispose() {
    renderer.domElement.removeEventListener('click', onClick);
    renderer.domElement.removeEventListener('contextmenu', onContextMenu);
  };
}
