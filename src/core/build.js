// Raycasts to find which of the 12 faces of a clicked RD was hit, then
// acts according to the currently selected build MODE (an explicit
// #mode-* button in index.html, read via getMode() -- see render.js).
// RHOMBIVERSE_PLAN.md section 4. Right-click always removes the clicked
// cell, in every mode. Full design rationale/history for every export
// below: docs/code-notes/core/build.md
import * as THREE from 'three';
import {
  NEIGHBOR_OFFSETS,
  cellsInShells,
  cellKey,
  parseCellKey,
  cellToWorld,
  pyramidPieces,
  PYRAMID_AXES,
  oppositeNeighborIndex,
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
  resolvePyramidClickOnExisting,
  pyramidAxisForNormal,
  axisKeyToOffset,
  nearestPyramidAxis,
} from './pyramid.js';
import { generatePlanetoid } from '../geometry-extensions/planetoidgen.js';
import { nearestBCCCell, matchBCCNeighborOffset } from '../geometry-extensions/dual-lattice.js';
import {
  bootstrapDisphenoid,
  disphenoidKey,
  disphenoidNeighborAcrossFace,
  resolveFaceForHit,
  axisEdgeOfFace,
  octahedronDisphenoids,
} from '../geometry-extensions/interstitial-lattice.js';
import {
  halfRdKey,
  hourglassKey,
  hourglassOffsetIndex,
  canonicalHourglassCells,
  nearestCornerGroup,
  bandGroupForOffsetIndex,
  resolveTriangleGroup,
  wedge2Key,
  triangleRingCells,
} from './hemisphere-build.js';

// Every piece type routed through handleHemisphereClick/hemisphereStore --
// 'halfrd'/'hourglass' (single pieces) plus 'hemi3'/'hemi4' (bulk-add
// cluster stamps of the same underlying halfrd entries, core/hemisphere-
// build.js). One shared list so the several gates below (raycast targets,
// onClick/onContextMenu dispatch) can't drift out of sync with each other.
const HEMISPHERE_PIECE_TYPES = ['halfrd', 'hourglass', 'hemi3', 'hemi4', 'hemiTri', 'hemiRing'];

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

