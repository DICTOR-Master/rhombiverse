// Placement/removal: raycast to find which of the 12 faces of a clicked
// RD was hit, click to add the corresponding neighbor cell, right-click
// to remove the clicked cell. RHOMBIVERSE_PLAN.md section 4, Phase 2.
//
// Touch (tap / long-press) is not implemented yet -- mouse only for now,
// documented here as a known gap rather than a half-working touch handler.
import * as THREE from 'three';
import { NEIGHBOR_OFFSETS, isValidCell } from './lattice.js';

// Unit-normalized neighbor directions, precomputed once. Every RD
// instance shares the same (unrotated) orientation -- see lattice.js --
// and each RD face's outward normal points exactly along its
// corresponding lattice neighbor direction (the RD is the FCC lattice's
// own Voronoi cell), so a raycast hit's flat face normal maps directly
// onto one of these 12 directions with no per-instance transform needed.
const NEIGHBOR_DIRECTIONS = NEIGHBOR_OFFSETS.map(
  ([x, y, z]) => new THREE.Vector3(x, y, z).normalize()
);

function matchNeighborOffset(faceNormal) {
  let bestIdx = 0;
  let bestDot = -Infinity;
  NEIGHBOR_DIRECTIONS.forEach((dir, i) => {
    const dot = dir.dot(faceNormal);
    if (dot > bestDot) {
      bestDot = dot;
      bestIdx = i;
    }
  });
  return NEIGHBOR_OFFSETS[bestIdx];
}

// renderer/camera/mesh: the Phase 1 render.js scene objects to raycast
// against. cellAt(instanceId): looks up the {x,y,z,...} cell for a hit
// instance. world: the worldstate.js store (has/addCell/removeCell).
// onChange: called after any mutation so the caller can re-sync the mesh.
export function createBuildController({ renderer, camera, mesh, cellAt, world, onChange }) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  function pick(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObject(mesh);
    return hits.length > 0 ? hits[0] : null;
  }

  function onClick(event) {
    const hit = pick(event);
    if (!hit || hit.instanceId === undefined) return;
    const cell = cellAt(hit.instanceId);
    if (!cell) return;
    const [dx, dy, dz] = matchNeighborOffset(hit.face.normal);
    const nx = cell.x + dx;
    const ny = cell.y + dy;
    const nz = cell.z + dz;
    if (!isValidCell(nx, ny, nz) || world.has(nx, ny, nz)) return;
    world.addCell(nx, ny, nz, { material: 'base' });
    onChange();
  }

  function onContextMenu(event) {
    event.preventDefault();
    const hit = pick(event);
    if (!hit || hit.instanceId === undefined) return;
    const cell = cellAt(hit.instanceId);
    if (!cell) return;
    world.removeCell(cell.x, cell.y, cell.z);
    onChange();
  }

  renderer.domElement.addEventListener('click', onClick);
  renderer.domElement.addEventListener('contextmenu', onContextMenu);

  return function dispose() {
    renderer.domElement.removeEventListener('click', onClick);
    renderer.domElement.removeEventListener('contextmenu', onContextMenu);
  };
}
