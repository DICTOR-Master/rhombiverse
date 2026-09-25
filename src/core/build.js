// Raycasts to find which of the 12 faces of a clicked RD was hit, then
// acts according to the currently selected build MODE (an explicit
// #mode-* button in index.html, read via getMode() -- see render.js).
// Right-click always removes the clicked
// cell, in every mode.
import * as THREE from 'three';
import {
  NEIGHBOR_OFFSETS,
  cellKey,
  parseCellKey,
  cellToWorld,
  pyramidPieces,
  PYRAMID_AXES,
  oppositeNeighborIndex,
  rdQuarterPieces,
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
import { nearestBCCCell, matchBCCNeighborOffset } from '../geometry-extensions/dual-lattice.js';
import { matchHexNeighborOffset } from '../geometry-extensions/hex-prism.js';
import { rhombohedraAttachOptions, rhombohedraOverlap } from '../geometry-extensions/rhombohedra-lattice.js';
import { pyrochloreSiteOrientation, pyrochloreNeighborForTTFace, pyrochloreNeighborForTetFace, pyrochloreCapForTTFace, pyrochloreTetCornerPartner, pyrochloreCapTetsOf, pyrochloreCellToWorld } from '../geometry-extensions/pyrochlore-lattice.js';
import { elongDodecaCellToWorld } from '../geometry-extensions/elongated-dodecahedron.js';
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
  rdQuarterKey,
  RD_QUARTER_ANCHORS,
} from './hemisphere-build.js';

