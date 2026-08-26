// Raycasts to find which of the 12 faces of a clicked RD was hit, then
// acts according to the currently selected build MODE (an explicit
// #mode-* button in index.html, read via getMode() -- see render.js).
// RHOMBIVERSE_PLAN.md section 4. Right-click always removes the clicked
// cell, in every mode. Full design rationale/history for every export
// below: docs/code-notes/core/build.md
import * as THREE from 'three';
import {
  NEIGHBOR_OFFSETS,
  isValidCell,
  cellsInShells,
  cellKey,
  parseCellKey,
  cellToWorld,
} from './lattice.js';
import { generatePlanetoid } from '../geometry-extensions/planetoidgen.js';

const NEIGHBOR_DIRECTIONS = NEIGHBOR_OFFSETS.map(
  ([x, y, z]) => new THREE.Vector3(x, y, z).normalize()
);

export function matchNeighborOffset(faceNormal) {
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
  const TOLERANCE = 0.75; // tunable heuristic, not physically derived

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

export function removeShell(world, centerKey, shellNumber) {
  const structure = world
    .entries()
    .filter((c) => c.shellCenter === centerKey && c.shell === shellNumber);
  for (const c of structure) {
    world.removeCell(c.x, c.y, c.z);
  }
}

export function recolorShell(world, centerKey, shellNumber, material, canPlaceMaterial = () => true) {
  const structure = world
    .entries()
    .filter((c) => c.shellCenter === centerKey && c.shell === shellNumber);
  for (const c of structure) {
    if (!canPlaceMaterial(material, c.x, c.y, c.z)) continue;
    const { x, y, z, ...data } = c;
    world.addCell(x, y, z, { ...data, material });
  }
}

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
  getGeneratorType,
  onCellClicked,
  canPlaceMaterial = () => true,
  getOwnerId = () => null,
  mineRemote = null,
  mineAsteroidCell = () => {},
  onHover = null, // (cells: [{x,y,z}], valid: boolean) -- one entry normally, two while "held"
  onHoverEnd = null,
  onPlaced = null,
  onRemoved = null,
  getDragPlacementEnabled = () => false,
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

  // Suppressed after a drag-placement gesture so the browser's own
  // post-drag synthetic 'click' doesn't ALSO place a cell at the
  // release point.
  let suppressNextClick = false;

  function onClick(event) {
    if (suppressNextClick) {
      suppressNextClick = false;
      return;
    }
    const hit = pick(event);
    if (!hit || hit.instanceId === undefined) return;
    const cell = cellAt(hit.instanceId);
    if (!cell) return;

    const mode = getMode();
    if (!mode) return; // e.g. Walk mode active -- editing is disabled while walking
    if (mode === 'plant') return; // Plant mode's click handling lives in render.js
    if (mode === 'sculpt') return; // Sculpt mode's click handling lives in render.js/sculpture.js
    if (mode === 'bcc') return; // BCC mode's click handling lives in core/bcc-build.js

    if (onCellClicked) onCellClicked(cell);

    if (mode === 'excavate') {
      if (cell.shellCenter) {
        excavateStructure(world, cell.shellCenter, getMinShell());
        onChange();
        if (onRemoved) onRemoved(cell);
      }
      return;
    }

    if (mode === 'round') {
      if (cell.shellCenter) {
        roundStructure(world, cell.shellCenter);
        onChange();
        if (onPlaced) onPlaced(cell);
      }
      return;
    }

    if (mode === 'report') {
      const newStatus = cell.status === 'flagged' ? 'approved' : 'flagged';
      const { x, y, z, ...data } = cell;
      world.addCell(x, y, z, { ...data, status: newStatus });
      onChange();
      return;
    }

    if (mode === 'generate') {
      generatePlanetoid(world, getGeneratorType(), cell.x, cell.y, cell.z, getShellCount(), canPlaceMaterial);
      if (onCellClicked) onCellClicked({ shellCenter: cellKey(cell.x, cell.y, cell.z) });
      onChange();
      if (onPlaced) onPlaced(cell);
      return;
    }

    if (mode === 'replace') {
      const material = getMaterial();
      if (!canPlaceMaterial(material, cell.x, cell.y, cell.z)) return;
      const { x, y, z, ...data } = cell;
      world.addCell(x, y, z, { ...data, material });
      onChange();
      if (onPlaced) onPlaced(cell);
      return;
    }

    if (mode === 'fill') {
      const maxShell = getShellCount();
      const minShell = Math.min(getMinShell(), maxShell);
      const material = getMaterial();
      // If the clicked cell already belongs to a shell-filled structure,
      // grow THAT structure's true center outward instead of starting a
      // new one where you happened to click.
      const centerKey = cell.shellCenter || cellKey(cell.x, cell.y, cell.z);
      const [ccx, ccy, ccz] = parseCellKey(centerKey);

      if (!cell.shellCenter) {
        const { x, y, z, ...data } = cell;
        world.addCell(x, y, z, { ...data, shellCenter: centerKey });
      }

      for (const c of cellsInShells(ccx, ccy, ccz, maxShell, minShell)) {
        if (!world.has(c.x, c.y, c.z) && canPlaceMaterial(material, c.x, c.y, c.z)) {
          world.addCell(c.x, c.y, c.z, { material, shell: c.shell, shellCenter: centerKey });
        }
      }
      // Re-report focus with the now-definitive centerKey -- without this
      // the ring panel wouldn't show the shells just built until a second click.
      if (onCellClicked) onCellClicked({ shellCenter: centerKey });
      onChange();
      if (onPlaced) onPlaced(cell);
      return;
    }

    // mode === 'build' (default)
    const [dx, dy, dz] = matchNeighborOffset(hit.face.normal);
    const nx = cell.x + dx;
    const ny = cell.y + dy;
    const nz = cell.z + dz;
    const material = getMaterial();
    if (!isValidCell(nx, ny, nz) || world.has(nx, ny, nz)) return;
    if (!canPlaceMaterial(material, nx, ny, nz)) return;
    world.addCell(nx, ny, nz, { material });
    onChange();
    if (onPlaced) onPlaced({ x: nx, y: ny, z: nz, material });
  }

  function onContextMenu(event) {
    event.preventDefault();
    const hit = pick(event);
    if (!hit || hit.instanceId === undefined) return;
    const cell = cellAt(hit.instanceId);
    if (!cell) return;
    // Mining is checked BEFORE the getMode() gate, deliberately -- harvesting
    // an asteroid cell is allowed regardless of mode, walking included; only
    // editing a NON-asteroid cell still needs a real mode.
    if (cell.asteroidNodeId && mineRemote) {
      // Shared World: NOT optimistic here, unlike every other removal in this
      // function -- the cell only disappears once the server confirms via
      // realtime (render.js's applyRemoteDelete).
      mineRemote(cell.x, cell.y, cell.z);
      return;
    }
    if (cell.asteroidNodeId) {
      mineAsteroidCell(world, cell, getOwnerId());
    } else {
      const mode = getMode();
      // e.g. Walk mode active (falsy) -- general editing stays disabled.
      // 'bcc' -- BCC mode's own right-click removal lives in core/bcc-build.js.
      if (!mode || mode === 'bcc') return;
      world.removeCell(cell.x, cell.y, cell.z);
    }
    onChange();
    if (onRemoved) onRemoved(cell);
  }

  // Hover ghost ("intelligent ghost block", B1): translucent preview of the
  // next valid FCC position on hover; holding the button (without dragging)
  // shows a second preview one cell further out. Only meaningful in 'build' mode.
  const HOLD_MS = 220;
  const DRAG_MOVE_TOLERANCE = 6; // px, matches the touch long-press's own drift tolerance
  let pointerDownPos = null;
  let holdTimer = null;
  let holding = false;
  let dragging = false;
  let lastDragCellKey = null;

  function ghostCellsForHit(hit, showSecond) {
    if (!hit || hit.instanceId === undefined) return null;
    const cell = cellAt(hit.instanceId);
    if (!cell) return null;
    const [dx, dy, dz] = matchNeighborOffset(hit.face.normal);
    const nx = cell.x + dx;
    const ny = cell.y + dy;
    const nz = cell.z + dz;
    if (!isValidCell(nx, ny, nz)) return null;
    const first = { x: nx, y: ny, z: nz, occupied: world.has(nx, ny, nz) };
    if (!showSecond) return [first];
    const nx2 = nx + dx;
    const ny2 = ny + dy;
    const nz2 = nz + dz;
    const cells = [first];
    if (isValidCell(nx2, ny2, nz2)) {
      cells.push({ x: nx2, y: ny2, z: nz2, occupied: world.has(nx2, ny2, nz2) });
    }
    return cells;
  }

  function onPointerMove(event) {
    const mode = getMode();
    if (!mode || mode === 'plant') {
      if (onHoverEnd) onHoverEnd();
      return;
    }

    if (pointerDownPos) {
      const moved = Math.hypot(event.clientX - pointerDownPos.x, event.clientY - pointerDownPos.y);
      if (moved > DRAG_MOVE_TOLERANCE && !dragging && getDragPlacementEnabled() && mode === 'build') {
        dragging = true;
        clearTimeout(holdTimer);
        holding = false;
      }
    }

    if (dragging) {
      const hit = pick(event);
      const cells = ghostCellsForHit(hit, false);
      if (cells && !cells[0].occupied) {
        const key = `${cells[0].x},${cells[0].y},${cells[0].z}`;
        if (key !== lastDragCellKey) {
          lastDragCellKey = key;
          const material = getMaterial();
          if (canPlaceMaterial(material, cells[0].x, cells[0].y, cells[0].z)) {
            world.addCell(cells[0].x, cells[0].y, cells[0].z, { material });
            onChange();
            if (onPlaced) onPlaced(cells[0]);
          }
        }
      }
      if (onHover) onHover(cells ?? [], !!cells);
      return;
    }

    if (mode !== 'build') {
      if (onHoverEnd) onHoverEnd();
      return;
    }
    const hit = pick(event);
    const cells = ghostCellsForHit(hit, holding);
    if (cells) {
      if (onHover) onHover(cells, !cells[0].occupied);
    } else if (onHoverEnd) {
      onHoverEnd();
    }
  }

  function onPointerDown(event) {
    if (event.button !== 0) return; // left button only -- right-click is remove, handled separately
    pointerDownPos = { x: event.clientX, y: event.clientY };
    dragging = false;
    lastDragCellKey = null;
    clearTimeout(holdTimer);
    holdTimer = setTimeout(() => {
      holding = true;
      const hit = pick(event);
      const cells = ghostCellsForHit(hit, true);
      if (cells && onHover) onHover(cells, !cells[0].occupied);
    }, HOLD_MS);
  }

  function onPointerUp() {
    clearTimeout(holdTimer);
    holding = false;
    if (dragging) suppressNextClick = true;
    dragging = false;
    pointerDownPos = null;
    lastDragCellKey = null;
  }

  function onPointerLeave() {
    clearTimeout(holdTimer);
    holding = false;
    dragging = false;
    pointerDownPos = null;
    if (onHoverEnd) onHoverEnd();
  }

  // Touch support (2026-08-13): tap-to-build needed zero new code (browsers
  // already synthesize 'click' from a tap). Long-press maps to remove,
  // reusing onContextMenu via a synthetic event rather than duplicating it.
  let touchStartX = 0;
  let touchStartY = 0;
  let longPressTimer = null;
  let longPressFired = false;
  const LONG_PRESS_MS = 500;
  const LONG_PRESS_MOVE_TOLERANCE = 12; // px -- a held finger drifts a little even at rest

  function onTouchStart(event) {
    if (event.touches.length !== 1) {
      // A second finger means pinch-zoom -- leave it to OrbitControls.
      clearTimeout(longPressTimer);
      return;
    }
    const t = event.touches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
    longPressFired = false;
    clearTimeout(longPressTimer);
    longPressTimer = setTimeout(() => {
      longPressFired = true;
      onContextMenu({ preventDefault: () => {}, clientX: touchStartX, clientY: touchStartY });
    }, LONG_PRESS_MS);
  }

  function onTouchMove(event) {
    if (event.touches.length !== 1) {
      clearTimeout(longPressTimer);
      return;
    }
    const t = event.touches[0];
    const moved = Math.hypot(t.clientX - touchStartX, t.clientY - touchStartY);
    if (moved > LONG_PRESS_MOVE_TOLERANCE) clearTimeout(longPressTimer);
  }

  function onTouchEnd(event) {
    clearTimeout(longPressTimer);
    if (longPressFired) {
      // The browser would otherwise also synthesize a 'click' right after
      // this touchend, which would immediately place a new block.
      event.preventDefault();
    }
  }

  renderer.domElement.addEventListener('click', onClick);
  renderer.domElement.addEventListener('contextmenu', onContextMenu);
  renderer.domElement.addEventListener('touchstart', onTouchStart, { passive: true });
  renderer.domElement.addEventListener('touchmove', onTouchMove, { passive: true });
  renderer.domElement.addEventListener('touchend', onTouchEnd);
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointerup', onPointerUp);
  renderer.domElement.addEventListener('pointerleave', onPointerLeave);

  return function dispose() {
    renderer.domElement.removeEventListener('click', onClick);
    renderer.domElement.removeEventListener('contextmenu', onContextMenu);
    renderer.domElement.removeEventListener('touchstart', onTouchStart);
    renderer.domElement.removeEventListener('touchmove', onTouchMove);
    renderer.domElement.removeEventListener('touchend', onTouchEnd);
    renderer.domElement.removeEventListener('pointermove', onPointerMove);
    renderer.domElement.removeEventListener('pointerdown', onPointerDown);
    renderer.domElement.removeEventListener('pointerup', onPointerUp);
    renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
    clearTimeout(longPressTimer);
    clearTimeout(holdTimer);
  };
}
