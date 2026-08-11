// Raycasts to find which of the 12 faces of a clicked RD was hit, then
// acts according to the currently selected build MODE (an explicit
// #mode-* button in index.html, read via getMode() -- see render.js).
// RHOMBIVERSE_PLAN.md section 4, Phase 2's original click-to-add is now
// the "build" mode; three more modes (fill, round, excavate) were added
// early, ahead of their originally planned phases, at the user's
// request. Right-click always removes the clicked cell, in every mode --
// kept as a single universal, unambiguous gesture rather than folded
// into the mode system, per direct instruction (2026-08-11).
//
// This replaced an earlier modifier-key scheme (Shift+click / Ctrl+click
// / Ctrl+Shift+click for fill/round/excavate) that grew unmanageable:
// five behaviors on one "click" gesture, distinguished only by which
// modifiers you remembered to hold, including two pairs of literal
// opposites (fill vs. excavate, add vs. remove) one keystroke apart, with
// no visual indication of what a click would currently do. An explicit
// mode selector is the standard fix for this (how most voxel/CAD editors
// handle multiple click tools) -- exactly one mode active at a time,
// visually shown, plain click does whatever that mode does.
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

// Removes an existing structure's cells with shell < minShell, carving
// out its interior. The center cell itself is never touched (it has no
// `shell` field, so it never matches the filter below).
function excavateStructure(world, centerKey, minShell) {
  const structure = world
    .entries()
    .filter((c) => c.shellCenter === centerKey && c.shell !== undefined);
  for (const c of structure) {
    if (c.shell < minShell) {
      world.removeCell(c.x, c.y, c.z);
    }
  }
}

// Removes every cell at exactly one shell number for a structure -- the
// "select a ring to remove" panel in render.js calls this directly (not
// via a canvas click), one ring at a time. Exported since render.js's
// ring-list UI needs it, unlike round/excavateStructure which are only
// ever reached through onClick's mode dispatch below.
export function removeShell(world, centerKey, shellNumber) {
  const structure = world
    .entries()
    .filter((c) => c.shellCenter === centerKey && c.shell === shellNumber);
  for (const c of structure) {
    world.removeCell(c.x, c.y, c.z);
  }
}

// Changes every cell at exactly one shell number to a different material
// IN PLACE -- no geometry change, so unlike a remove-then-refill via
// Fill mode this never requires clicking a specific cell in the 3D view
// (there's nothing left to click once a ring is removed) and can't
// accidentally change which cells exist. Added because "remove a ring
// and fill it in with a different material" turned out to really mean
// "recolor this ring," and coordinating Fill mode's exact shell-range
// inputs plus finding a valid cell to click was the actual source of
// difficulty, not a missing remove/fill feature.
export function recolorShell(world, centerKey, shellNumber, material) {
  const structure = world
    .entries()
    .filter((c) => c.shellCenter === centerKey && c.shell === shellNumber);
  for (const c of structure) {
    const { x, y, z, ...data } = c;
    world.addCell(x, y, z, { ...data, material });
  }
}

// renderer/camera/mesh: the Phase 1 render.js scene objects to raycast
// against. cellAt(instanceId): looks up the {x,y,z,...} cell for a hit
// instance. world: the worldstate.js store (has/addCell/removeCell).
// onChange: called after any mutation so the caller can re-sync the mesh.
// getMode(): reads the active build mode ('build'|'fill'|'round'|
// 'excavate') from the UI. getShellCount()/getMinShell(): read the
// fill/excavate shell range. getMaterial(): reads the selected material.
// onCellClicked(cell): called with every successfully-hit cell,
// regardless of mode -- render.js uses this to track which structure's
// shells the ring-list panel should currently show.
export function createBuildController({
  renderer,
  camera,
  mesh,
  cellAt,
  world,
  onChange,
  getMode,
  getShellCount,
  getMinShell,
  getMaterial,
  onCellClicked,
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

    const mode = getMode();
    if (!mode) return; // e.g. Walk mode active -- editing is disabled while walking

    if (onCellClicked) onCellClicked(cell);

    if (mode === 'excavate') {
      if (cell.shellCenter) {
        excavateStructure(world, cell.shellCenter, getMinShell());
        onChange();
      }
      return;
    }

    if (mode === 'round') {
      if (cell.shellCenter) {
        roundStructure(world, cell.shellCenter);
        onChange();
      }
      return;
    }

    if (mode === 'fill') {
      const maxShell = getShellCount();
      const minShell = Math.min(getMinShell(), maxShell);
      const material = getMaterial();
      // If the clicked cell already belongs to a shell-filled structure
      // (it was itself placed by, or is the original center of, an
      // earlier fill), grow THAT structure's true center outward instead
      // of starting a new one where you happened to click -- otherwise a
      // second fill-mode click on an outer shell builds an unrelated
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
      // Re-report focus with the now-definitive centerKey: on a fill that
      // just created a brand-new structure (cell had no shellCenter yet
      // when onCellClicked fired above, before this mutation), the
      // earlier call reported no focus at all -- caught by a real
      // integration test, not assumed. Without this, the ring panel
      // wouldn't show the shells you just built until a second click.
      if (onCellClicked) onCellClicked({ shellCenter: centerKey });
      onChange();
      return;
    }

    // mode === 'build' (default)
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
    if (!getMode()) return; // e.g. Walk mode active -- editing is disabled while walking
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