// Every piece type routed through handleHemisphereClick/hemisphereStore --
// 'halfrd'/'hourglass' (single pieces) plus 'hemi3'/'hemi4' (bulk-add
// cluster stamps of the same underlying halfrd entries, core/hemisphere-
// build.js). One shared list so the several gates below (raycast targets,
// onClick/onContextMenu dispatch) can't drift out of sync with each other.
const HEMISPHERE_PIECE_TYPES = ['halfrd', 'hourglass', 'hemi3', 'hemi4', 'hemiTri', 'hemiRing', 'rdquarter'];

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
  getMaterial,
  // Piece tier (RHOMBIVERSE_SPEC_PYRAMID_SUBCELL.md, direct follow-up
  // 2026-08-26): 'rd' (default) | 'cube' | 'pyramid' | 'to' -- what the
  // universal Add/Remove actions (mode 'build'/'chisel' below) operate
  // on. Everything else (Fill/Dig/Round/Replace/Report) stays RD-only,
  // scoped deliberately -- not asked for beyond Add/Remove.
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
  // Elongated Dodecahedron ('elongdodeca' piece tier): same "adopted
  // family member" reasoning as TO above, EXCEPT this shape reuses
  // NEIGHBOR_OFFSETS/matchNeighborOffset verbatim -- unlike TO's own
  // genuinely different lattice, Elongated Dodecahedron is
  // combinatorially the SAME FCC lattice RD already uses (12 faces, same
  // 12 face-normal directions, verified in geometry-extensions/elongated-
  // dodecahedron.js's own header), just anisotropically stretched along
  // one axis -- so its own bootstrap and grow cases both reduce to the
  // exact same "cell + matchNeighborOffset(normal)" arithmetic, no
  // separate offset table or nearest-point snap needed. All optional/
  // no-op by default, same as every other adopted-family param above.
  elongDodecaWorld = null,
  elongDodecaMesh = null,
  elongDodecaCellAt = () => null,
  onElongDodecaChange = () => {},
  // Hex Prism ('hexprism' piece tier): a genuinely separate lattice
  // (own axial-hex coordinate frame, geometry-extensions/hex-prism.js --
  // NOT a sub-piece of RD's own lattice the way Elongated Dodecahedron
  // is, so there's no FCC-relative bootstrap here). Always seeded at
  // (0,0,0) by onHexPrismChange's own "never truly empty" invariant
  // (same pattern bccWorld/cuboctaWorld already use), so growth only
  // ever needs to click an EXISTING hex-prism face, never bootstrap
  // from FCC. All optional/no-op by default, same as every other
  // adopted-family param above.
  hexPrismWorld = null,
  hexPrismMesh = null,
  hexPrismCellAt = () => null,
  onHexPrismChange = () => {},
  // 2D lattice tier (replaces the old separate Square/Hexagon/Triangle
  // params): one generic "adopted family member" store PER PRIMITIVE
  // from lattice-2d.js's own LATTICE_PRIMITIVES, all sharing this
  // single param instead of one hand-written trio of params each.
  // `stores` maps a primitive's own `id` (e.g. "parallelogram") to
  // { world, mesh, cellAt }; `s` is the shared real-world scale every
  // primitive's basis vectors use; `getAngleDeg()` returns the
  // CURRENTLY toggled angle live (Phase 6 -- angle is a shared,
  // mutable rendering parameter now, not baked into which store is
  // active; see render.js's own lattice2dSeedCell header for why an
  // earlier per-(angle,primitive)-store design was a real mistake, not
  // just a different valid choice); `onChange(primitiveId)` fires
  // after any add/remove on that primitive's own store.
  lattice2d = null,
  // Rhombohedra (free lattice): same "adopted family member" reasoning
  // again -- own store, own coordinate frame (geometry-extensions/
  // rhombohedra-lattice.js), grows freely in any of 6 real directions
  // via real face-normal matching (a genuine 3D solid, not a flat 2D
  // tile, so no hit-point-direction workaround needed).
  rhombohedraWorld = null,
  rhombohedraMesh = null,
  rhombohedraCellAt = () => null,
  // 'copy' | 'mirror' -- render.js's Rhombohedra attach toggle.
  getRhombohedraAttachMode = () => 'copy',
  // 'whole' | 'small' -- render.js's Pyrochlore Whole tet / Small tet toggle.
  getPyrochloreAttachMode = () => 'whole',
  onRhombohedraChange = () => {},
  // Pyrochlore (3D Kagome, 'pyrochlore' piece tier): { world, meshes,
  // resolveHit, onChange } -- see render.js's own build-controller
  // params. Truncated tetrahedra are the stored cells; cap tetrahedra
  // are derived, tappable to grow but never removable on their own.
  pyrochlore = null,
  // A world that handles its own taps (4D: src/app/world-4d.js, 6D:
  // src/app/world-6d.js): { isActive(), meshes(), handleTap(hit, mode) ->
  // placed/removed? }. While active it's the only pick target and owns
  // every tap -- nothing 3D is visible or clickable there.
  ownWorld = null,
  // First-placement target (render.js firstPlacementSpec): { mesh,
  // place(material) } -- a cyan outline shown while the selected piece's
  // world is empty, replacing the old physical seeds (2026-09-24).
  firstPlacementTarget = null,
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
  // Real bug fix (see pick()'s own header on meshTargets for the full
  // incident): whether the main FCC world `mesh` should even be
  // considered a raycast candidate right now -- defaults to always-true
  // so every existing caller that never passes this keeps today's
  // exact behavior (mesh always pickable). render.js passes
  // `dimensionAllowsMesh('mesh')` specifically (NOT `mesh.visible`,
  // which also folds in Skeleton view's own separate hiding).
  getMeshPickable = () => true,
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
}) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  // One-time self-heal on load (2026-09-11): reconcileHemisphereStore()
  // (see its own header below) only runs after a NEW hemisphere action,
  // so a save that already had bad data BEFORE that function -- or
  // before the world.has() fix three commits before it -- existed would
  // carry that corruption forward forever, since nothing else ever
  // revisits already-stored pieces. Running it once right here, at
  // controller construction (i.e. once per real page load), sweeps up
  // and fixes any pre-existing corruption from an older save the moment
  // it's loaded, not just conflicts created from here on.
  // reconcileHemisphereStore() only touches the main world's own
  // onChange() -- it never calls onHemisphereChange() itself (every
  // OTHER call site below already calls that right afterward on its
  // own), so this startup call must do so explicitly too, or a healed
  // removal only ever happens in memory: never re-rendered (the stale
  // mesh stays visible) and never re-persisted (the very next reload
  // reads the same untouched localStorage and "heals" the identical
  // stale piece again, forever, without it ever sticking) -- caught
  // live, verified via a real page load against the user's own exported
  // save before trusting this.
  if (hemisphereStore && world && reconcileHemisphereStore()) onHemisphereChange();

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
    // Same reasoning as bccTargets above -- only enters the raycast
    // under its own piece tier, so it never steals clicks meant for the
    // main FCC world under any other tier. Also included for 'rd'/
    // 'cube' -- direct follow-up ("RD doesnt place on elongated RDs
    // rhombic sides"), see handleRDOffElongDodecaClick's own header.
    const elongDodecaTargets = elongDodecaMesh && (getPieceType() === 'elongdodeca' || getPieceType() === 'rd' || getPieceType() === 'cube') ? [elongDodecaMesh] : [];
    const hexPrismTargets = hexPrismMesh && getPieceType() === 'hexprism' ? [hexPrismMesh] : [];
    // Same reasoning as every other "adopted family member" above, for
    // whichever single (angle, primitive) combination is currently
    // active -- see lattice-2d.js's own header and this param's own
    // comment (createBuildController's `lattice2d` param) for why one
    // generic lookup replaces the old square2dTargets/hexagon2dTargets/
    // triangle2dTargets trio.
    const activeLattice2dStore = lattice2d && getPieceType().startsWith('lattice2d:') ? lattice2d.stores.get(getPieceType().slice('lattice2d:'.length)) : null;
    // Real bug, found investigating a separate "long touch isnt erasing"
    // report: this used to include ONLY `.mesh`, never `.classMeshes`
    // (Kite's own extra clickable class meshes at RD Rhombus/Golden
    // Rhombus, see render.js's own rebuildLattice2dInstances) or
    // `.companionMeshes` (Kagome's own triangle companions, made real
    // click targets the same session for the same reason) -- so a hit on
    // any of those silently missed every raycast, always. Both are
    // undefined for every primitive that doesn't have them, so this stays
    // a no-op (just `[activeLattice2dStore.mesh]`) everywhere else.
    const lattice2dTargets = activeLattice2dStore ? [activeLattice2dStore.mesh, ...(activeLattice2dStore.classMeshes ?? []), ...(activeLattice2dStore.companionMeshes ?? [])] : [];
    const rhombohedraTargets = rhombohedraMesh && getPieceType() === 'rhombohedra' ? [rhombohedraMesh] : [];
    const pyrochloreTargets = pyrochlore && getPieceType() === 'pyrochlore' ? pyrochlore.meshes : [];
    const firstPlacementTargets = firstPlacementTarget?.mesh.visible ? [firstPlacementTarget.mesh] : [];
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
    // Real, fundamental bug found investigating a separate hexagon-
    // specific click failure ("hexagon grew at: null" across a wide
    // sweep, while parallelogram mostly worked): `mesh` (the main FCC
    // world) used to be included in the raycast candidates
    // UNCONDITIONALLY, on the wrong assumption that THREE.Raycaster
    // skips invisible objects on its own -- it does NOT. Whenever the
    // main world's own default-seeded RD cell at the origin happened to
    // sit in front of (or overlap) whatever a 2D lattice tile's own
    // click ray hit, the HIDDEN main-world cell won the distance
    // comparison and silently intercepted the click before it ever
    // reached the real, visible 2D tile -- confirmed directly: a hit on
    // `mesh` at a CLOSER distance than the lattice2d target, even with
    // mesh.visible === false. This almost certainly explains a good
    // deal of the "not every click resolves a direction" behavior
    // observed all session, previously (wrongly) attributed entirely to
    // legitimate neighbor-direction tie-breaking. Fixed via
    // `getMeshPickable()` (defaults to always-true, so every existing
    // caller that never passes it keeps today's exact behavior) rather
    // than `mesh.visible` directly -- render.js's own `mesh.visible`
    // conflates TWO different reasons for being hidden (wrong
    // dimension, or Skeleton view mode), and Skeleton view may
    // deliberately keep the solid mesh raycastable-but-invisible so
    // clicking still builds against it while only a separate skeleton
    // overlay is shown; only the DIMENSION reason should gate picking.
    if (ownWorld?.isActive()) {
      const own = raycaster.intersectObjects(ownWorld.meshes(), false);
      return own.length > 0 ? own[0] : null;
    }
    const meshTargets = getMeshPickable() ? [mesh] : [];
    const hits = raycaster.intersectObjects([...meshTargets, ...extraPickTargets, ...bccTargets, ...elongDodecaTargets, ...hexPrismTargets, ...lattice2dTargets, ...rhombohedraTargets, ...pyrochloreTargets, ...firstPlacementTargets, ...interstitialTargets, ...hemisphereTargets], true);
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

  // Elongated Dodecahedron piece tier: bootstrap and grow both reduce to
  // the same "cell + matchNeighborOffset(normal)" step (see this
  // controller's own elongDodecaWorld param comment for why -- same
  // lattice topology as the main FCC world, no separate offset table or
  // snap needed). Unlike handleToClick, there's no bootstrap-vs-extend
  // BRANCH here beyond which mesh the raycast actually hit, since both
  // cases use identical arithmetic.
  function handleElongDodecaClick(hit, mode) {
    const action = mode === 'build' ? 'add' : 'remove';
    if (mode === 'build') {
      const n = hit.face.normal;
      let baseCell;
      if (hit.object === elongDodecaMesh) {
        if (hit.instanceId === undefined) { if (onPieceNoOp) onPieceNoOp(action); return; }
        baseCell = elongDodecaCellAt(hit.instanceId);
      } else {
        baseCell = cellAt(hit);
      }
      if (!baseCell) { if (onPieceNoOp) onPieceNoOp(action); return; }
      const [dx, dy, dz] = matchNeighborOffset(n);
      const nx = baseCell.x + dx, ny = baseCell.y + dy, nz = baseCell.z + dz;
      // No-op: an Elongated Dodecahedron already sits there -- same
      // class of "silent and correct, but reads as broken" bug TO's own
      // onPieceNoOp note above already documents.
      if (elongDodecaWorld.has(nx, ny, nz)) { if (onPieceNoOp) onPieceNoOp(action); return; }
      const material = getMaterial();
      elongDodecaWorld.addCell(nx, ny, nz, { material });
      onElongDodecaChange();
      if (onPlaced) onPlaced({ x: nx, y: ny, z: nz, material });
      return;
    }
    // mode === 'chisel' (Remove) -- only ever acts on an actual placed
    // Elongated Dodecahedron, same as TO's own Remove above.
    if (hit.object !== elongDodecaMesh || hit.instanceId === undefined) { if (onPieceNoOp) onPieceNoOp(action); return; }
    const cell = elongDodecaCellAt(hit.instanceId);
    if (!cell) { if (onPieceNoOp) onPieceNoOp(action); return; }
    elongDodecaWorld.removeCell(cell.x, cell.y, cell.z);
    onElongDodecaChange();
    if (onRemoved) onRemoved(cell);
  }

  // A plain RD/Cube growing back OFF an already-placed Elongated
  // Dodecahedron's own face -- direct follow-up, same session ("RD
  // doesnt place on elongated RDs rhombic sides"): bootstrap only ever
  // went one way (RD -> ElongDodeca) before this. Reuses the SAME real
  // NEIGHBOR_OFFSETS/matchNeighborOffset matching RD's own faces
  // already use (an ElongDodeca's 12 faces sit on the exact same 12
  // real directions).
  //
  // Real, unavoidable limit, checked explicitly rather than silently
  // guessed: the main world's own cellToWorld is a plain ISOTROPIC
  // per-axis scale, but elongDodecaCellToWorld is ANISOTROPIC along Z
  // (see that function's own header) -- the two only ever compute the
  // exact same real position for a shared integer address when the
  // elongation hasn't actually displaced it there (the 4 dz=0
  // directions always, or the very first dz!=0 step off a REAL,
  // un-elongated RD). Deeper into an ElongDodeca chain, no plain RD
  // integer address can land exactly flush any more -- rather than
  // silently place something misaligned, this checks the two real
  // positions match (within float tolerance) before ever writing to
  // `world`, and no-ops (not places-anyway) when they don't.
  function handleRDOffElongDodecaClick(hit, mode) {
    const action = mode === 'build' ? 'add' : 'remove';
    if (mode !== 'build' || hit.instanceId === undefined) { if (onPieceNoOp) onPieceNoOp(action); return; }
    const ecell = elongDodecaCellAt(hit.instanceId);
    if (!ecell) { if (onPieceNoOp) onPieceNoOp(action); return; }
    const [dx, dy, dz] = matchNeighborOffset(hit.face.normal);
    const nx = ecell.x + dx, ny = ecell.y + dy, nz = ecell.z + dz;
    const [ewx, ewy, ewz] = elongDodecaCellToWorld(nx, ny, nz);
    const [pwx, pwy, pwz] = cellToWorld(nx, ny, nz);
    const EPS = 1e-6;
    if (Math.abs(ewx - pwx) > EPS || Math.abs(ewy - pwy) > EPS || Math.abs(ewz - pwz) > EPS) {
      if (onPieceNoOp) onPieceNoOp(action);
      return;
    }
    if (world.has(nx, ny, nz)) { if (onPieceNoOp) onPieceNoOp(action); return; }
    const material = getMaterial();
    const data = getPieceType() === 'cube' ? { material, pyramids: 0 } : { material };
    world.addCell(nx, ny, nz, data);
    onChange();
    if (onPlaced) onPlaced({ x: nx, y: ny, z: nz, material });
  }

  // Hex Prism piece tier: grow-only (no bootstrap -- the "never truly
  // empty" invariant in render.js's onHexPrismChange guarantees a real
  // clickable cell always exists). Click an existing face, match its
  // normal against the 8 real hex-prism neighbor directions.
  function handleHexPrismClick(hit, mode) {
    const action = mode === 'build' ? 'add' : 'remove';
    if (hit.object !== hexPrismMesh || hit.instanceId === undefined) { if (onPieceNoOp) onPieceNoOp(action); return; }
    const cell = hexPrismCellAt(hit.instanceId);
    if (!cell) { if (onPieceNoOp) onPieceNoOp(action); return; }
    if (mode === 'build') {
      const [dq, dr, dz] = matchHexNeighborOffset(hit.face.normal);
      const nq = cell.x + dq, nr = cell.y + dr, nz = cell.z + dz;
      if (hexPrismWorld.has(nq, nr, nz)) { if (onPieceNoOp) onPieceNoOp(action); return; }
      const material = getMaterial();
      hexPrismWorld.addCell(nq, nr, nz, { material });
      onHexPrismChange();
      if (onPlaced) onPlaced({ x: nq, y: nr, z: nz, material });
      return;
    }
    hexPrismWorld.removeCell(cell.x, cell.y, cell.z);
    onHexPrismChange();
    if (onRemoved) onRemoved(cell);
  }

  // 2D lattice tier: ONE generic handler for every primitive in
  // lattice-2d.js's own LATTICE_PRIMITIVES, replacing the old
  // handleSquare2dClick/handleHexagon2dClick/handleTriangle2dClick trio
  // -- see this file's own `lattice2d` param comment and lattice-2d.js's
  // header for why one parametrized handler is correct in place of 3
  // hand-copied ones. Phase 6: the angle a click resolves against is
  // read LIVE via `lattice2d.getAngleDeg()` at click time, not baked
  // into a fixed per-store value -- this is what makes an
  // already-built structure's own neighbor directions stay correct
  // after the angle toggle has reshaped it (see render.js's own
  // lattice2dSeedCell header for the full incident this replaces: a
  // store used to be keyed by (angle, primitive) together, so toggling
  // angle silently switched to an unrelated store instead of
  // reshaping the one you'd actually built).
  //
  // Always matches the click's own hit-point direction against each
  // neighbor candidate's own REAL WORLD offset (impl.cellToWorld(cell+
  // offset) - impl.cellToWorld(cell)), never a raw index offset dotted
  // directly -- the general, always-correct technique Triangle's own
  // pre-Phase-3 handler already used. This matters more now than it did
  // before: the old Square-specific shortcut (dotting the RAW index
  // offset against the hit direction) only ever worked because Square
  // was hardcoded to a 90-degree (orthogonal) basis, where raw index
  // offsets happen to already point along real world axes -- at any of
  // the OTHER 3 named angles a Parallelogram's own basis vectors aren't
  // perpendicular, so that shortcut would silently pick the wrong
  // neighbor. Also handles a flat tile's own real "top face has zero
  // dot product with any in-plane offset" problem the same way every
  // 2D family already had to (see the old handleSquare2dClick's own
  // removed comment): hit-point-direction, never face-normal matching.
  function handleLattice2dClick(hit, mode, pieceType) {
    const action = mode === 'build' ? 'add' : 'remove';
    const primitiveId = pieceType.slice('lattice2d:'.length);
    const store = lattice2d?.stores.get(primitiveId);
    // Routed through lattice2d.getImpl (render.js's own resolveLattice2dImpl)
    // rather than a direct LATTICE_PRIMITIVE_IMPLS lookup, so a click
    // always agrees with whatever's actually rendered -- see that
    // accessor's own header for the real Rhombille-arrangement mismatch
    // this replaces.
    const impl = lattice2d?.getImpl(primitiveId);
    // Kagome remove: resolved purely from WHERE the press landed, not
    // from which mesh/instance the raycast reported -- direct report
    // (iPhone, 13 hexagons placed): long-press on a hexagon said "no
    // Kagome there to remove". The nearest lattice point to the hit is
    // the only hexagon that can contain it (each hexagon sits inside its
    // own point's Voronoi cell); delete it iff the point is inside.
    if (primitiveId === 'kagome' && mode !== 'build' && store && impl && hit?.point) {
      const angleDeg = lattice2d.getAngleDeg();
      const s = lattice2d.s;
      const [ox, oy] = impl.cellToWorld(0, 0, 0, angleDeg, s, 0);
      const [e0x, e0y] = impl.cellToWorld(1, 0, 0, angleDeg, s, 0);
      const [e1x, e1y] = impl.cellToWorld(0, 1, 0, angleDeg, s, 0);
      const v0 = [e0x - ox, e0y - oy], v1 = [e1x - ox, e1y - oy];
      const px = hit.point.x - ox, py = hit.point.y - oy;
      const det = v0[0] * v1[1] - v0[1] * v1[0];
      const a = (px * v1[1] - py * v1[0]) / det;
      const b = (v0[0] * py - v0[1] * px) / det;
      let best = null, bestD = Infinity;
      for (const x of [Math.floor(a), Math.floor(a) + 1]) {
        for (const y of [Math.floor(b), Math.floor(b) + 1]) {
          const [cx, cy] = impl.cellToWorld(x, y, 0, angleDeg, s, 0);
          const d = Math.hypot(hit.point.x - cx, hit.point.y - cy);
          if (d < bestD) { bestD = d; best = { x, y, cx, cy }; }
        }
      }
      const poly = impl.tileVerts(angleDeg, s, 0).slice(0, 6).map(([vx, vy]) => [vx + best.cx, vy + best.cy]);
      const inside = poly.every(([ax, ay], i) => {
        const [bx, by] = poly[(i + 1) % poly.length];
        return (bx - ax) * (hit.point.y - ay) - (by - ay) * (hit.point.x - ax) >= -1e-9;
      }) || poly.every(([ax, ay], i) => {
        const [bx, by] = poly[(i + 1) % poly.length];
        return (bx - ax) * (hit.point.y - ay) - (by - ay) * (hit.point.x - ax) <= 1e-9;
      });
      const cell = inside && store.world.has(best.x, best.y, 0) ? store.world.entries().find((c) => c.x === best.x && c.y === best.y && c.z === 0) : null;
      if (!cell) { if (onPieceNoOp) onPieceNoOp(action); return; }
      store.world.removeCell(best.x, best.y, 0);
      lattice2d.onChange(primitiveId);
      if (onRemoved) onRemoved(cell);
      return;
    }
    // Kite: store.classMeshes lists ALL of its real click targets (one
    // per distinct kite shape at the current angle), not just the
    // primary -- see render.js's own rebuildLattice2dInstances header for
    // why a hit can land on any of them. Kagome: store.companionMeshes
    // (its 2 triangle companions) are now real click targets too -- real
    // bug, direct report ("long touch isnt erasing"): they used to be
    // render-only, making roughly half of every Kagome cell's own
    // visible area an invisible dead zone for both add and remove, with
    // no way to tell hexagon from triangle by looking. Both fields are
    // undefined for every primitive that doesn't have them, so this
    // falls back to the plain single-mesh check everywhere else.
    // cellAt gets hit.object too: Kagome's companion (triangle) meshes
    // no longer share the primary mesh's per-cell instance index (see
    // render.js's own lattice2d store cellAt), every other mesh here
    // still does.
    const isRealClickTarget = !!store && (hit.object === store.mesh || store.classMeshes?.includes(hit.object) || store.companionMeshes?.includes(hit.object));
    if (!store || !impl || !isRealClickTarget || hit.instanceId === undefined) { if (onPieceNoOp) onPieceNoOp(action); return; }
    // Kagome: a triangle is shared by up to 3 hexagons, so removing via a
    // triangle hit deleted an arbitrary (first-placed) hexagon while the
    // pressed triangle often stayed visible. Direct decision: only
    // hexagons delete; a long-press on a triangle is a no-op.
    if (mode !== 'build' && store.companionMeshes?.includes(hit.object)) { if (onPieceNoOp) onPieceNoOp(action); return; }
    const cell = store.cellAt(hit.instanceId, hit.object);
    if (!cell) { if (onPieceNoOp) onPieceNoOp(action); return; }
    const angleDeg = lattice2d.getAngleDeg();
    if (mode === 'build') {
      const s = lattice2d.s;
      const [cx, cy] = impl.cellToWorld(cell.x, cell.y, cell.z, angleDeg, s, 0);
      const dirX = hit.point.x - cx;
      const dirY = hit.point.y - cy;
      const offsets = impl.neighborOffsets(angleDeg, cell.z);
      let bestIdx = 0, bestDot = -Infinity;
      offsets.forEach(([ox, oy, oz], i) => {
        const [nwx, nwy] = impl.cellToWorld(cell.x + ox, cell.y + oy, oz, angleDeg, s, 0);
        const dot = (nwx - cx) * dirX + (nwy - cy) * dirY;
        if (dot > bestDot) { bestDot = dot; bestIdx = i; }
      });
      const [dx, dy, dz] = offsets[bestIdx];
      const nx = cell.x + dx, ny = cell.y + dy, nz = dz ?? 0; // no orientation = z 0 (see kagomeNeighborOffsets)
      if (store.world.has(nx, ny, nz)) { if (onPieceNoOp) onPieceNoOp(action); return; }
      const material = getMaterial();
      store.world.addCell(nx, ny, nz, { material });
      lattice2d.onChange(primitiveId);
      if (onPlaced) onPlaced({ x: nx, y: ny, z: nz, material });
      return;
    }
    store.world.removeCell(cell.x, cell.y, cell.z);
    lattice2d.onChange(primitiveId);
    if (onRemoved) onRemoved(cell);
  }

  // Rhombohedra (free lattice), all 4 of RD Quarter's orientations
  // (2026-09-24, direct report: "only provides one orientation...
  // clustering four seems impossible"). Every face offers exactly 2
  // non-overlapping pieces (verified, scripts/verify-rhombohedra.mjs): a
  // same-orientation Copy and the Mirror image across that face -- the
  // one that pairs toward a whole RD. Which one a tap places comes from
  // render.js's own Copy | Mirror toggle (getRhombohedraAttachMode) --
  // replaced an earlier "tap the same spot again to cycle", which could
  // miss the new piece and place a second one instead (direct report).
  // Instances are rotated per orientation, so the hit face normal is
  // rotated back into world space before matching. A placement that
  // would overlap ANY existing piece is refused.
  function rhombohedraFits(opt) {
    return !rhombohedraWorld.entries().some((c) => {
      if (Math.abs(c.x - opt.c4[0]) > 8 || Math.abs(c.y - opt.c4[1]) > 8 || Math.abs(c.z - opt.c4[2]) > 8) return false;
      return rhombohedraOverlap(c.o ?? 0, [c.x, c.y, c.z], opt.o, opt.c4);
    });
  }
  function handleRhombohedraClick(hit, mode) {
    const action = mode === 'build' ? 'add' : 'remove';
    if (hit.object !== rhombohedraMesh || hit.instanceId === undefined) { if (onPieceNoOp) onPieceNoOp(action); return; }
    const cell = rhombohedraCellAt(hit.instanceId);
    if (!cell) { if (onPieceNoOp) onPieceNoOp(action); return; }
    if (mode === 'build') {
      const m = new THREE.Matrix4();
      hit.object.getMatrixAt(hit.instanceId, m);
      const n = hit.face.normal.clone().transformDirection(m);
      const q = cell.o ?? 0;
      const options = rhombohedraAttachOptions(q, [cell.x, cell.y, cell.z], [n.x, n.y, n.z]);
      const wantMirror = getRhombohedraAttachMode() === 'mirror';
      const opt = options.find((o) => (o.o !== q) === wantMirror);
      if (!opt || !rhombohedraFits(opt)) { if (onPieceNoOp) onPieceNoOp(action); return; }
      const material = getMaterial();
      rhombohedraWorld.addCell(...opt.c4, { material, o: opt.o });
      onRhombohedraChange();
      if (onPlaced) onPlaced({ x: opt.c4[0], y: opt.c4[1], z: opt.c4[2], material });
      return;
    }
    rhombohedraWorld.removeCell(cell.x, cell.y, cell.z);
    onRhombohedraChange();
    if (onRemoved) onRemoved(cell);
  }

  // Pyrochlore (3D Kagome): all 4 meshes are translation-only instances,
  // so hit.face.normal is already world-aligned. Add: a truncated
  // tetrahedron's hexagon face grows the neighbor across it; a cap
  // tetrahedron's face grows the TT across THAT face (its triangle faces
  // are always covered by a cap tet). Remove: only a TT itself -- a cap
  // tet is shared, same rule as 2D Kagome's triangles.
  function handlePyrochloreClick(hit, mode) {
    const action = mode === 'build' ? 'add' : 'remove';
    const resolved = pyrochlore && hit.instanceId !== undefined ? pyrochlore.resolveHit(hit) : null;
    if (!resolved) { if (onPieceNoOp) onPieceNoOp(action); return; }
    const n = [hit.face.normal.x, hit.face.normal.y, hit.face.normal.z];
    const world = pyrochlore.world;
    const cellAtKey = (c) => world.entries().find((e) => e.x === c[0] && e.y === c[1] && e.z === c[2]);
    // Small tet (direct request 2026-09-24, Whole tet | Small tet toggle):
    // individual small tetrahedra. Add: tap near a tet's corner -> the tet
    // sharing that corner; tap a truncated tetrahedron's exposed triangle
    // face -> its cap back. Remove: long-press any small tet -> just that
    // one (a derived cap gets a tetRemoved marker that STAYS, direct
    // decision). Long-press a truncated tetrahedron still removes it.
    if (getPyrochloreAttachMode() === 'small') {
      if (mode === 'build') {
        let target = null;
        if (resolved.type === 'tet') {
          const c = pyrochloreCellToWorld(...resolved.center);
          target = pyrochloreTetCornerPartner(resolved.kind, resolved.center, [hit.point.x - c[0], hit.point.y - c[1], hit.point.z - c[2]]);
        } else {
          target = pyrochloreCapForTTFace(resolved.cell.x, resolved.cell.y, resolved.cell.z, n);
        }
        if (!target) { if (onPieceNoOp) onPieceNoOp(action); return; }
        const existing = cellAtKey(target.center);
        const isDerivedCap = world.entries().some((e) => pyrochloreSiteOrientation(e.x, e.y, e.z) !== 0 && pyrochloreCapTetsOf(e.x, e.y, e.z).some((cap) => cap.center.every((v, a) => v === target.center[a])));
        if (existing?.tetAdded || (isDerivedCap && !existing?.tetRemoved)) { if (onPieceNoOp) onPieceNoOp(action); return; } // already showing
        const material = getMaterial();
        if (existing) world.removeCell(...target.center);
        world.addCell(...target.center, { material, tetAdded: true });
        pyrochlore.onChange();
        if (onPlaced) onPlaced({ x: target.center[0], y: target.center[1], z: target.center[2], material });
        return;
      }
      if (resolved.type === 'tet') {
        const existing = cellAtKey(resolved.center);
        const isDerivedCap = world.entries().some((e) => pyrochloreSiteOrientation(e.x, e.y, e.z) !== 0 && pyrochloreCapTetsOf(e.x, e.y, e.z).some((cap) => cap.center.every((v, a) => v === resolved.center[a])));
        if (existing) world.removeCell(...resolved.center);
        if (isDerivedCap) world.addCell(...resolved.center, { tetRemoved: true });
        pyrochlore.onChange();
        if (onRemoved) onRemoved({ x: resolved.center[0], y: resolved.center[1], z: resolved.center[2] });
        return;
      }
    }
    if (mode === 'build') {
      const target = resolved.type === 'tt'
        ? pyrochloreNeighborForTTFace(resolved.cell.x, resolved.cell.y, resolved.cell.z, n)
        : pyrochloreNeighborForTetFace(resolved.kind, resolved.center, n);
      if (!target || pyrochloreSiteOrientation(...target) === 0 || world.has(...target)) { if (onPieceNoOp) onPieceNoOp(action); return; }
      const material = getMaterial();
      world.addCell(...target, { material });
      pyrochlore.onChange();
      if (onPlaced) onPlaced({ x: target[0], y: target[1], z: target[2], material });
      return;
    }
    if (resolved.type !== 'tt') { if (onPieceNoOp) onPieceNoOp(action); return; }
    world.removeCell(resolved.cell.x, resolved.cell.y, resolved.cell.z);
    pyrochlore.onChange();
    if (onRemoved) onRemoved(resolved.cell);
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
    // Real bug found live (2026-09-11), "every time i try to attach a
    // half it becomes a whole straight away instead of waiting for the
    // missing half": offsetIndex and its own opposite (oppositeNeighborIndex)
    // describe the SAME cutting plane, just referenced from the other
    // side -- {offsetIndex:4, side:'negative'} at a cell is geometrically
    // IDENTICAL to {offsetIndex:7, side:'positive'} (7 = opposite(4)),
    // since hemisphereSplit's own positive/negative simply flips when the
    // reference direction flips. This reconciliation was comparing raw
    // offsetIndex values directly, so the legitimate "attach the missing
    // other half" case (reached via the opposite index, exactly what
    // growFromHemispherePiece's own same-cell completion produces when a
    // cluster chain reaches back two levels) was misread as a genuinely
    // different axis and promoted to solid immediately, before the pair
    // ever got a chance to actually complete each other. Normalizing
    // every offsetIndex to a canonical axis id (the smaller of itself and
    // its own opposite) before comparing fixes this: same axis, either
    // index, is compatible; only a genuinely different axis conflicts.
    const canonicalAxis = (offsetIndex) => Math.min(offsetIndex, oppositeNeighborIndex(offsetIndex));
    const axesByCell = new Map(); // cellId -> Set of canonical axis ids
    const ownerCountByCell = new Map(); // cellId -> total entry count (for wedge2's own "alone is fine, alongside anything else is not" rule)
    const bump = (id) => ownerCountByCell.set(id, (ownerCountByCell.get(id) ?? 0) + 1);
    const addAxisOwner = (cell, offsetIndex) => {
      const id = cellId(cell);
      if (!axesByCell.has(id)) axesByCell.set(id, new Set());
      axesByCell.get(id).add(canonicalAxis(offsetIndex));
      bump(id);
    };
    const wedgeCells = new Set();
    const addWedgeOwner = (cell) => {
      const id = cellId(cell);
      wedgeCells.add(id);
      bump(id);
    };
    for (const piece of hemisphereStore.entries()) {
      if (piece.type === 'halfrd') addAxisOwner(piece.cell, piece.offsetIndex);
      else if (piece.type === 'hourglass') { addAxisOwner(piece.cellA, piece.offsetIndex); addAxisOwner(piece.cellB, piece.offsetIndex); }
      else if (piece.type === 'wedge2') addWedgeOwner(piece.cell);
    }

    const toPromote = new Set();
    for (const [id, axes] of axesByCell) {
      if (axes.size > 1) toPromote.add(id);
    }
    for (const id of wedgeCells) {
      if ((ownerCountByCell.get(id) ?? 0) > 1) toPromote.add(id);
    }
    // Real bug found live (2026-09-11, via the user's own exported save):
    // a stale halfrd sitting at the SAME cell as an already-solid world
    // RD, created by an earlier, now-fixed version of this code (before
    // the world.has() check three commits back) -- once bad data like
    // that exists, no forward-looking placement check ever cleans it up
    // again on its own, so every later fix kept getting tested against
    // an already-corrupted save and looked like it hadn't worked. Any
    // hemisphere-owned cell that's ALREADY solid is unconditionally
    // stale (a real solid needs nothing else there) -- swept up here too
    // so loading an old save self-heals instead of carrying the bug
    // forward forever.
    for (const id of new Set([...axesByCell.keys(), ...wedgeCells])) {
      const [x, y, z] = id.split(',').map(Number);
      if (world.has(x, y, z)) toPromote.add(id);
    }
    if (toPromote.size === 0) return false;

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

    // Prefer each promoted cell's own removed piece(s)' real material over
    // getMaterial() (the currently-selected tool material) -- matters most
    // for the one-time startup self-heal above, where there's no actual
    // placement action happening to make "currently selected" meaningful,
    // and matters generally so healing old data doesn't silently recolor
    // it to whatever the player happens to have picked right now.
    const materialByCell = new Map();
    for (const piece of hemisphereStore.entries()) {
      const cellsOwned = piece.type === 'hourglass' ? [piece.cellA, piece.cellB] : [piece.cell];
      for (const c of cellsOwned) {
        const id = cellId(c);
        if (toPromote.has(id) && !materialByCell.has(id)) materialByCell.set(id, piece.material);
      }
      if (cellsOwned.some((c) => toPromote.has(cellId(c)))) hemisphereStore.remove(piece.key);
    }
    for (const id of toPromote) {
      const [x, y, z] = id.split(',').map(Number);
      if (!world.has(x, y, z)) world.addCell(x, y, z, { material: materialByCell.get(id) ?? getMaterial() });
    }
    onChange();
    return true;
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
    // 'rdquarter' (RD Quarter): same "only the cell matters" reasoning
    // as wedge2 above -- each of the 4 real rhombohedra is independent,
    // no missing-side direction to track.
    if (piece.type === 'rdquarter') return [{ cell: piece.cell, offsetIndex: null, side: null }];
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

  // RD Quarter ('rdquarter'): one at a time, like halfrd -- but each of
  // RD's own 4 real rhombohedra (rdQuarterPieces()) is an independent
  // solid within its OWN cell (no "missing other half" the way halfrd's
  // split has), so growth is simpler: match the click's own direction
  // from the cell center against whichever of the 4 anchor corners
  // aren't already placed there, and add that one. Bootstraps from a
  // solid FCC cell or a Hemi RD / Hourglass piece; a tap on an RD
  // Quarter itself mirrors across the tapped face (rdQuarterMirrorSlot).
  // Mirror growth (direct request 2026-09-25, "add mirror to RD
  // Quarter"): tapping an RD Quarter's own face places its mirror image
  // across that face -- the same Mirror rule as Rhombohedra. For every
  // orientation and face that image is itself an RD Quarter slot, in the
  // same cell or the next one (checked: 24/24; a same-orientation copy
  // never is, so RD Quarter has no Copy option). Refused when the slot is
  // taken or inside a solid RD.
  const RD_QUARTER_C4 = rdQuarterPieces(1).map((v) => [0, 1, 2].map((a) => Math.round((v.reduce((sum, p) => sum + p[a], 0) / 8) * 4)));
  function rdQuarterMirrorSlot(hit) {
    const piece = hemisphereStore.get(hit.object.userData.key);
    const q = piece.cornerIndex;
    const c4 = piece.cell.map((v, a) => v * 4 + RD_QUARTER_C4[q][a]);
    const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    const opt = rhombohedraAttachOptions(q, c4, [n.x, n.y, n.z]).find((o) => o.o !== q);
    if (!opt) return null;
    const cell = opt.c4.map((v, a) => (v - RD_QUARTER_C4[opt.o][a]) / 4);
    if (!cell.every(Number.isInteger)) return null;
    return { cell, cornerIndex: opt.o };
  }

  function handleRdQuarterClick(hit) {
    if (hit.object.parent === hemisphereGroup && hemisphereStore.get(hit.object.userData.key)?.type === 'rdquarter') {
      const slot = rdQuarterMirrorSlot(hit);
      if (!slot) return { added: 0 };
      const key = rdQuarterKey(...slot.cell, slot.cornerIndex);
      if (hemisphereStore.has(key) || world.has(...slot.cell)) return { added: 0 };
      hemisphereStore.set(key, { type: 'rdquarter', cell: slot.cell, cornerIndex: slot.cornerIndex, material: getMaterial() });
      return { added: 1, anchor: { x: slot.cell[0], y: slot.cell[1], z: slot.cell[2] } };
    }
    // Real bug, direct report ("RD quarter isn't allowing attachment to
    // RD or pair of RD-Hemis"): this used to only accept a hit on a
    // solid FCC cell or an EXISTING rdquarter piece, rejecting Hemi RD/
    // Hourglass/wedge2 hits outright. resolveClusterAnchorCell (already
    // used by the cluster stamps for exactly this "attach to any
    // existing hemisphere piece's own owning cell" case) resolves the
    // real anchor cell uniformly across all of those, plus solid cells,
    // plus rdquarter itself (see hemispherePieceCandidates' own new
    // 'rdquarter' case above) -- one consistent path instead of a
    // narrower bespoke check.
    const anchorCell = resolveClusterAnchorCell(hit);
    if (!anchorCell) return null;
    const cell = [anchorCell.x, anchorCell.y, anchorCell.z];
    const [wx, wy, wz] = cellToWorld(cell[0], cell[1], cell[2]);
    const dir = new THREE.Vector3(hit.point.x - wx, hit.point.y - wy, hit.point.z - wz).normalize();
    let bestIdx = -1;
    let bestDot = -Infinity;
    RD_QUARTER_ANCHORS.forEach((anchor, i) => {
      if (hemisphereStore.has(rdQuarterKey(cell[0], cell[1], cell[2], i))) return; // already placed -- skip
      const dot = new THREE.Vector3(...anchor).normalize().dot(dir);
      if (dot > bestDot) { bestDot = dot; bestIdx = i; }
    });
    if (bestIdx === -1) return { added: 0 }; // all 4 orientations already placed
    const key = rdQuarterKey(cell[0], cell[1], cell[2], bestIdx);
    hemisphereStore.set(key, { type: 'rdquarter', cell, cornerIndex: bestIdx, material: getMaterial() });
    return { added: 1, anchor: { x: cell[0], y: cell[1], z: cell[2] } };
  }

  function handleHemisphereClick(hit, mode, pieceType) {
    const action = mode === 'build' ? 'add' : 'remove';
    if (mode === 'build') {
      if (pieceType === 'rdquarter') {
        const result = handleRdQuarterClick(hit);
        if (!result || result.added === 0) { if (onPieceNoOp) onPieceNoOp(action); return; }
        onHemisphereChange();
        if (onPlaced) onPlaced({ x: result.anchor.x, y: result.anchor.y, z: result.anchor.z, material: getMaterial() });
        return;
      }
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
    // iPhone Safari can still deliver a synthesized click after a
    // long-press despite onTouchEnd's preventDefault -- that click would
    // immediately re-add what the long-press just removed (direct
    // report: "long press not working on iPhone", Kagome).
    if (performance.now() - lastLongPressAt < LONG_PRESS_CLICK_GUARD_MS) return;
    const hit = pick(event);
    if (!hit) return;

    const mode = getMode();
    if (!mode) return; // e.g. Walk mode active -- editing is disabled while walking
    if ((mode === 'build' || mode === 'chisel') && ownWorld?.isActive()) {
      if (!ownWorld.handleTap(hit, mode) && onPieceNoOp) onPieceNoOp(mode === 'build' ? 'add' : 'remove');
      return;
    }

    // First-placement target: a tap on the cyan outline places the
    // selected piece's first piece there (Add mode only).
    if (firstPlacementTarget && hit.object === firstPlacementTarget.mesh) {
      if (mode === 'build') {
        const material = getMaterial();
        firstPlacementTarget.place(material);
        if (onPlaced) onPlaced({ x: 0, y: 0, z: 0, material });
      }
      return;
    }

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
    if ((mode === 'build' || mode === 'chisel') && getPieceType() === 'elongdodeca' && elongDodecaWorld && elongDodecaMesh) {
      handleElongDodecaClick(hit, mode);
      return;
    }
    if ((mode === 'build' || mode === 'chisel') && getPieceType() === 'hexprism' && hexPrismWorld && hexPrismMesh) {
      handleHexPrismClick(hit, mode);
      return;
    }
    if ((mode === 'build' || mode === 'chisel') && getPieceType().startsWith('lattice2d:') && lattice2d) {
      handleLattice2dClick(hit, mode, getPieceType());
      return;
    }
    if ((mode === 'build' || mode === 'chisel') && getPieceType() === 'rhombohedra' && rhombohedraWorld && rhombohedraMesh) {
      handleRhombohedraClick(hit, mode);
      return;
    }
    if ((mode === 'build' || mode === 'chisel') && getPieceType() === 'pyrochlore' && pyrochlore) {
      handlePyrochloreClick(hit, mode);
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
    // RD/Cube growing back off an already-placed Elongated Dodecahedron's
    // own face -- routed BEFORE the generic cellAt() below, which only
    // knows the main FCC world's own instance-id space (same reasoning
    // as bccMesh's own gate above). See handleRDOffElongDodecaClick's
    // own header for why this can genuinely no-op on some clicks.
    if ((mode === 'build' || mode === 'chisel') && (pieceTypeForInterstitial === 'rd' || pieceTypeForInterstitial === 'cube') && hit.object === elongDodecaMesh && elongDodecaWorld && elongDodecaMesh) {
      handleRDOffElongDodecaClick(hit, mode);
      return;
    }

    const cell = cellAt(hit);
    if (!cell) return;
    if (mode === 'bcc') return; // BCC mode's click handling lives in core/bcc-build.js
    if (mode === 'cubocta') return; // Cuboctahedron Build's click handling lives in core/cubocta-build.js
    if (mode === 'dualize') return; // Dualize mode's click handling lives in render.js (reframe Stage 3)







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
    if (firstPlacementTarget && hit.object === firstPlacementTarget.mesh) return; // nothing placed there yet to remove
    const mode = getMode();
    // Long-press in 4D/6D removes the pressed piece (the world's own chisel).
    if (ownWorld?.isActive()) {
      if (mode && !ownWorld.handleTap(hit, 'chisel') && onPieceNoOp) onPieceNoOp('remove');
      return;
    }

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
    // Same reasoning, for every "adopted family member" piece tier with
    // its own dedicated handler (elongdodeca/hexprism/square2d/
    // hexagon2d/triangle2d) -- real bug, direct report ("long touches
    // arent removing newly created shapes... follow iPhone/iPad
    // capability of all previously built shapes"): these were never
    // wired into onContextMenu at all (only into onClick's own
    // dispatch), so long-press-to-remove (which synthesizes a
    // contextmenu event, see onTouchStart above) silently fell through
    // to cellAt(hit) below, which only knows the main FCC world's own
    // instance-id space -- always null for a hit on one of these
    // meshes, so the long-press did nothing. Each handler already
    // branches build (mode==='build') vs remove (anything else) on its
    // own, same as handleInterstitialClick/handleHemisphereClick above,
    // so passing 'chisel' here forces the remove branch the same way.
    if (mode === 'build' && pieceTypeForInterstitialRemove === 'elongdodeca' && elongDodecaWorld && elongDodecaMesh) {
      handleElongDodecaClick(hit, 'chisel');
      return;
    }
    if (mode === 'build' && pieceTypeForInterstitialRemove === 'hexprism' && hexPrismWorld && hexPrismMesh) {
      handleHexPrismClick(hit, 'chisel');
      return;
    }
    if (mode === 'build' && pieceTypeForInterstitialRemove.startsWith('lattice2d:') && lattice2d) {
      handleLattice2dClick(hit, 'chisel', pieceTypeForInterstitialRemove);
      return;
    }
    if (mode === 'build' && pieceTypeForInterstitialRemove === 'rhombohedra' && rhombohedraWorld && rhombohedraMesh) {
      handleRhombohedraClick(hit, 'chisel');
      return;
    }
    if (mode === 'build' && pieceTypeForInterstitialRemove === 'pyrochlore' && pyrochlore) {
      handlePyrochloreClick(hit, 'chisel');
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

  // Hover ghost: a translucent preview of where a tap would add the next
  // piece. Only meaningful in 'build' mode.

  function ghostCellsForHit(hit) {
    if (!hit) return null;
    const cell = cellAt(hit);
    if (!cell) return null;
    const [dx, dy, dz] = resolveGrowthOffset(hit.face.normal);
    const nx = cell.x + dx;
    const ny = cell.y + dy;
    const nz = cell.z + dz;
    return [{ x: nx, y: ny, z: nz, occupied: world.has(nx, ny, nz) }];
  }

  // One piece at a time (2026-09-25): the ghost always previews the single
  // piece a tap would place. Repeat (drag to place a run) and the
  // hold-for-a-two-cell-preview were removed.
  function onPointerMove(event) {
    const mode = getMode();
    if (mode !== 'build' || getPieceType().startsWith('lattice2d:') || ['pyramid', 'to', 'ioct', 'idis', 'pyrochlore', ...HEMISPHERE_PIECE_TYPES].includes(getPieceType())) {
      if (onHoverEnd) onHoverEnd();
      return;
    }
    const cells = ghostCellsForHit(pick(event));
    if (cells) {
      if (onHover) onHover(cells, !cells[0].occupied);
    } else if (onHoverEnd) {
      onHoverEnd();
    }
  }

  function onPointerLeave() {
    if (onHoverEnd) onHoverEnd();
  }

  let touchStartX = 0;
  let touchStartY = 0;
  let longPressTimer = null;
  let longPressFired = false;
  let lastLongPressAt = -Infinity;
  const LONG_PRESS_CLICK_GUARD_MS = 800;
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
      lastLongPressAt = performance.now();
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
      // Guard window starts at finger LIFT, not at long-press fire: a
      // hold longer than LONG_PRESS_CLICK_GUARD_MS otherwise let iPhone
      // Safari's post-touchend click through ("just keeps adding").
      lastLongPressAt = performance.now();
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
  renderer.domElement.addEventListener('pointerleave', onPointerLeave);

  return function dispose() {
    renderer.domElement.removeEventListener('click', onClick);
    renderer.domElement.removeEventListener('contextmenu', onContextMenu);
    renderer.domElement.removeEventListener('touchstart', onTouchStart);
    renderer.domElement.removeEventListener('touchmove', onTouchMove);
    renderer.domElement.removeEventListener('touchend', onTouchEnd);
    renderer.domElement.removeEventListener('pointermove', onPointerMove);
    renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
    clearTimeout(longPressTimer);
  };
}