// Real regression, direct report 2026-09-01 ("cubes have narrow
// opportunities"/"pyramids form both cubes and RDs and any position is
// potentially either anyway"): matchNeighborOffset only ever makes exact
// sense for a DIAGONAL rhombic-face normal -- RD's own 12 real faces
// line up exactly with the 12 NEIGHBOR_OFFSETS directions, so every RD
// face resolves unambiguously. A Cube's 6 flat faces are a genuinely
// different case: each one sits EXACTLY 45 degrees from 4 different
// NEIGHBOR_OFFSETS directions at once (a real tie, confirmed
// numerically), and the tie-break always favors the same lowest-index
// candidate regardless of where on the face you click -- only 5 of the
// 12 real directions are ever reachable from a cube's faces at all, and
// 2 different faces (+x and +y) collapse onto the identical target
// cell. That's what "narrow opportunities" was actually describing.
//
// Real fix, verified safe by construction: when the clicked face is
// genuinely flat/axis-aligned (pyramidAxisForNormal returns non-null --
// this ONLY ever happens on an exposed cube face with no pyramid on
// that axis, since a present pyramid replaces the flat face with its
// own slanted triangular sides), grow straight out along that PURE
// axis instead of snapping to a diagonal. Two cubes placed pure-axis-
// adjacent (SCALE apart) sit exactly tangent -- half-width 0.5 + 0.5 =
// 1.0 = SCALE, zero overlap, by construction, not assumed. This can
// never fire for a real RD face (RD never exposes a flat, axis-aligned
// face at all -- pyramidAxisForNormal always returns null for one),
// so RD's own real growth/placement is completely untouched by this;
// it only ever activates for a Cube/partial-pyramid-cell's own
// genuinely exposed flat face.
//
// This is also the real mechanism behind "any position is potentially
// either [cube or RD] anyway": a cell reached via a pure-axis offset is
// stored exactly like any other cell (no separate schema/store), so it
// can grow its own further pyramids/cube exactly the same way -- the
// lattice isn't literally "doubled" as a new parity rule, it's that
// pure-axis growth from an exposed flat face was always geometrically
// safe and simply wasn't being offered.
export function resolveGrowthOffset(faceNormal) {
  const axisKey = pyramidAxisForNormal([faceNormal.x, faceNormal.y, faceNormal.z]);
  if (axisKey) return axisKeyToOffset(axisKey);
  return matchNeighborOffset(faceNormal);
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
  // Hemisphere pieces ('halfrd'/'hourglass', core/hemisphere-build.md):
  // same "adopted family member" reasoning as the TO/interstitial params
  // above -- a genuinely different frame (NEIGHBOR_OFFSETS' 12-direction
  // flat-plane split, not a bitmask or a separate BCC lattice), own
  // store, all optional/no-op by default.
  hemisphereStore = null,
  hemisphereGroup = null,
  onHemisphereChange = () => {},
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
    // Same reasoning again: hemisphereGroup only enters the raycast under
    // its own piece tiers -- needed so Remove can hit an already-placed
    // Half RD/Hourglass mesh; harmless for Add (handleHemisphereClick's
    // own bootstrap-only Add path explicitly no-ops if it lands there).
    const hemisphereTargets = hemisphereGroup && HEMISPHERE_PIECE_TYPES.includes(pieceType) ? [hemisphereGroup] : [];
    const hits = raycaster.intersectObjects([mesh, ...extraPickTargets, ...bccTargets, ...interstitialTargets, ...hemisphereTargets], true);
    return hits.length > 0 ? hits[0] : null;
  }

  // Which of the clicked cell's own 6 pyramids a hit landed on -- shared
  // by both the 'pyramid' piece-tier Add and Remove branches below. See
  // core/pyramid.md for the full derivation.
  // preferMissing: ONLY for Add -- Remove (both call sites below) must
  // never prefer a missing axis, since that would try to remove a
  // pyramid that isn't there and silently no-op instead of removing the
  // one actually clicked. See resolvePyramidAxisForHit's own header for
  // why this distinction exists at all.
  function resolveClickedPyramidAxis(hit, cell, { preferMissing = false } = {}) {
    const [wx, wy, wz] = cellToWorld(cell.x, cell.y, cell.z);
    const n = hit.face.normal;
    return resolvePyramidAxisForHit({
      localNormal: [n.x, n.y, n.z],
      localPoint: [hit.point.x - wx, hit.point.y - wy, hit.point.z - wz],
      neighborOffset: matchNeighborOffset(n),
      missingAxisKeys: preferMissing ? PYRAMID_AXES.filter((k) => !hasPyramid(effectivePyramids(cell), k)) : undefined,
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

  // Hemisphere pieces ('halfrd'/'hourglass', core/hemisphere-build.js):
  // Add always bootstraps off an existing FCC/BCC face -- click one, and
  // matchNeighborOffset (already proven for the main FCC Build mode)
  // resolves the real NEIGHBOR_OFFSETS direction the click points along,
  // same as the generic whole-cell Add path just above. Genuinely simpler
  // than handleToClick/handleInterstitialClick's own bootstrap-vs-extend
  // split: neither piece can be grown FROM an existing hemisphere piece's
  // own face yet (there's no reflection/adjacency rule for that here the
  // way disphenoids have) -- every placement starts fresh off the solid
  // world, which is already a complete, useful mechanic on its own.
  // Cluster bundles ('hemi3'/'hemi4', core/hemisphere-build.js): a single
  // click bulk-adds several plain 'halfrd' entries at once into the SAME
  // hemisphereStore -- same "identical pieces are interchangeable" rule
  // this project holds everywhere else (feedback_identical_pieces_
  // interchangeable): a halfrd placed via a cluster stamp is NOT a
  // separate locked-together object, it's the exact same store entry a
  // lone 'halfrd' click would make. That's also why Remove for these two
  // piece types is deliberately NOT handled specially below -- it falls
  // through to the exact same single-piece removal 'halfrd' itself uses,
  // since there is no real "undo the whole bundle" data to recover
  // (two overlapping bundles can share a piece; which one "owns" it for
  // removal purposes is genuinely undefined, not just unbuilt).
  //
  // `anchorCell` is pre-resolved by the caller via resolveClusterAnchorCell
  // below (a solid FCC cell OR an existing hemisphere piece's own owning
  // cell -- direct report 2026-09-06, "the cluster wont accept hourglass
  // either"/"the clusters should be able to attach to each other"). No
  // bccMesh support yet -- 'hemi3'/'hemiTri' specifically need the real
  // click point (not just the face normal) to disambiguate which of
  // several candidate corners/triangles was meant.
  // Always returns { anchorCell, added, label } (anchorCell is already
  // known-good by the time this is called) -- `label` names which of the
  // 8 real corners ('hemi3') or 3 real axes
  // ('hemi4') was actually resolved, direct instruction 2026-09-06 ("just
  // 8 instead"/"8 corner clusters... not a new geometry, just naming/
  // exposing what the corner math already gives"): render.js's own
  // onPlaced surfaces this as a real HUD toast so the choice is legible
  // to the player, not just an invisible internal disambiguation detail.
  // Real bug found live (2026-09-10, "still propagating" after the
  // world.has() fix above, "as they are stacked the empty piece fills
  // in lower down stack"): hemisphereStore's own key scheme
  // (halfRdKey includes offsetIndex) lets a cell hold MULTIPLE
  // independent 'halfrd' entries at once, one per direction -- nothing
  // ever stopped two DIFFERENT chained clusters (or a cluster and a
  // single-piece tool) from each adding their own 'negative' half at
  // the SAME cell via two DIFFERENT offsetIndex values. Two arbitrary
  // half-space cuts don't union into anything coherent (only a SAME-
  // axis pair, positive+negative of one offsetIndex, does -- exactly
  // growFromHemispherePiece's own "complete this piece's missing other
  // half" mechanic) -- verified directly by constructing this exact
  // state and rendering it: two overlapping lumps with a visible
  // uncovered notch between them, not a clean partial or whole shape.
  // Confirms "fills in lower down the stack": more independently-
  // reached directions accumulate more overlapping wedges, so the
  // uncovered notch visually shrinks as a chain grows, without the
  // underlying data ever becoming a real, correct piece.
  //
  // This is a real gap distinct from the world.has() fix just above --
  // that one catches "a full SOLID RD already owns this cell" (a
  // different store entirely); this one catches "hemisphereStore
  // itself already owns this cell along an INCOMPATIBLE axis."
  // Same-offsetIndex entries (the legitimate same-axis completion) are
  // deliberately let through -- checked by offsetIndex identity, not
  // object identity or side, so growFromHemispherePiece's own "other
  // side, same axis" call sites keep working exactly as before. A
  // 'wedge2' at the cell always conflicts (it's already a 2-axis cut of
  // that whole cell, never compatible with anything else being added
  // there).
  // Real bug, three rounds of live reports (2026-09-10/11): "empty space
  // in the middle" -> "still propagating"/"fills in lower down stack"
  // (a per-site pre-check for the world.has() case, then a second
  // per-site pre-check adding classification/promotion) -> "reverted to
  // the moving space" -- each pre-check fix covered the exact site it
  // was written against but missed others, or missed ordering/edge
  // cases within them, because it tried to PREDICT a conflict at the
  // moment of placement, spread across 7 different call sites. Replaced
  // entirely with a single POST-HOC reconciliation pass instead: after
  // ANY hemisphere action (single piece, growth, or cluster stamp),
  // scan the whole store for cells that ended up with incompatible
  // content and fix them, regardless of which code path produced them.
  // This can't miss a site the way the per-site checks could -- there's
  // only one place left for this logic to live.
  //
  // "Incompatible" here means: a cell owned by two 'halfrd'/'hourglass'
  // entries with DIFFERENT offsetIndex values (two arbitrary half-space
  // cuts don't union into anything coherent -- only a same-axis
  // positive+negative pair does, growFromHemispherePiece's own "complete
  // this piece's missing other half" mechanic, deliberately left alone
  // here), or a cell touched by a 'wedge2' alongside anything else (a
  // wedge2 is already a 2-axis cut of the whole cell, never compatible
  // with more content there). Direct user request: resolve by promoting
  // the cell to a real, whole solid RD -- same spirit as the same-axis
  // completion, generalized to a different axis pair meeting there.
  //
  // An 'hourglass' spans TWO cells under one stored entry; if either of
  // its cells needs promoting, BOTH do (removing the entry to resolve a
  // conflict at one end would otherwise silently strip the other end's
  // own real coverage) -- resolved by growing the promotion set to a
  // fixed point before touching the store at all.
  function reconcileHemisphereStore() {
    const cellId = (c) => `${c[0]},${c[1]},${c[2]}`;
    const owners = new Map(); // cellId -> [{ offsetIndex: number|null }]
    const addOwner = (cell, offsetIndex) => {
      const id = cellId(cell);
      if (!owners.has(id)) owners.set(id, []);
      owners.get(id).push(offsetIndex);
    };
    for (const piece of hemisphereStore.entries()) {
      if (piece.type === 'halfrd') addOwner(piece.cell, piece.offsetIndex);
      else if (piece.type === 'hourglass') { addOwner(piece.cellA, piece.offsetIndex); addOwner(piece.cellB, piece.offsetIndex); }
      else if (piece.type === 'wedge2') addOwner(piece.cell, null); // null never equals a real offsetIndex -- always conflicts
    }

    const toPromote = new Set();
    for (const [id, offsetIndexes] of owners) {
      if (new Set(offsetIndexes).size > 1) toPromote.add(id);
    }
    if (toPromote.size === 0) return;

    // Grow the set to a fixed point so no hourglass is ever left with
    // only one of its two cells promoted.
    let grew = true;
    while (grew) {
      grew = false;
      for (const piece of hemisphereStore.entries()) {
        if (piece.type !== 'hourglass') continue;
        const idA = cellId(piece.cellA);
        const idB = cellId(piece.cellB);
        if (toPromote.has(idA) !== toPromote.has(idB)) {
          toPromote.add(idA);
          toPromote.add(idB);
          grew = true;
        }
      }
    }

    const material = getMaterial();
    for (const piece of hemisphereStore.entries()) {
      const cellsOwned = piece.type === 'hourglass' ? [piece.cellA, piece.cellB] : [piece.cell];
      if (cellsOwned.some((c) => toPromote.has(cellId(c)))) hemisphereStore.remove(piece.key);
    }
    for (const id of toPromote) {
      const [x, y, z] = id.split(',').map(Number);
      if (!world.has(x, y, z)) world.addCell(x, y, z, { material });
    }
    onChange();
  }

  function addHemisphereCluster(anchorCell, hit, pieceType) {
    if (pieceType === 'hemiRing') {
      // Triangle Ring: reuses hemi3's OWN corner-group resolution (the
      // exact same 8 real direction-triples -- see core/hemisphere-
      // build.js's own wedge2Key header for why these specific 8 are
      // also the only mutually-adjacent triples in this lattice, a real
      // fact verified before this was built, not assumed from Corner
      // Cluster's own use of them), but places 3 real 'wedge2' pieces
      // (each cell's own 2-axis intersection facing its 2 ring-mates)
      // instead of 3 plain halfrd halves facing back at a shared anchor.
      const [awx, awy, awz] = cellToWorld(anchorCell.x, anchorCell.y, anchorCell.z);
      const group = nearestCornerGroup([hit.point.x - awx, hit.point.y - awy, hit.point.z - awz]);
      const label = `Triangle ring (${group.sign.map((s) => (s > 0 ? '+' : '-')).join(',')})`;
      const material = getMaterial();
      const wedges = triangleRingCells([anchorCell.x, anchorCell.y, anchorCell.z], group.indices);
      let added = 0;
      for (const { cell, axisA, axisB } of wedges) {
        // Real bug found live (2026-09-10, "empty space appearing in
        // the middle" when chaining two clusters, "rd pieces are not
        // being recognised"): this loop only ever checked
        // hemisphereStore, never the main solid world -- a cluster
        // stamp anchored on an existing hemisphere piece (per
        // resolveClusterAnchorCell's own "clusters chaining onto
        // clusters" support) can compute a target that lands back on
        // an already-solid RD cell, which this then silently overlapped
        // with a coincident half-piece instead of recognizing it as
        // occupied. Same fix as the halfrd cluster loop just below.
        // Any DIFFERENT-axis conflict this creates elsewhere is caught
        // and resolved afterward by reconcileHemisphereStore(), not
        // predicted here.
        const key = wedge2Key(cell[0], cell[1], cell[2], axisA, axisB);
        if (hemisphereStore.has(key) || world.has(cell[0], cell[1], cell[2])) continue;
        hemisphereStore.set(key, { type: 'wedge2', cell, axisA, axisB, material });
        added++;
      }
      return { anchorCell, added, label };
    }
    let indices, label;
    if (pieceType === 'hemi3') {
      const [awx, awy, awz] = cellToWorld(anchorCell.x, anchorCell.y, anchorCell.z);
      const group = nearestCornerGroup([hit.point.x - awx, hit.point.y - awy, hit.point.z - awz]);
      indices = group.indices;
      label = `Corner cluster (${group.sign.map((s) => (s > 0 ? '+' : '-')).join(',')})`;
    } else if (pieceType === 'hemiTri') {
      // Triangle Cluster: a clicked direction sits in 2 of the 4 real
      // hexagonal planes, same "needs the real click point" reasoning as
      // hemi3's corners above -- see resolveTriangleGroup's own header.
      const [awx, awy, awz] = cellToWorld(anchorCell.x, anchorCell.y, anchorCell.z);
      const localPoint = [hit.point.x - awx, hit.point.y - awy, hit.point.z - awz];
      const [dx, dy, dz] = matchNeighborOffset(hit.face.normal);
      const clickedIndex = NEIGHBOR_OFFSETS.findIndex(([x, y, z]) => x === dx && y === dy && z === dz);
      const group = resolveTriangleGroup(clickedIndex, localPoint);
      indices = group.indices;
      label = `Triangle cluster (axis ${group.axis.map((s) => (s > 0 ? '+' : '-')).join(',')})`;
    } else {
      const [dx, dy, dz] = matchNeighborOffset(hit.face.normal);
      const clickedIndex = NEIGHBOR_OFFSETS.findIndex(([x, y, z]) => x === dx && y === dy && z === dz);
      const group = bandGroupForOffsetIndex(clickedIndex);
      indices = group.indices;
      label = `Band cluster (${['X', 'Y', 'Z'][group.axis]} axis)`;
    }
    const material = getMaterial();
    let added = 0;
    for (const offsetIndex of indices) {
      const [dx, dy, dz] = NEIGHBOR_OFFSETS[offsetIndex];
      const nx = anchorCell.x + dx;
      const ny = anchorCell.y + dy;
      const nz = anchorCell.z + dz;
      const key = halfRdKey(nx, ny, nz, offsetIndex, 'negative');
      // Real bug found live (2026-09-10): a cluster stamp anchored on
      // an existing hemisphere piece (resolveClusterAnchorCell's own
      // "clusters chaining onto clusters" support) can compute a target
      // that lands back on the ORIGINAL anchor or another already-solid
      // RD cell -- e.g. two chained X-axis Band Clusters share exactly
      // one target this way (each cell's own X-axis band includes the
      // direction back toward wherever it was reached from). Checking
      // only hemisphereStore missed this entirely (a solid RD cell was
      // never "recognised" as occupied by this loop at all), silently
      // overlapping a coincident half-piece onto real solid geometry --
      // read live as "empty space in the middle" (the mismatched
      // triangulation at that shared boundary reads as a gap/seam, not
      // an obvious duplicate).
      if (hemisphereStore.has(key) || world.has(nx, ny, nz)) continue;
      // A target can still already hold a DIFFERENT axis's own
      // halfrd/wedge2 -- reconcileHemisphereStore() (called once at the
      // end of handleHemisphereClick below) catches and resolves that
      // afterward, not predicted here.
      hemisphereStore.set(key, { type: 'halfrd', cell: [nx, ny, nz], offsetIndex, side: 'negative', material });
      added++;
    }
    return { anchorCell, added, label };
  }

  // Which real cell(s) a stored hemisphere piece's own geometry is built
  // from, each tagged with the offsetIndex/side that placed it -- 1 for a
  // lone 'halfrd', 2 for an 'hourglass' (cellA's own 'positive' half,
  // cellB's own 'negative' half; see hemisphere-build.js's own hourglass
  // header and buildHemisphereGeometry in render.js for why those two
  // sides specifically).
  function hemispherePieceCandidates(piece) {
    if (piece.type === 'halfrd') return [{ cell: piece.cell, offsetIndex: piece.offsetIndex, side: piece.side }];
    // 'wedge2' (Triangle Ring): only its own CELL is meaningful here --
    // resolveClusterAnchorCell (a cluster attaching onto an existing
    // wedge2 piece) only ever needs the cell, never offsetIndex/side.
    // growFromHemispherePiece explicitly bails out on this type instead
    // of reading these null fields -- a 2-axis wedge has no single
    // "missing direction" the way a plain halfrd/hourglass half does.
    if (piece.type === 'wedge2') return [{ cell: piece.cell, offsetIndex: null, side: null }];
    return [
      { cell: piece.cellA, offsetIndex: piece.offsetIndex, side: 'positive' },
      { cell: piece.cellB, offsetIndex: piece.offsetIndex, side: 'negative' },
    ];
  }

  // Which real cell a cluster stamp ('hemi3'/'hemi4'/'hemiTri') should
  // anchor on for a given hit -- a solid FCC cell (cellAt), or, direct
  // report 2026-09-06 ("the clusters should be able to attach to each
  // other"), the real OWNING cell of an already-placed hemisphere piece
  // (nearest of its own candidate cells to the actual click point, same
  // resolution growFromHemispherePiece uses below) when the click landed
  // on one instead. This is what lets a cluster stamp anchor on a cell
  // that only has another hemisphere piece touching it, not a full solid
  // RD -- clusters chaining onto clusters, or onto a lone Hemi RD/Hourglass.
  function resolveClusterAnchorCell(hit) {
    if (hit.object.parent !== hemisphereGroup) return cellAt(hit);
    const piece = hemisphereStore.get(hit.object.userData.key);
    if (!piece) return null;
    const candidates = hemispherePieceCandidates(piece);
    let bestCell = candidates[0].cell;
    let bestDist = Infinity;
    for (const c of candidates) {
      const [wx, wy, wz] = cellToWorld(c.cell[0], c.cell[1], c.cell[2]);
      const d = Math.hypot(hit.point.x - wx, hit.point.y - wy, hit.point.z - wz);
      if (d < bestDist) { bestDist = d; bestCell = c.cell; }
    }
    return { x: bestCell[0], y: bestCell[1], z: bestCell[2] };
  }

  // Direct report 2026-09-06 ("pieces wont connect to each other...
  // pieces must connect on all surfaces"): every hemisphere piece's own
  // OUTER faces (everything but its flat cut face) are geometrically
  // IDENTICAL to a whole solid RD's own faces at that same cell -- the
  // split only ever removes/keeps whole faces, never reshapes a kept one
  // -- so clicking one should bootstrap outward exactly like clicking a
  // solid cell's face does. Clicking the flat cut face itself is the one
  // genuinely different case: there's no "next cell over" there (it sits
  // at the OWNING cell's own center, not a shared boundary -- see this
  // file's own git history/commit message for the real geometry this was
  // worked out from), so that face completes the SAME cell's missing
  // other half instead.
  //
  // For an 'hourglass' (two candidate cells), which cell "owns" the hit
  // face is resolved by nearest real cell center to the actual click
  // point -- trivial (one candidate) for a lone 'halfrd'.
  function growFromHemispherePiece(hit, pieceType) {
    const piece = hemisphereStore.get(hit.object.userData.key);
    if (!piece) return null;
    // 'wedge2' (Triangle Ring) has no single "missing direction" the way
    // a plain halfrd/hourglass half does (it's already bounded by 2 real
    // cuts) -- single-piece growth off one isn't supported yet, same
    // bootstrap-only scoping the cluster stamps themselves still have.
    if (piece.type === 'wedge2') return null;
    const candidates = hemispherePieceCandidates(piece);
    let owner = candidates[0];
    let bestDist = Infinity;
    for (const c of candidates) {
      const [wx, wy, wz] = cellToWorld(c.cell[0], c.cell[1], c.cell[2]);
      const d = Math.hypot(hit.point.x - wx, hit.point.y - wy, hit.point.z - wz);
      if (d < bestDist) { bestDist = d; owner = c; }
    }
    const [ax, ay, az] = owner.cell;
    const [dx, dy, dz] = matchNeighborOffset(hit.face.normal);
    const j = NEIGHBOR_OFFSETS.findIndex(([x, y, z]) => x === dx && y === dy && z === dz);
    // The missing side's own real direction: for a 'negative'-side half,
    // the excluded material is toward +offsetIndex (same index); for a
    // 'positive'-side half, it's toward the opposite real direction.
    const missingIndex = owner.side === 'negative' ? owner.offsetIndex : oppositeNeighborIndex(owner.offsetIndex);
    const material = getMaterial();
    if (j === missingIndex) {
      // Direct report 2026-09-06 ("it attaches just a hemi instead"): the
      // gap this face bounds is entirely within the OWNING cell's own
      // territory (see this function's own header), so filling it always
      // touches that same cell -- but WHICH real piece type fills it must
      // still respect the tool actually selected, not silently ignore it.
      // 'hourglass' bridges the owning cell onward into a genuinely NEW
      // neighbor cell (same canonicalHourglassCells/hourglassOffsetIndex
      // machinery the normal bootstrap path uses, safe regardless of
      // which cell ends up lo/hi -- 'positive'/'negative' are defined by
      // the real lo->hi direction, not by click order) -- this also
      // completes the owning cell's own missing half for free, as a side
      // effect of cellA's own 'positive' contribution, not a separate step.
      if (pieceType === 'hourglass') {
        const nx2 = ax + dx;
        const ny2 = ay + dy;
        const nz2 = az + dz;
        const [loCell, hiCell] = canonicalHourglassCells(ax, ay, az, nx2, ny2, nz2);
        const key2 = hourglassKey(...loCell, ...hiCell);
        const offsetIndex2 = hourglassOffsetIndex(loCell, hiCell);
        // Same real bug as addHemisphereCluster's loops above -- a real
        // click can legitimately hit a hemisphere piece's own OUTER face
        // (unlike a solid cell's face, nothing culls it just because the
        // neighbor beyond it happens to already be solid), so this genuinely
        // needs its own world.has() check, not just hemisphereStore's.
        if (hemisphereStore.has(key2) || world.has(nx2, ny2, nz2)) return { added: 0 };
        hemisphereStore.set(key2, { type: 'hourglass', cellA: loCell, cellB: hiCell, offsetIndex: offsetIndex2, material });
        return { added: 1, anchor: { x: ax, y: ay, z: az } };
      }
      const otherSide = owner.side === 'negative' ? 'positive' : 'negative';
      const key2 = halfRdKey(ax, ay, az, owner.offsetIndex, otherSide);
      if (hemisphereStore.has(key2)) return { added: 0 };
      hemisphereStore.set(key2, { type: 'halfrd', cell: [ax, ay, az], offsetIndex: owner.offsetIndex, side: otherSide, material });
      return { added: 1, anchor: { x: ax, y: ay, z: az } };
    }
    const nx = ax + dx;
    const ny = ay + dy;
    const nz = az + dz;
    // Same real bug as above -- a hemisphere piece's own outer face is
    // always clickable regardless of what's beyond it, so this needs its
    // own world.has() check too, not just hemisphereStore's. Any
    // different-axis conflict this creates is caught and resolved
    // afterward by reconcileHemisphereStore(), not predicted here.
    if (pieceType === 'halfrd') {
      const key2 = halfRdKey(nx, ny, nz, j, 'negative');
      if (hemisphereStore.has(key2) || world.has(nx, ny, nz)) return { added: 0 };
      hemisphereStore.set(key2, { type: 'halfrd', cell: [nx, ny, nz], offsetIndex: j, side: 'negative', material });
      return { added: 1, anchor: { x: nx, y: ny, z: nz } };
    }
    // pieceType === 'hourglass'
    const [loCell, hiCell] = canonicalHourglassCells(ax, ay, az, nx, ny, nz);
    const key2 = hourglassKey(...loCell, ...hiCell);
    const offsetIndex2 = hourglassOffsetIndex(loCell, hiCell);
    if (hemisphereStore.has(key2) || world.has(nx, ny, nz)) return { added: 0 };
    hemisphereStore.set(key2, { type: 'hourglass', cellA: loCell, cellB: hiCell, offsetIndex: offsetIndex2, material });
    return { added: 1, anchor: { x: ax, y: ay, z: az } };
  }

  function handleHemisphereClick(hit, mode, pieceType) {
    const action = mode === 'build' ? 'add' : 'remove';
    if (mode === 'build') {
      // Cluster stamps ('hemi3'/'hemi4'/'hemiTri'/'hemiRing') can anchor
      // on either a solid cell or an existing hemisphere piece's own
      // owning cell -- direct report 2026-09-06 ("the clusters should be
      // able to attach to each other") -- resolveClusterAnchorCell
      // handles both the same way, so this runs BEFORE the
      // hemisphereGroup-hit gate below (which is only about the
      // single-piece 'halfrd'/'hourglass' tools).
      if (['hemi3', 'hemi4', 'hemiTri', 'hemiRing'].includes(pieceType)) {
        const anchorCell = resolveClusterAnchorCell(hit);
        if (!anchorCell) { if (onPieceNoOp) onPieceNoOp(action); return; }
        const result = addHemisphereCluster(anchorCell, hit, pieceType);
        if (!result || result.added === 0) { if (onPieceNoOp) onPieceNoOp(action); return; }
        reconcileHemisphereStore();
        onHemisphereChange();
        if (onPlaced) {
          onPlaced({ x: result.anchorCell.x, y: result.anchorCell.y, z: result.anchorCell.z, material: getMaterial(), label: result.label });
        }
        return;
      }
      if (hit.object.parent === hemisphereGroup) {
        const result = growFromHemispherePiece(hit, pieceType);
        if (!result || result.added === 0) { if (onPieceNoOp) onPieceNoOp(action); return; }
        reconcileHemisphereStore();
        onHemisphereChange();
        if (onPlaced) onPlaced({ x: result.anchor.x, y: result.anchor.y, z: result.anchor.z, material: getMaterial() });
        return;
      }
      const anchorCell = hit.object === bccMesh ? bccCellAt(hit.instanceId) : cellAt(hit);
      if (!anchorCell) { if (onPieceNoOp) onPieceNoOp(action); return; }
      const n = hit.face.normal;
      const [dx, dy, dz] = matchNeighborOffset(n);
      const nx = anchorCell.x + dx;
      const ny = anchorCell.y + dy;
      const nz = anchorCell.z + dz;
      const material = getMaterial();
      if (pieceType === 'halfrd') {
        // The neighbor's own 'negative' half along this same direction is
        // the one flush against the clicked cell -- same reasoning
        // rhombis/geometry.js's buildHourglassStage already uses for its
        // own "far" cell (hemisphereGeometry(scale, fwdIndex, 'negative')).
        const offsetIndex = NEIGHBOR_OFFSETS.findIndex(([x, y, z]) => x === dx && y === dy && z === dz);
        const key = halfRdKey(nx, ny, nz, offsetIndex, 'negative');
        // Defensive, same fix as growFromHemispherePiece/addHemisphereCluster
        // above -- this bootstrap path is likely already protected in
        // practice (a solid-to-solid shared face is normally culled/hidden
        // by the main world's own renderer, so clicking through to an
        // already-solid neighbor shouldn't usually be reachable here), but
        // nothing actually guarantees that, and the cost of checking is
        // trivial -- never leave this one hemisphere-piece path as the
        // sole unchecked one.
        if (hemisphereStore.has(key) || world.has(nx, ny, nz)) { if (onPieceNoOp) onPieceNoOp(action); return; }
        hemisphereStore.set(key, { type: 'halfrd', cell: [nx, ny, nz], offsetIndex, side: 'negative', material });
        reconcileHemisphereStore();
        onHemisphereChange();
        if (onPlaced) onPlaced({ x: nx, y: ny, z: nz, material });
        return;
      }
      // 'hourglass'
      const [loCell, hiCell] = canonicalHourglassCells(anchorCell.x, anchorCell.y, anchorCell.z, nx, ny, nz);
      const key = hourglassKey(...loCell, ...hiCell);
      const offsetIndex = hourglassOffsetIndex(loCell, hiCell);
      if (hemisphereStore.has(key) || world.has(nx, ny, nz)) { if (onPieceNoOp) onPieceNoOp(action); return; }
      hemisphereStore.set(key, { type: 'hourglass', cellA: loCell, cellB: hiCell, offsetIndex, material });
      reconcileHemisphereStore();
      onHemisphereChange();
      // x/y/z here is the clicked (anchor) cell, purely so render.js's
      // flashAt has a real position -- the Hourglass itself spans two
      // cells, so this is just "where the click happened," not the
      // piece's own center.
      if (onPlaced) onPlaced({ x: anchorCell.x, y: anchorCell.y, z: anchorCell.z, material });
      return;
    }
    // mode === 'chisel' (Remove)
    if (hit.object.parent !== hemisphereGroup || !hit.object.userData.key) { if (onPieceNoOp) onPieceNoOp(action); return; }
    const piece = hemisphereStore.get(hit.object.userData.key);
    if (!piece) { if (onPieceNoOp) onPieceNoOp(action); return; }
    hemisphereStore.remove(hit.object.userData.key);
    onHemisphereChange();
    if (onRemoved) onRemoved(piece);
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
    // Same reasoning, for the hemisphere piece tiers.
    if ((mode === 'build' || mode === 'chisel') && HEMISPHERE_PIECE_TYPES.includes(pieceTypeForInterstitial) && hemisphereStore && hemisphereGroup) {
      handleHemisphereClick(hit, mode, pieceTypeForInterstitial);
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
      // attach flat to flat or point to point"), THEN a real regression
      // report the same day ("pyramids still dont seem to like having a
      // downward piece placed as the last piece of cub[e] and usually
      // place somewhere upwards close by"): a click landing on an
      // EXISTING cube-less pyramid's own tagged mesh (userData.axisKey,
      // see buildPyramidOnlyMeshes in render.js) can mean 3 different
      // things -- fill this SAME cell's own last missing axis (the
      // pre-existing 2026-08-29 "build toward a full RD/cube from one
      // seed" behavior), bond flat-to-flat at the exposed base (a real
      // octahedron), or bond point-to-point at the apex tip (chains
      // further out). A first version of this picked base/apex BEFORE
      // ever checking whether completing the cell was the obviously
      // closer, intended target -- resolvePyramidClickOnExisting (core/
      // pyramid.js) fixes that by comparing every real candidate's own
      // landmark point against the actual click point in one pass,
      // nearest wins, no fixed priority order.
      const hitAxisKey = hit.object?.userData?.axisKey;
      if (hitAxisKey) {
        const [hwx, hwy, hwz] = cellToWorld(cell.x, cell.y, cell.z);
        const hitLocalPoint = [hit.point.x - hwx, hit.point.y - hwy, hit.point.z - hwz];
        const hitLocalNormal = hit.face ? [hit.face.normal.x, hit.face.normal.y, hit.face.normal.z] : null;
        const missingAxisKeys = PYRAMID_AXES.filter((k) => !hasPyramid(effectivePyramids(cell), k));
        const resolved = resolvePyramidClickOnExisting({
          hostCell: [cell.x, cell.y, cell.z],
          hitAxisKey,
          missingAxisKeys,
          localNormal: hitLocalNormal,
          localPoint: hitLocalPoint,
          pieces: pyramidPieces(),
        });
        if (resolved.type === 'fill') {
          const fillResult = applyPyramidEdit(world, 'add', cell.x, cell.y, cell.z, resolved.axisKey);
          if (fillResult) {
            onChange();
            if (onPlaced) onPlaced(cell);
            return;
          }
        } else {
          const [mx, my, mz] = resolved.host;
          if (!world.has(mx, my, mz)) {
            const material = getMaterial();
            if (canPlaceMaterial(material, mx, my, mz)) {
              bootstrapPyramidCell(world, mx, my, mz, resolved.axisKey, material);
              onChange();
              if (onPlaced) onPlaced({ x: mx, y: my, z: mz, material });
              return;
            }
          }
          if (onPieceNoOp) onPieceNoOp('add');
          return;
        }
      }
      const axisKey = resolveClickedPyramidAxis(hit, cell, { preferMissing: true });
      if (!axisKey) { if (onPieceNoOp) onPieceNoOp('add'); return; }
      let result = applyPyramidEdit(world, 'add', cell.x, cell.y, cell.z, axisKey);
      // Real bug, reproduced live 2026-09-03: resolveClickedPyramidAxis's
      // "preferMissing" only shortcuts to a missing axis when it's one of
      // the 2 candidates tied to the SPECIFIC face actually hit
      // (candidateAxesForNeighborOffset, from that face's own neighbor
      // offset) -- clicking a diagonal seam between two OTHER, already-
      // PRESENT pyramids (nowhere near the real gap) resolves to one of
      // THOSE instead, no-ops here, and used to fall straight through to
      // "grow a stray neighbor cell" below even though this cell still
      // had a real pyramid missing elsewhere. That contradicted this
      // whole block's own documented invariant ("never changes what
      // happens when there genuinely IS a pyramid still to add") --
      // confirmed via a real Playwright repro (build a cell to 5/6
      // pyramids, click the same spot that filled the first two; the 3rd
      // click spawned an unrelated new cell instead of completing this
      // one). Fix: if this cell has ANY pyramid still missing, complete
      // the nearest one first -- mirrors resolvePyramidClickOnExisting's
      // own 'fill' branch just below, which already does exactly this
      // for the OTHER click path (landing on an existing tagged pyramid
      // mesh) and never had this bug.
      if (!result) {
        const missingAxisKeys = PYRAMID_AXES.filter((k) => !hasPyramid(effectivePyramids(cell), k));
        if (missingAxisKeys.length > 0) {
          const [hwx, hwy, hwz] = cellToWorld(cell.x, cell.y, cell.z);
          const hitLocalPoint = [hit.point.x - hwx, hit.point.y - hwy, hit.point.z - hwz];
          const nearestMissing = nearestPyramidAxis(hitLocalPoint, missingAxisKeys, pyramidPieces());
          result = applyPyramidEdit(world, 'add', cell.x, cell.y, cell.z, nearestMissing);
        }
      }
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
      // mode/piece tier): only reached now once the cell's own missing
      // pyramids (if any) have already been ruled out above, so it still
      // never changes what happens when there's a pyramid of THIS cell's
      // own left to add.
      if (!result) {
        const neighborOffset = matchNeighborOffset(hit.face.normal);
        const bnx = cell.x + neighborOffset[0];
        const bny = cell.y + neighborOffset[1];
        const bnz = cell.z + neighborOffset[2];
        // isValidCell's parity gate dropped here too, same reasoning as
        // resolveGrowthOffset's own header -- a diagonal offset is safe
        // regardless of the source cell's own parity (if this cell was
        // itself reached via pure-axis growth from an odd position, its
        // own further diagonal growth is exactly as safe as the
        // original even lattice's, just consistently shifted).
        if (!world.has(bnx, bny, bnz)) {
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
    const [dx, dy, dz] = resolveGrowthOffset(hit.face.normal);
    const nx = cell.x + dx;
    const ny = cell.y + dy;
    const nz = cell.z + dz;
    const material = getMaterial();
    // isValidCell's own even-parity check is dropped here (not touched
    // globally -- every other system that calls it, claims/asteroids/
    // growth/shell-counting included, is untouched): it was never an
    // intrinsic geometric requirement, just where the original seed
    // happened to sit -- FCC packing is translation-symmetric, so a
    // structure built from an odd-parity seed (reached via
    // resolveGrowthOffset's own pure-axis growth) tiles exactly as
    // safely as the original. Only real occupancy is checked now.
    if (world.has(nx, ny, nz)) return;
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
    // Same reasoning, for the hemisphere piece tiers.
    if (mode === 'build' && HEMISPHERE_PIECE_TYPES.includes(pieceTypeForInterstitialRemove) && hemisphereStore && hemisphereGroup) {
      handleHemisphereClick(hit, 'chisel', pieceTypeForInterstitialRemove);
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
    // resolveGrowthOffset/no isValidCell gate -- kept consistent with
    // the real placement handler above (see its own comment): every
    // integer position is a real, safe growth target now, only real
    // occupancy still matters. A stale ghost that doesn't match where a
    // click would actually place a cell would be a real, confusing bug.
    const [dx, dy, dz] = resolveGrowthOffset(hit.face.normal);
    const nx = cell.x + dx;
    const ny = cell.y + dy;
    const nz = cell.z + dz;
    const first = { x: nx, y: ny, z: nz, occupied: world.has(nx, ny, nz) };
    if (!showSecond) return [first];
    const nx2 = nx + dx;
    const ny2 = ny + dy;
    const nz2 = nz + dz;
    return [first, { x: nx2, y: ny2, z: nz2, occupied: world.has(nx2, ny2, nz2) }];
  }

  function onPointerMove(event) {
    const mode = getMode();
    if (!mode || mode === 'plant') {
      if (onHoverEnd) onHoverEnd();
      return;
    }

    if (pointerDownPos) {
      const moved = Math.hypot(event.clientX - pointerDownPos.x, event.clientY - pointerDownPos.y);
      // Drag-placement (Repeat) doesn't apply to the 'pyramid'/'to'/'ioct'/
      // 'idis' piece tiers -- same reason as the ghost preview below,
      // none is simple neighbor placement. 'halfrd'/'hourglass' join them
      // for the same reason (their own handleHemisphereClick resolves a
      // direction + side/canonical-pair from the clicked face, not a
      // plain "next FCC neighbor" cell). 'rd'/'cube' both still drag normally.
      if (moved > DRAG_MOVE_TOLERANCE && !dragging && getDragPlacementEnabled() && mode === 'build' && !['pyramid', 'to', 'ioct', 'idis', ...HEMISPHERE_PIECE_TYPES].includes(getPieceType())) {
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
    // edits the clicked cell's own pyramids); 'to'/'ioct'/'idis' place
    // into genuinely different worlds/lattices via their own bootstrap-
    // vs-extend logic; 'halfrd'/'hourglass' resolve a direction + side
    // from the clicked face rather than a plain neighbor cell -- none
    // fits the "next valid FCC position" ghost preview below. 'rd'/
    // 'cube' both still use it identically.
    if (mode !== 'build' || ['pyramid', 'to', 'ioct', 'idis', ...HEMISPHERE_PIECE_TYPES].includes(getPieceType())) {
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
