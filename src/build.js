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
import { generatePlanetoid } from './planetoidgen.js';
import { mineAsteroidCell } from './asteroids.js';

// Unit-normalized neighbor directions, precomputed once. Every RD
// instance shares the same (unrotated) orientation -- see lattice.js --
// and each RD face's outward normal points exactly along its
// corresponding lattice neighbor direction (the RD is the FCC lattice's
// own Voronoi cell), so a raycast hit's flat face normal maps directly
// onto one of these 12 directions with no per-instance transform needed.
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
// canPlaceMaterial: same frost-line check build.js's build/fill modes use
// (RHOMBIVERSE_SPEC_STAR_SYSTEM.md section 3) -- cells that fail it are
// simply left at their current material (a partial recolor), same
// "skip, don't block the whole action" behavior fill mode already has.
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
  getGeneratorType,
  onCellClicked,
  // RHOMBIVERSE_SPEC_STAR_SYSTEM.md section 3's frost line: optional,
  // defaults to "always allowed" so callers that don't care about star
  // placement rules (tests, future non-star worlds) don't need to pass
  // one. render.js supplies the real check.
  canPlaceMaterial = () => true,
  // RHOMBIVERSE_SPEC_ASTEROIDS.md: optional, defaults to no real identity
  // so callers that don't care about mining (tests, non-shared play still
  // works -- mining itself doesn't require Shared World, only inventory
  // crediting does) don't need to supply one. render.js passes the
  // session's real Supabase user id when connected.
  getOwnerId = () => null,
  // RHOMBIVERSE_SPEC_TRADE_INVENTORY.md: optional, defaults to null so
  // local-only play (and tests) don't need to supply one -- when set,
  // Shared World asteroid mining routes through this instead of the
  // local mineAsteroidCell, since inventory credit there has to be
  // server-authoritative (see sync.js's mineAsteroidCellRemote).
  mineRemote = null,
  // RHOMBIVERSE_UIUX_BUILD_PLAN.md B1: "intelligent ghost block" hover
  // preview and placement/removal feedback. All optional so tests and
  // any future headless caller don't need to supply them.
  onHover = null, // (cells: [{x,y,z}], valid: boolean) -- one entry normally, two while "held"
  onHoverEnd = null,
  onPlaced = null,
  onRemoved = null,
  // Wheel's Build->Repeat leaf (see wheel.js): while true, holding the
  // left mouse button and dragging across faces places a cell under the
  // cursor on every new face entered ("walls, curves" per the plan),
  // instead of the default single click-to-place. Defaults to a no-op
  // false so every other mode/tool is completely unaffected.
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
  // post-drag synthetic 'click' (fired on mouseup against the same
  // element the drag started on) doesn't ALSO place a cell at the
  // release point on top of whatever drag-placement already did.
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
    // RHOMBIVERSE_SPEC_PENROSE_GROWTH.md: Plant mode's own click handling
    // lives entirely in render.js (a separate listener on the same
    // canvas) -- this is the one line of awareness build.js needs so its
    // own unconditional "build" fallthrough below doesn't ALSO place a
    // normal RD cell on every Plant-mode click. Not an import, not
    // growth-specific logic, just a mode-string no-op matching the same
    // shape as every other mode branch here.
    if (mode === 'plant') return;
    // B4a: Sculpt mode's own click handling lives in render.js too (the
    // Assistance Spectrum/brush/mirror logic belongs to sculpture.js, not
    // build.js) -- same no-op shape as Plant mode above.
    if (mode === 'sculpt') return;

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
      // Phase 5.8's "Report" action, minimally scoped: toggles a cell
      // between 'flagged' and 'approved' status. No separate review-
      // queue/role system exists yet (no accounts), so this doubles as
      // both the report AND the un-report/approve action rather than a
      // one-way flag with no way back -- render.js's visibility filter
      // hides 'flagged'/'removed' cells from the default view without
      // deleting them (quarantine, not delete, per the plan).
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

    // 'replace' -- RHOMBIVERSE_UIUX_BUILD_PLAN.md B1's Alter submenu
    // (Dig/Smooth/Fill/Replace). The other three all map onto an
    // existing mode; nothing in this codebase already does "swap one
    // cell's material in place," so this is genuinely new, small, and
    // deliberately mirrors recolorShell's per-cell shape (world.addCell
    // with the same data but a new material) rather than inventing a
    // different mechanic.
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
        if (!world.has(c.x, c.y, c.z) && canPlaceMaterial(material, c.x, c.y, c.z)) {
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
    if (!getMode()) return; // e.g. Walk mode active -- editing is disabled while walking
    const hit = pick(event);
    if (!hit || hit.instanceId === undefined) return;
    const cell = cellAt(hit.instanceId);
    if (!cell) return;
    // RHOMBIVERSE_SPEC_ASTEROIDS.md section 3: "extends Phase 2's
    // existing block-delete action" -- right-click already removed any
    // cell; an asteroid-tagged one now also credits inventory and
    // registers regrowth instead of just vanishing.
    if (cell.asteroidNodeId && mineRemote) {
      // RHOMBIVERSE_SPEC_TRADE_INVENTORY.md: Shared World routes through
      // the server-authoritative RPC instead of a local removeCell +
      // creditInventory -- deliberately NOT optimistic here, unlike
      // every other removal in this function. The cell only disappears
      // once the server confirms via realtime (render.js's
      // applyRemoteDelete), which also means no onChange() call here;
      // nothing has actually changed locally yet.
      mineRemote(cell.x, cell.y, cell.z);
      return;
    }
    if (cell.asteroidNodeId) {
      mineAsteroidCell(world, cell, getOwnerId());
    } else {
      world.removeCell(cell.x, cell.y, cell.z);
    }
    onChange();
    if (onRemoved) onRemoved(cell);
  }

  // Hover ghost / "intelligent ghost block" (B1): translucent preview of
  // the next valid FCC position on plain hover; holding the button down
  // (without enough movement to count as a drag) shows a SECOND preview
  // one cell further out along the same face normal, previewing a
  // two-deep placement before committing to it. Only meaningful in
  // 'build' mode -- every other mode acts on the clicked cell itself,
  // not a new neighbor, so there's nothing sensible to ghost-preview.
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

  // Touch support, 2026-08-13. Tap-to-build needed zero new code here --
  // browsers already synthesize a 'click' from a real tap (OrbitControls'
  // own one-finger-drag-orbit already relies on this NOT firing on a real
  // drag, so onClick above already does the right thing for a tap). What
  // touch has no built-in equivalent for is right-click-to-remove; the
  // industry-standard mapping (Minecraft Bedrock, and the wider
  // voxel-builder convention researched before building this) is
  // long-press. Reuses onContextMenu directly via a synthetic event
  // object rather than duplicating its logic.
  let touchStartX = 0;
  let touchStartY = 0;
  let longPressTimer = null;
  let longPressFired = false;
  const LONG_PRESS_MS = 500;
  const LONG_PRESS_MOVE_TOLERANCE = 12; // px -- a held finger drifts a little even at rest

  function onTouchStart(event) {
    if (event.touches.length !== 1) {
      // A second finger means pinch-zoom, not a build/remove gesture --
      // leave it to OrbitControls and cancel any pending long-press.
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
      // The browser would otherwise also synthesize a 'click' right
      // after this touchend -- without suppressing it, a long-press
      // remove would immediately place a new block via onClick.
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
