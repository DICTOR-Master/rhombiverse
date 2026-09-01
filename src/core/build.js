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
  pyramidPieces,
  PYRAMID_AXES,
} from './lattice.js';
import {
  applyPyramidEdit,
  resolvePyramidAxisForHit,
  resolveBootstrapPyramidAxis,
  bootstrapPyramidCell,
  addCubeToCell,
  hasCube,
  hasPyramid,
  effectivePyramids,
  nearestPyramidAxis,
  classifyExistingPyramidHit,
  flatToFlatMirror,
  pointToPointMirror,
} from './pyramid.js';
import { generatePlanetoid } from '../geometry-extensions/planetoidgen.js';
import { nearestBCCCell } from '../geometry-extensions/dual-lattice.js';
import { matchBCCNeighborOffset } from './bcc-build.js';
import {
  bootstrapDisphenoid,
  disphenoidKey,
  disphenoidNeighborAcrossFace,
  resolveFaceForHit,
  axisEdgeOfFace,
  octahedronDisphenoids,
} from '../geometry-extensions/interstitial-lattice.js';

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
  // Pyramid Sub-Cell (RHOMBIVERSE_SPEC_PYRAMID_SUBCELL.md): a partial cell
  // (one with a pyramid removed) is rendered as its own individual Mesh,
  // not an instance of the shared `mesh` -- so every whole-cell tool here
  // needs to see it too, not just Pyramid mode's own raycaster in
  // render.js. Defaults to none so every other caller of this controller
  // (unaffected by the pyramid feature) needs no change.
  extraPickTargets = [],
  cellAt,
  world,
  onChange,
  getMode,
  getShellCount,
  getMinShell,
  getMaterial,
  getGeneratorType,
  // Piece tier (RHOMBIVERSE_SPEC_PYRAMID_SUBCELL.md, direct follow-up
  // 2026-08-26): 'rd' (default) | 'cube' | 'pyramid' | 'to' -- what the
  // universal Add/Remove actions (mode 'build'/'chisel' below) operate
  // on. Everything else (Fill/Dig/Round/Replace/Generate/Report) stays
  // RD-only, scoped deliberately -- not asked for beyond Add/Remove.
  getPieceType = () => 'rd',
  // TO ("adopted family member", direct instruction 2026-08-26): the
  // truncated octahedron lives on a genuinely different lattice
  // (BCC_NEIGHBOR_OFFSETS, its own bccWorld store) -- NOT a piece of the
  // same RD decomposition RD/Cube/Pyramid are. The Piece picker including
  // it doesn't pretend otherwise; it just means Add/Remove can ALSO
  // target this other real, already-working build system, reusing its
  // own bootstrap-vs-extend logic (core/bcc-build.js) rather than
  // reimplementing it. All optional/no-op by default so every other
  // caller of this controller (BCC feature off, or a context with no BCC
  // world at all) needs no change.
  bccWorld = null,
  bccMesh = null,
  bccCellAt = () => null,
  onBCCChange = () => {},
  // Interstitial-lattice ("ioct"/"idis" piece tiers, core/interstitial-
  // build.md): same "adopted family member" reasoning as the TO params
  // above -- a genuinely different lattice (the BCC Delaunay/interstitial
  // tessellation, not the BCC Voronoi one TO comes from), own store, all
  // optional/no-op by default.
  interstitialStore = null,
  interstitialGroup = null,
  onInterstitialChange = () => {},
  onCellClicked,
  canPlaceMaterial = () => true,
  getOwnerId = () => null,
  mineRemote = null,
  mineAsteroidCell = () => {},
  onHover = null, // (cells: [{x,y,z}], valid: boolean) -- one entry normally, two while "held"
  onHoverEnd = null,
  onPlaced = null,
  onRemoved = null,
  // Direct live report, 2026-08-26 ("I select one of shapes tap screen
  // nothing happens"): the Pyramid piece tier's Add/Remove no-ops are
  // real and correct (nothing missing to add on a full block; nothing
  // there to remove on a bare spot) -- every freshly-placed block is
  // full, so this is the very first thing a player picking Pyramid tries
  // on any existing block. (action: 'add' | 'remove') => void, so the
  // caller can surface a real "nothing to do" prompt instead of silence.
  onPieceNoOp = null,
  getDragPlacementEnabled = () => false,
}) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  function pick(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    // bccMesh only enters the raycast when the Piece picker is actually
    // set to 'to' -- otherwise a BCC cell visually in front of an FCC one
    // (overlap between the two lattices is expected, see core/bcc-build.md)
    // would silently steal clicks meant for the FCC world in every OTHER
    // piece tier.
    const bccTargets = bccMesh && getPieceType() === 'to' ? [bccMesh] : [];
    // Same reasoning: interstitialGroup only enters the raycast under
    // its own piece tiers, for the same "don't steal clicks from other
    // tiers" reason as bccTargets above.
    const pieceType = getPieceType();
    const interstitialTargets = interstitialGroup && (pieceType === 'ioct' || pieceType === 'idis') ? [interstitialGroup] : [];
    const hits = raycaster.intersectObjects([mesh, ...extraPickTargets, ...bccTargets, ...interstitialTargets], true);
    return hits.length > 0 ? hits[0] : null;
  }

  // Which of the clicked cell's own 6 pyramids a hit landed on -- shared
  // by both the 'pyramid' piece-tier Add and Remove branches below. See
  // core/pyramid.md for the full derivation.
  function resolveClickedPyramidAxis(hit, cell) {
    const [wx, wy, wz] = cellToWorld(cell.x, cell.y, cell.z);
    const n = hit.face.normal;
    return resolvePyramidAxisForHit({
      localNormal: [n.x, n.y, n.z],
      localPoint: [hit.point.x - wx, hit.point.y - wy, hit.point.z - wz],
      neighborOffset: matchNeighborOffset(n),
      pieces: pyramidPieces(),
    });
  }

  // Suppressed after a drag-placement gesture so the browser's own
  // post-drag synthetic 'click' doesn't ALSO place a cell at the
  // release point.
  let suppressNextClick = false;

  // TO piece tier: reuses core/bcc-build.js's own bootstrap-vs-extend
  // logic exactly (see that file for the full explanation) rather than
  // reimplementing it -- click an existing TO to extend the BCC lattice
  // along one of its own 14 neighbor directions; click FCC/partial-cell
  // geometry instead (piece tier is 'to' but the hit landed elsewhere) to
  // seed the nearest real BCC lattice point in that face's outward
  // direction. Remove only ever acts on an actual TO -- there's nothing
  // to remove from an FCC hit under this piece tier.
  function handleToClick(hit, mode) {
    const action = mode === 'build' ? 'add' : 'remove';
    if (mode === 'build') {
      let nx, ny, nz;
      if (hit.object === bccMesh) {
        if (hit.instanceId === undefined) { if (onPieceNoOp) onPieceNoOp(action); return; }
        const bccCell = bccCellAt(hit.instanceId);
        if (!bccCell) { if (onPieceNoOp) onPieceNoOp(action); return; }
        const [dx, dy, dz] = matchBCCNeighborOffset(hit.face.normal);
        nx = bccCell.x + dx;
        ny = bccCell.y + dy;
        nz = bccCell.z + dz;
      } else {
        const fccCell = cellAt(hit);
        if (!fccCell) { if (onPieceNoOp) onPieceNoOp(action); return; }
        const n = hit.face.normal;
        [nx, ny, nz] = nearestBCCCell(fccCell.x + n.x, fccCell.y + n.y, fccCell.z + n.z);
      }
      // No-op: a TO already sits there -- reachable by tapping the same
      // spot twice, or an already-dense cluster. Same class of "silent
      // and correct, but reads as broken" bug the Pyramid tier had (see
      // that tier's own onPieceNoOp note above); TO's own live audit
      // caught it here before a report came in, not after.
      if (bccWorld.has(nx, ny, nz)) { if (onPieceNoOp) onPieceNoOp(action); return; }
      const material = getMaterial();
      bccWorld.addCell(nx, ny, nz, { material });
      onBCCChange();
      if (onPlaced) onPlaced({ x: nx, y: ny, z: nz, material });
      return;
    }
    // mode === 'chisel' (Remove). This is the single MOST likely of every
    // Pyramid/TO no-op to actually get hit: Remove+TO on any of the
    // mostly-RD world (which is most of what's actually on screen) always
    // silently did nothing before onPieceNoOp existed, since there's no
    // TO to remove from an FCC hit under this piece tier.
    if (hit.object !== bccMesh || hit.instanceId === undefined) { if (onPieceNoOp) onPieceNoOp(action); return; }
    const bccCell = bccCellAt(hit.instanceId);
    if (!bccCell) { if (onPieceNoOp) onPieceNoOp(action); return; }
    bccWorld.removeCell(bccCell.x, bccCell.y, bccCell.z);
    onBCCChange();
    if (onRemoved) onRemoved(bccCell);
  }

  // Interstitial-lattice piece tiers ('idis': one disphenoid at a time,
  // 'ioct': the 4-disphenoid octahedron bundle they combine into -- see
  // interstitial-lattice.md). Same bootstrap-vs-extend shape as
  // handleToClick above: click an existing disphenoid's face to grow via
  // the real reflection rule, or click FCC/BCC geometry instead to seed
  // the nearest real BCC lattice point nearby. Never checked against
  // FCC/BCC/each-other for overlap -- direct instruction (2026-08-28):
  // overlapping builds across all these lattices are meant to be
  // possible, same as TO already allows against FCC.
  function addDisphenoids(vertsList, material) {
    let added = 0;
    for (const verts of vertsList) {
      const key = disphenoidKey(verts);
      if (interstitialStore.has(key)) continue;
      interstitialStore.addDisphenoid(verts, { material });
      added++;
    }
    return added;
  }

  function handleInterstitialClick(hit, mode, pieceType) {
    const action = mode === 'build' ? 'add' : 'remove';
    if (mode === 'build') {
      const material = getMaterial();
      if (hit.object.parent === interstitialGroup) {
        const key = hit.object.userData.key;
        const cell = interstitialStore.get(key);
        if (!cell) { if (onPieceNoOp) onPieceNoOp(action); return; }
        const n = hit.face.normal;
        const excludeIdx = resolveFaceForHit(cell.verts, [n.x, n.y, n.z]);
        let addedCount;
        if (pieceType === 'idis') {
          const neighbor = disphenoidNeighborAcrossFace(cell.verts, excludeIdx);
          addedCount = addDisphenoids([neighbor], material);
        } else {
          const edge = axisEdgeOfFace(cell.verts, excludeIdx);
          addedCount = addDisphenoids(octahedronDisphenoids(edge.anchor, edge.axisOffset), material);
        }
        if (addedCount === 0) { if (onPieceNoOp) onPieceNoOp(action); return; }
        onInterstitialChange();
        if (onPlaced) onPlaced({ material });
        return;
      }
      // Bootstrap: seed near whichever real FCC or BCC cell was hit.
      let anchorCell, n;
      if (hit.object === bccMesh) { anchorCell = bccCellAt(hit.instanceId); n = hit.face.normal; }
      else { anchorCell = cellAt(hit); n = hit.face.normal; }
      if (!anchorCell) { if (onPieceNoOp) onPieceNoOp(action); return; }
      const [ax, ay, az] = nearestBCCCell(anchorCell.x + n.x, anchorCell.y + n.y, anchorCell.z + n.z);
      const addedCount = pieceType === 'idis'
        ? addDisphenoids([bootstrapDisphenoid([ax, ay, az])], material)
        : addDisphenoids(octahedronDisphenoids([ax, ay, az], [2, 0, 0]), material);
      if (addedCount === 0) { if (onPieceNoOp) onPieceNoOp(action); return; }
      onInterstitialChange();
      if (onPlaced) onPlaced({ x: ax, y: ay, z: az, material });
      return;
    }
    // mode === 'chisel' (Remove)
    if (hit.object.parent !== interstitialGroup || !hit.object.userData.key) { if (onPieceNoOp) onPieceNoOp(action); return; }
    const cell = interstitialStore.get(hit.object.userData.key);
    if (!cell) { if (onPieceNoOp) onPieceNoOp(action); return; }
    if (pieceType === 'idis') {
      interstitialStore.removeDisphenoid(hit.object.userData.key);
    } else {
      const n = hit.face.normal;
      const excludeIdx = resolveFaceForHit(cell.verts, [n.x, n.y, n.z]);
      const edge = axisEdgeOfFace(cell.verts, excludeIdx);
      for (const verts of octahedronDisphenoids(edge.anchor, edge.axisOffset)) {
        interstitialStore.removeDisphenoid(disphenoidKey(verts));
      }
    }
    onInterstitialChange();
    if (onRemoved) onRemoved(cell);
  }

  function onClick(event) {
    if (suppressNextClick) {
      suppressNextClick = false;
      return;
    }
    const hit = pick(event);
    if (!hit) return;

    const mode = getMode();
    if (!mode) return; // e.g. Walk mode active -- editing is disabled while walking

    // Routed BEFORE the generic cellAt() resolution below, which only
    // knows the FCC world's own cellOrder/partialCellMeshes -- a bccMesh
    // hit's instanceId indexes a completely different instance array and
    // must never be looked up there. Only reachable via the universal
    // Add/Remove modes ('build'/'chisel') and only when bccWorld/bccMesh
    // were actually supplied (both null by default, see this
    // controller's own params) -- every other caller is unaffected.
    if ((mode === 'build' || mode === 'chisel') && getPieceType() === 'to' && bccWorld && bccMesh) {
      handleToClick(hit, mode);
      return;
    }
    // Same reasoning, for the interstitial-lattice piece tiers. 'ioct'
    // (Octahedron Site) restored here 2026-08-31 -- kept on the wheel
    // building the old 4-disphenoid bundle, direct user decision, after
    // a brief detour where it was rewired to the new piece below and
    // then un-rewired.
    const pieceTypeForInterstitial = getPieceType();
    if ((mode === 'build' || mode === 'chisel') && (pieceTypeForInterstitial === 'ioct' || pieceTypeForInterstitial === 'idis') && interstitialStore && interstitialGroup) {
      handleInterstitialClick(hit, mode, pieceTypeForInterstitial);
      return;
    }
    // 'octahedron' (the NEW Cuboctahedron gap-fill piece, distinct from
    // 'ioct' above) is handled entirely by core/cubocta-gap-build.js's
    // own independent click listener on the same canvas. Explicit no-op
    // guard here, not a fallthrough -- a REAL bug, caught live
    // 2026-08-31 ("RD build is being triggered"): omitting a piece-type
    // from this dispatch entirely lets any click that controller's own
    // raycast missed (e.g. not precisely on an existing cuboctahedron)
    // fall through to the generic cellAt() RD-placement path below.
    if ((mode === 'build' || mode === 'chisel') && pieceTypeForInterstitial === 'octahedron') {
      return;
    }

    const cell = cellAt(hit);
    if (!cell) return;
    if (mode === 'plant') return; // Plant mode's click handling lives in render.js
    if (mode === 'sculpt') return; // Sculpt mode's click handling lives in render.js/sculpture.js
    if (mode === 'bcc') return; // BCC mode's click handling lives in core/bcc-build.js
    if (mode === 'cubocta') return; // Cuboctahedron Build's click handling lives in core/cubocta-build.js
    if (mode === 'dualize') return; // Dualize mode's click handling lives in render.js (reframe Stage 3)

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

    // Remove ("chisel" internally -- 'sculpt' was already taken by the
    // rich brush/mirror/symmetry panel, a genuinely different tool, see
    // render.js's dispatch). Direct follow-up 2026-08-26: a plain,
    // dedicated "click a piece, it's gone" mode, piece-tier-aware --
    // right-click (onContextMenu below) already removes a whole cell in
    // every mode, but had no discoverable left-click/button equivalent,
    // and neither right-click nor any existing mode could remove just
    // one pyramid.
    if (mode === 'chisel') {
      if (getPieceType() === 'pyramid') {
        // A click landing on an existing lone pyramid's own tagged mesh
        // (see buildPyramidOnlyMeshes in render.js) unambiguously means
        // THAT pyramid, regardless of which exact face (base or side)
        // was hit -- more reliable than resolveClickedPyramidAxis's own
        // normal-based guess, which would otherwise read a base-face hit
        // as the OPPOSITE (absent) axis and wrongly no-op.
        const axisKey = hit.object?.userData?.axisKey || resolveClickedPyramidAxis(hit, cell);
        if (!axisKey) { if (onPieceNoOp) onPieceNoOp('remove'); return; }
        const result = applyPyramidEdit(world, 'remove', cell.x, cell.y, cell.z, axisKey);
        // No-op: that pyramid's already gone. A direct live report ("I
        // select one of shapes tap screen nothing happens") turned out to
        // be exactly this -- Remove on an already-bare spot is silently
        // correct, but felt broken with zero feedback. onPieceNoOp gives
        // the player something, see render.js's own wiring.
        if (!result) { if (onPieceNoOp) onPieceNoOp('remove'); return; }
        onChange();
        if (onRemoved) onRemoved(cell);
        return;
      }
      // 'rd' and 'cube' both just mean "this whole cell" -- removal is
      // removal regardless of what was actually there.
      world.removeCell(cell.x, cell.y, cell.z);
      onChange();
      if (onRemoved) onRemoved(cell);
      return;
    }

    // mode === 'build' (default) -- the universal Add action, piece-tier
    // aware. 'pyramid' operates on the CLICKED cell itself (no new cell
    // placed); 'rd'/'cube' place a new adjacent cell, same as always,
    // just with or without pyramids: 0 explicitly set (absent means FULL
    // per core/pyramid.js).
    if (getPieceType() === 'pyramid') {
      // Direct instruction 2026-09-01 ("it just needed to be able to
      // attach flat to flat or point to point"): a click landing on an
      // EXISTING cube-less pyramid's own tagged mesh (userData.axisKey,
      // see buildPyramidOnlyMeshes in render.js) is one of 3 real,
      // distinct intents depending on exactly where -- the exposed flat
      // base (bond flat-to-flat, forming a real octahedron), near the
      // apex tip on a side face (bond point-to-point, chaining further
      // out), or near a side face's own base edge ('sibling' -- grow the
      // missing NEIGHBORING axis on this SAME cell, the pre-existing
      // 2026-08-29 behavior below, unchanged). Before this classification
      // existed, every one of these landed on 'sibling', so flat-to-flat/
      // point-to-point growth was unreachable -- confirmed via direct
      // trace against pyramidPieces()'s own geometry, not guessed.
      const hitAxisKey = hit.object?.userData?.axisKey;
      if (hitAxisKey) {
        const [hwx, hwy, hwz] = cellToWorld(cell.x, cell.y, cell.z);
        const hitLocalPoint = [hit.point.x - hwx, hit.point.y - hwy, hit.point.z - hwz];
        const hn = hit.face.normal;
        const intent = classifyExistingPyramidHit({
          axisKey: hitAxisKey,
          localNormal: [hn.x, hn.y, hn.z],
          localPoint: hitLocalPoint,
          pieces: pyramidPieces(),
        });
        if (intent === 'base' || intent === 'apex') {
          const mirror = intent === 'base'
            ? flatToFlatMirror([cell.x, cell.y, cell.z], hitAxisKey)
            : pointToPointMirror([cell.x, cell.y, cell.z], hitAxisKey);
          const [mx, my, mz] = mirror.host;
          if (!world.has(mx, my, mz)) {
            const material = getMaterial();
            if (canPlaceMaterial(material, mx, my, mz)) {
              bootstrapPyramidCell(world, mx, my, mz, mirror.axisKey, material);
              onChange();
              if (onPlaced) onPlaced({ x: mx, y: my, z: mz, material });
              return;
            }
          }
          if (onPieceNoOp) onPieceNoOp('add');
          return;
        }
        // intent === 'sibling': fall through to the existing "complete
        // this SAME cell's own remaining slots" behavior below.
      }
      // Cube-less cells (core/pyramid.js's hasCube()) have no flat
      // "missing pyramid" cube face to click the normal way -- their
      // own PRESENT pyramids are the only clickable geometry (see
      // render.js's buildPyramidOnlyMeshes for why). Real bug caught
      // live 2026-08-29 ("cant form RDs" / "have to have spaces"):
      // every click on an existing cube-less cell's own pyramid fell
      // straight through resolveClickedPyramidAxis into "already
      // present" -> bootstrap-a-new-neighbor below, since there was
      // never a genuinely missing axis's own geometry to land on
      // directly -- a cube-less cell could gain its FIRST pyramid but
      // never a second one of its own; every further click just grew a
      // separate cell elsewhere. Fixed: if the clicked cell is
      // cube-less and still has any axis missing, always complete THAT
      // SAME cell first -- whichever missing axis's apex is closest to
      // the click wins, checked across all 6 (not just the 2 sharing
      // one rhombic face, which only means something for a cube-having
      // cell's own real rhombic geometry). Falls through to the normal
      // resolution below only once the cell has nothing left to add.
      if (!hasCube(cell)) {
        const missing = PYRAMID_AXES.filter((k) => !hasPyramid(effectivePyramids(cell), k));
        if (missing.length > 0) {
          const [cwx, cwy, cwz] = cellToWorld(cell.x, cell.y, cell.z);
          const localPoint = [hit.point.x - cwx, hit.point.y - cwy, hit.point.z - cwz];
          const fillAxisKey = nearestPyramidAxis(localPoint, missing, pyramidPieces());
          const fillResult = applyPyramidEdit(world, 'add', cell.x, cell.y, cell.z, fillAxisKey);
          if (fillResult) {
            onChange();
            if (onPlaced) onPlaced(cell);
            return;
          }
        }
      }
      const axisKey = resolveClickedPyramidAxis(hit, cell);
      if (!axisKey) { if (onPieceNoOp) onPieceNoOp('add'); return; }
      const result = applyPyramidEdit(world, 'add', cell.x, cell.y, cell.z, axisKey);
      // No-op: that pyramid's already there -- true of every freshly
      // placed (full) block, so this is the very first thing a player
      // picking Pyramid tries on any existing block. See the 'chisel'
      // branch above for the live report this traces back to.
      //
      // "Pyramid without a cube" (direct instruction 2026-08-29): rather
      // than just no-op here, check whether the real FCC neighbor beyond
      // the clicked face is empty -- if so, a single cube-less pyramid
      // can grow there instead, reaching back toward the cell you
      // clicked. This is the ONLY place that check runs (not a separate
      // mode/piece tier): it only ever fires on the exact click that
      // would otherwise be a pure no-op, so it never changes what
      // happens when there genuinely IS a pyramid still to add.
      if (!result) {
        const neighborOffset = matchNeighborOffset(hit.face.normal);
        const bnx = cell.x + neighborOffset[0];
        const bny = cell.y + neighborOffset[1];
        const bnz = cell.z + neighborOffset[2];
        if (isValidCell(bnx, bny, bnz) && !world.has(bnx, bny, bnz)) {
          const [nwx, nwy, nwz] = cellToWorld(bnx, bny, bnz);
          const newAxisKey = resolveBootstrapPyramidAxis({
            localPointFromNewCell: [hit.point.x - nwx, hit.point.y - nwy, hit.point.z - nwz],
            neighborOffsetFromClickedToNew: neighborOffset,
            pieces: pyramidPieces(),
          });
          if (newAxisKey) {
            const material = getMaterial();
            if (canPlaceMaterial(material, bnx, bny, bnz)) {
              bootstrapPyramidCell(world, bnx, bny, bnz, newAxisKey, material);
              onChange();
              if (onPlaced) onPlaced({ x: bnx, y: bny, z: bnz, material });
              return;
            }
          }
        }
        if (onPieceNoOp) onPieceNoOp('add');
        return;
      }
      onChange();
      if (onPlaced) onPlaced(cell);
      return;
    }
    // Piece=Cube directly on an existing cube-less cell (see core/
    // pyramid.js's hasCube()): add the cube to THAT SAME cell in place,
    // keeping whatever pyramids are already there untouched, rather than
    // the default "always bootstrap a new adjacent cell" behavior below
    // -- direct instruction 2026-08-29 ("but can be added is important").
    if (getPieceType() === 'cube' && !hasCube(cell)) {
      addCubeToCell(world, cell.x, cell.y, cell.z);
      onChange();
      if (onPlaced) onPlaced(cell);
      return;
    }
    const [dx, dy, dz] = matchNeighborOffset(hit.face.normal);
    const nx = cell.x + dx;
    const ny = cell.y + dy;
    const nz = cell.z + dz;
    const material = getMaterial();
    if (!isValidCell(nx, ny, nz) || world.has(nx, ny, nz)) return;
    if (!canPlaceMaterial(material, nx, ny, nz)) return;
    const data = getPieceType() === 'cube' ? { material, pyramids: 0 } : { material };
    world.addCell(nx, ny, nz, data);
    onChange();
    if (onPlaced) onPlaced({ x: nx, y: ny, z: nz, material });
  }

  function onContextMenu(event) {
    event.preventDefault();
    const hit = pick(event);
    if (!hit) return;
    const mode = getMode();

    // TO piece tier: same reasoning as onClick's own handleToClick gate
    // above -- routed BEFORE the generic cellAt() resolution, which
    // doesn't know bccMesh's own instance-id space, and before the
    // mining check below (a TO is never an asteroid node).
    if (mode === 'build' && getPieceType() === 'to' && bccWorld && bccMesh) {
      if (hit.object !== bccMesh || hit.instanceId === undefined) return;
      const bccCell = bccCellAt(hit.instanceId);
      if (!bccCell) return;
      bccWorld.removeCell(bccCell.x, bccCell.y, bccCell.z);
      onBCCChange();
      if (onRemoved) onRemoved(bccCell);
      return;
    }
    // Same reasoning, for the interstitial-lattice piece tiers -- 'ioct'
    // restored here 2026-08-31, same as its onClick counterpart above.
    const pieceTypeForInterstitialRemove = getPieceType();
    if (mode === 'build' && (pieceTypeForInterstitialRemove === 'ioct' || pieceTypeForInterstitialRemove === 'idis') && interstitialStore && interstitialGroup) {
      handleInterstitialClick(hit, 'chisel', pieceTypeForInterstitialRemove);
      return;
    }
    // Explicit no-op guard for 'octahedron', same reasoning/bug as
    // onClick's own -- a right-click that misses an actual octahedron
    // instance must not fall through to removing whatever real cell was
    // actually hit.
    if (mode === 'build' && pieceTypeForInterstitialRemove === 'octahedron') {
      return;
    }

    const cell = cellAt(hit);
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
      // e.g. Walk mode active (falsy) -- general editing stays disabled.
      // 'bcc' -- BCC mode's own right-click removal lives in core/bcc-build.js.
      // 'cubocta' -- same, lives in core/cubocta-build.js.
      // 'dualize' -- view-only (reframe Stage 3): right-click must not
      // delete the clicked cell, same reasoning as every other read-only mode.
      if (!mode || mode === 'bcc' || mode === 'cubocta' || mode === 'dualize') return;
      // Add's own quick Remove gesture (direct instruction 2026-08-26,
      // for touch: tap to Add, long-press to Remove -- long-press is
      // already wired to synthesize this exact event, see onTouchStart
      // below): while actively in Add mode with the Pyramid piece tier
      // selected, right-click/long-press removes just that one pyramid,
      // matching what the dedicated Remove button would do for the same
      // piece tier, instead of always deleting the whole cell. Every
      // other mode/piece-tier combination keeps this function's own
      // long-standing universal contract unchanged -- "always removes
      // the clicked cell, in every mode" (this file's own header) --
      // deliberately not generalized further than the Add/Remove pair
      // itself, so e.g. long-pressing in Fill mode still behaves exactly
      // as it always has regardless of whatever piece tier is selected.
      if (mode === 'build' && getPieceType() === 'pyramid') {
        const axisKey = resolveClickedPyramidAxis(hit, cell);
        if (!axisKey) { if (onPieceNoOp) onPieceNoOp('remove'); return; }
        const result = applyPyramidEdit(world, 'remove', cell.x, cell.y, cell.z, axisKey);
        if (!result) { if (onPieceNoOp) onPieceNoOp('remove'); return; } // no-op: that pyramid's already gone
      } else {
        world.removeCell(cell.x, cell.y, cell.z);
      }
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
    if (!hit) return null;
    const cell = cellAt(hit);
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
      // Drag-placement (Repeat) doesn't apply to the 'pyramid' or 'to'
      // piece tiers -- same reason as the ghost preview below, neither is
      // simple neighbor placement. 'rd'/'cube' both still drag normally.
      if (moved > DRAG_MOVE_TOLERANCE && !dragging && getDragPlacementEnabled() && mode === 'build' && !['pyramid', 'to', 'ioct', 'idis'].includes(getPieceType())) {
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
            const data = getPieceType() === 'cube' ? { material, pyramids: 0 } : { material };
            world.addCell(cells[0].x, cells[0].y, cells[0].z, data);
            onChange();
            if (onPlaced) onPlaced(cells[0]);
          }
        }
      }
      if (onHover) onHover(cells ?? [], !!cells);
      return;
    }

    // 'pyramid' piece-tier Add doesn't place a new adjacent cell (it
    // edits the clicked cell's own pyramids); 'to' places into a
    // genuinely different world/lattice (bccWorld) via its own bootstrap-
    // vs-extend logic -- neither fits the "next valid FCC position" ghost
    // preview below, which assumes plain FCC neighbor placement. 'rd'/
    // 'cube' both still use it identically.
    if (mode !== 'build' || ['pyramid', 'to', 'ioct', 'idis'].includes(getPieceType())) {
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
