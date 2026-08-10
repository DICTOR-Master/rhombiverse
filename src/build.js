// Placement/removal: raycast to find which of the 12 faces of a clicked
// RD was hit, click to add the corresponding neighbor cell, right-click
// to remove the clicked cell. RHOMBIVERSE_PLAN.md section 4, Phase 2.
// Shift+click instead fills shells minShell..maxShell outward from a
// center (the Phase 5.5 "shell fill" / fill-sphere shortcut, see
// lattice.js's cellsInShells -- minShell > 1 gives a hollow-shell build).
// Ctrl+click (Cmd on Mac) "rounds" the clicked structure: reselects its
// outer boundary by true Euclidean distance from center instead of raw
// shell membership, since a single BFS shell spans a wide range of
// actual distances (measured: shell 6 ranges 6.0-8.485 world units,
// wider than the ~1.15-unit average spacing BETWEEN shells) -- that
// spread is exactly why a shell-filled sphere looks faceted rather than
// round, and reselecting by distance is what actually fixes it. All
// three built early at the user's request, ahead of their originally
// planned phases.
//
// Touch (tap / long-press) is not implemented yet -- mouse only for now,
// documented here as a known gap rather than a half-working touch handler.
import * as THREE from 'three';
import {
  NEIGHBOR_OFFSETS,
  isValidCell,
  cellsInShells,
  cellKey,
  parseCellKey,
  cellToWorld,
} from './lattice.js';

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

function distanceFromCenter(cx, cy, cz, x, y, z) {
  const [cwx, cwy, cwz] = cellToWorld(cx, cy, cz);
  const [wx, wy, wz] = cellToWorld(x, y, z);
  return Math.hypot(wx - cwx, wy - cwy, wz - cwz);
}

// "Rounds" a shell-filled structure: trims outer-shell cells that sit
// past the outer shell's own average distance (its "points"/corners) and
// fills any gap that leaves within a band near that target radius,
// including candidates one shell further out whose true distance still
// qualifies (shells overlap in raw distance -- shell 5's max, 7.071, is
// already past shell 6's min, 6.0). Never touches cells well inside the
// target radius, so a hollow-shell structure's interior is left alone --
// this only reshapes the current outer surface. TOLERANCE is a tunable
// heuristic (per this project's own convention for unmeasured constants),
// not a physically derived value.
function roundStructure(world, centerKey) {
  const [cx, cy, cz] = parseCellKey(centerKey);
  const structure = world
    .entries()
    .filter((c) => c.shellCenter === centerKey && c.shell !== undefined);
  if (structure.length === 0) return;

  const maxShellNum = Math.max(...structure.map((c) => c.shell));
  const outer = structure.filter((c) => c.shell === maxShellNum);

  const dist = (x, y, z) => distanceFromCenter(cx, cy, cz, x, y, z);
  const targetRadius = outer.reduce((sum, c) => sum + dist(c.x, c.y, c.z), 0) / outer.length;
  const TOLERANCE = 0.75;

  const materialCounts = {};
  for (const c of outer) materialCounts[c.material] = (materialCounts[c.material] || 0) + 1;
  const fillMaterial = Object.entries(materialCounts).sort((a, b) => b[1] - a[1])[0][0];

  for (const c of structure) {
    if (dist(c.x, c.y, c.z) > targetRadius + TOLERANCE) {
      world.removeCell(c.x, c.y, c.z);
    }
  }

  for (const cand of cellsInShells(cx, cy, cz, maxShellNum + 1)) {
    const d = dist(cand.x, cand.y, cand.z);
    if (
      d >= targetRadius - TOLERANCE &&
      d <= targetRadius + TOLERANCE &&
      !world.has(cand.x, cand.y, cand.z)
    ) {
      world.addCell(cand.x, cand.y, cand.z, {
        material: fillMaterial,
        shell: cand.shell,
        shellCenter: centerKey,
      });
    }
  }
}

// renderer/camera/mesh: the Phase 1 render.js scene objects to raycast
// against. cellAt(instanceId): looks up the {x,y,z,...} cell for a hit
// instance. world: the worldstate.js store (has/addCell/removeCell).
// onChange: called after any mutation so the caller can re-sync the mesh.
// getShellCount()/getMinShell(): read the shell-fill range from the UI.
// getMaterial(): reads the selected material to place.
export function createBuildController({
  renderer,
  camera,
  mesh,
  cellAt,
  world,
  onChange,
  getShellCount,
  getMinShell,
  getMaterial,
}) {
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

    if (event.ctrlKey || event.metaKey) {
      if (cell.shellCenter) {
        roundStructure(world, cell.shellCenter);
        onChange();
      }
      return;
    }

    if (event.shiftKey) {
      const maxShell = getShellCount();
      const minShell = Math.min(getMinShell(), maxShell);
      const material = getMaterial();
      // If the clicked cell already belongs to a shell-filled structure
      // (it was itself placed by, or is the original center of, an
      // earlier fill), grow THAT structure's true center outward instead
      // of starting a new one where you happened to click -- otherwise a
      // second shift+click on an outer shell builds an unrelated
      // same-sized cluster next door rather than a bigger sphere.
      const centerKey = cell.shellCenter || cellKey(cell.x, cell.y, cell.z);
      const [ccx, ccy, ccz] = parseCellKey(centerKey);

      if (!cell.shellCenter) {
        const { x, y, z, ...data } = cell;
        world.addCell(x, y, z, { ...data, shellCenter: centerKey });
      }

      for (const c of cellsInShells(ccx, ccy, ccz, maxShell, minShell)) {
        if (!world.has(c.x, c.y, c.z)) {
          world.addCell(c.x, c.y, c.z, { material, shell: c.shell, shellCenter: centerKey });
        }
      }
      onChange();
      return;
    }

    const [dx, dy, dz] = matchNeighborOffset(hit.face.normal);
    const nx = cell.x + dx;
    const ny = cell.y + dy;
    const nz = cell.z + dz;
    if (!isValidCell(nx, ny, nz) || world.has(nx, ny, nz)) return;
    world.addCell(nx, ny, nz, { material: getMaterial() });
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
