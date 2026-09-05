// Rhombis stage content: what each stage's skeleton/tray actually is,
// built from the one shared pyramidGeometry() (geometry.js) plus
// transforms only, per docs/RHOMBIVERSE_SPEC_RHOMBIS_GAME_BUILD_PLAN.md.
// main.js is the generic engine (input, render loop, HUD, stage
// advance); this file is purely "what exists in the scene for stage N"
// plus the matching initial puzzle-state descriptors -- kept separate
// so adding Stage 4+ is a new build function here, not a main.js
// rewrite.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { pyramidGeometry, outwardQuaternion, inwardQuaternion, AXIS_NORMALS, rhombicDodecahedronGeometry, quaternionForOrientationKey, disphenoidGeometry, DISPHENOID_ORIENTATIONS, quaternionForDisphenoidOrientation, disphenoidApexAxisKey } from './geometry.js';
import { PYRAMID_AXES, NEIGHBOR_OFFSETS, cellToWorld, cellsInShells } from '../core/lattice.js';
import { BCC_NEIGHBOR_OFFSETS, truncatedOctahedronVertices, isBCC } from '../geometry-extensions/dual-lattice.js';
import { bccShapeScaleFor } from '../geometry-extensions/bcc-detail-lattice.js';
import { octahedronVerts } from '../geometry-extensions/interstitial-lattice.js';
import { isCationSite, CATION_ANION_OFFSETS } from '../geometry-extensions/rock-salt-lattice.js';
import { enumerateShapes, SYMMETRY_OPERATIONS, applySymmetry } from './cell-arrangements.js';
import { ANY_SINGLE_CELL_GROUP } from './puzzle-state.js';

export const WIRE_COLOR = 0x6ad0ff;
const PIECE_COLOR = 0xffb35c;

// BCC's own real Voronoi/space-filling cell -- a truncated octahedron,
// NOT re-derived here: `truncatedOctahedronVertices` (real, 24-vertex,
// generated not hand-listed) already lives in
// `geometry-extensions/dual-lattice.js` and is already wired into real
// rendering elsewhere in this repo (render.js's own `new
// ConvexGeometry(...)` calls) -- same pattern, reused rather than
// reinvented, per the standing "if it isn't in rhombiverse and we need
// it, it should be in rhombiverse" principle (2026-09-05).
function truncatedOctahedronGeometry(scale = 1) {
  return new ConvexGeometry(truncatedOctahedronVertices(scale).map(([x, y, z]) => new THREE.Vector3(x, y, z)));
}
// A group id no real void ever has -- gives a "wrong shape" decoy piece
// (one whose SHAPE itself doesn't match any group here, not just a
// piece that's technically valid but a bad move) a `fillsGroup` that
// placeSelected() will always reject, regardless of which void it's
// tapped against, reusing the existing group-match machinery rather
// than adding a special case for "this piece can never be placed".
const DECOY_NEVER_MATCHES = '__decoy_shape_mismatch__';
const IDENTITY_QUATERNION = new THREE.Quaternion();
const ORIGIN = new THREE.Vector3(0, 0, 0);
// Verbatim reuse of render.js's own World View "translucent" treatment
// (applyWorldViewMaterials(), TRANSLUCENT_OPACITY) rather than inventing
// a second translucency convention -- direct instruction (2026-09-03,
// "we have all software in rhombiverse... in world view translucent").
// Lowered from the World View default of 0.55 -- direct instruction
// (2026-09-04, "target more transparent please") once the target had its
// own full-screen viewport (the two-viewport rewrite) and read as more
// solid/opaque at that larger size than it had at the old shared, smaller
// scale.
const TRANSLUCENT_OPACITY = 0.35;
export const GHOST_OPACITY = 0.65;

function pieceMaterial(color = PIECE_COLOR) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.1 });
}

// A stage's permanent, always-visible reference frame -- a real SOLID
// cube/RD mesh (not a wireframe), rendered translucent, so the goal
// shape reads as an actual 3D form rather than a tangle of edge lines.
// Direct instruction (2026-09-03): "I think goal piece should be
// translucent not skeleton and placing piece solid" -- replaces the
// earlier wireframe-only outer boundary (still fine, just superseded).
// A placed piece sits inside this fully opaque, so the shape visually
// "fills in" as you go -- also the answer to a separate same-day note
// ("goal piece should grow incrementally"): no separate growth/reveal
// logic needed, solidification falls straight out of real geometry
// filling real voids.
function makeOuterSolid(geometry, position = ORIGIN, color = WIRE_COLOR) {
  const material = new THREE.MeshStandardMaterial({
    color, transparent: true, opacity: TRANSLUCENT_OPACITY, depthWrite: false, roughness: 0.6,
    // DoubleSide: without it, WebGL back-face culling (the material's
    // own default) means a closed convex shape like the cube only ever
    // renders its near 3 faces -- blended against the background, not
    // against each other, so it reads as flat painted panels rather
    // than glass. Direct live report (2026-09-03): "cube isnt
    // translucent it is opaque so blocks view" -- confirmed the RD read
    // as more convincingly see-through than the cube purely because its
    // 12 smaller facets happen to overlap each other more from most
    // angles; the cube's 3 big flat near-faces never showed the far
    // wall at all. Rendering back faces too is what actually produces
    // the "see the far side through the near side" depth cue real glass
    // has.
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);
  return mesh;
}

// `position` is a real translation, not just cosmetic -- Stage 1/2's
// shared-base voids correctly need none (the canonical mesh's own base
// already sits at local y=0, exactly where those voids want it), but
// Stage 3's inward-pointing cube voids do NOT: rotating the canonical
// mesh about the origin alone leaves its base pinned at the origin and
// swings its apex out to the FACE, the exact opposite of "apex at the
// shared center, base on the face" -- verified numerically before this
// fix landed (apex ended up at -AXIS_NORMALS*scale/2, base at the
// origin). The real fix is a translation by +AXIS_NORMALS*(scale/2)
// alongside the rotation, which is what buildStage3 now passes.
function makeVoid(geometry, { id, requiredOrientation, quaternion = IDENTITY_QUATERNION, position = ORIGIN, groupIds = [] }) {
  // A translucent GHOST COPY of the piece that would go here -- not a
  // wireframe outline -- shown/colored red or green by main.js's
  // refreshVoidHighlights() while a piece is selected (direct decision
  // 2026-09-03, "ghost piece overlay"). Same geometry a real placed
  // piece uses, so the ghost is exactly the shape you'd actually get.
  const wire = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    color: WIRE_COLOR, transparent: true, opacity: GHOST_OPACITY, depthWrite: false, roughness: 0.5,
    side: THREE.DoubleSide, // see makeOuterSolid's own comment -- same reasoning
  }));
  wire.quaternion.copy(quaternion);
  wire.position.copy(position);
  const hitTarget = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ visible: false }));
  hitTarget.quaternion.copy(quaternion);
  hitTarget.position.copy(position);
  hitTarget.userData.voidId = id;
  return {
    id,
    requiredOrientation,
    groupIds,
    wire,
    hitTarget,
    quaternion: quaternion.clone(),
    position: position.clone(),
    sceneObjects: [wire, hitTarget],
  };
}

// `orientation`/`orientationOptions` are only set for a piece the player
// can flip themselves (Stage 1/2's up/down flip; Stage 4's manual-
// orientation prototype, the full 12-way in/out space). A piece without
// them (Stage 3's cube pieces, Stage 6's loose RD pieces) starts in the
// plain identity pose and gets its final rotation set programmatically
// on placement instead -- no player-driven flip needed for a piece that
// only ever goes one way.
function makePiece(geometry, { id, orientation, orientationOptions, homePosition, color }) {
  const mesh = new THREE.Mesh(geometry, pieceMaterial(color));
  mesh.position.copy(homePosition);
  if (orientation) mesh.quaternion.copy(quaternionForOrientationKey(orientation));
  mesh.userData.pieceId = id;
  return { id, orientation, orientationOptions, mesh, homePosition: homePosition.clone() };
}

// A "fused" piece (Stage 5): a genuinely different physical object, not
// a transform of the shared pyramid mesh -- stands in for every void in
// `fillsGroup` at once. Always visible in the tray from the start (see
// main.js's revealNextTrayPiece, which only ever queues loose pieces),
// since the player CHOOSES between it and the loose pieces rather than
// receiving it in sequence.
function makeFusedPiece(geometry, { id, fillsGroup, homePosition, trayScale = 1, requiresPlacedFirst, color }) {
  const mesh = new THREE.Mesh(geometry, pieceMaterial(color));
  mesh.position.copy(homePosition);
  mesh.scale.setScalar(trayScale);
  mesh.userData.pieceId = id;
  return { id, fillsGroup, mesh, homePosition: homePosition.clone(), trayScale, requiresPlacedFirst };
}

// Stage 1 -- engine + one piece. Direct instruction (2026-09-03): even
// this first piece starts in the WRONG orientation ('y-', apex down)
// against a void that wants 'y+' (apex up, the default identity pose),
// so the flip mechanic and the red/green valid-target highlighting are
// both already in play on the very first puzzle, rather than appearing
// cold at Stage 2.
function buildStage1(scale) {
  const geometry = pyramidGeometry(scale);
  const skeletonGroup = new THREE.Group();
  const v0 = makeVoid(geometry, { id: 'v0', requiredOrientation: 'y+', quaternion: outwardQuaternion('y+') });
  skeletonGroup.add(...v0.sceneObjects);

  const p0 = makePiece(geometry, {
    id: 'p0',
    orientation: 'y-',
    orientationOptions: ['y+', 'y-'],
    homePosition: new THREE.Vector3(scale * 2.2, 0, 0),
  });

  return {
    skeletonGroup,
    pieces: [p0],
    voids: [v0],
  };
}

// Stage 2 -- octahedron: two of the same pyramid joined base-to-base,
// apex 'y+' (outward/up, identity) and apex 'y-' (outward/down, a 180
// degree flip), sharing the same base plane at local y=0 -- see
// geometry.js's header for why that's a plain transform of Stage 1's
// own mesh, not a new shape. Both tray pieces start 'y+': exactly one
// void (v-up) accepts a piece as-is, so solving forces at least one
// real flip, and either piece can go in either void once flipped to
// match -- "both placeable in either order" per the spec's own Stage 2
// "Done when".
function buildStage2(scale) {
  const geometry = pyramidGeometry(scale);
  const skeletonGroup = new THREE.Group();
  const vUp = makeVoid(geometry, { id: 'v-up', requiredOrientation: 'y+', quaternion: outwardQuaternion('y+') });
  const vDown = makeVoid(geometry, { id: 'v-down', requiredOrientation: 'y-', quaternion: outwardQuaternion('y-') });
  skeletonGroup.add(...vUp.sceneObjects, ...vDown.sceneObjects);

  const orientationOptions = ['y+', 'y-'];
  const p0 = makePiece(geometry, {
    id: 'p0',
    orientation: 'y+',
    orientationOptions,
    homePosition: new THREE.Vector3(scale * 2.4, 0, scale * 0.9),
  });
  const p1 = makePiece(geometry, {
    id: 'p1',
    orientation: 'y+',
    orientationOptions,
    homePosition: new THREE.Vector3(scale * 2.4, 0, -scale * 0.9),
  });

  return {
    skeletonGroup,
    pieces: [p0, p1],
    voids: [vUp, vDown],
  };
}

// Every orientation a Stage 3/5 loose cube piece can be turned to: all 6
// axes, inward only (the cube has no outward voids) -- 'x+:in', 'x-:in',
// ... 6 total, reusing geometry.js's quaternionForOrientationKey.
const CUBE_ORIENTATIONS = PYRAMID_AXES.map((axisKey) => `${axisKey}:in`);

// Stage 3 -- cube: 6 of the same pyramid, apex pointing INWARD off each
// of the cube's 6 faces, all 6 apexes meeting at the shared center
// (RHOMBIVERSE_SPEC_RHOMBIS_GAME_BUILD_PLAN.md's own cube row: "apexes
// meeting at the cube's center, one pyramid per face").
//
// Manual orientation, matching Stage 4's own mechanic (direct
// instruction 2026-09-03, "extend manual orientation to stage 3, 5, and
// 6" -- confirming a direct question raised the same day, "why not only
// allow green for correctly oriented piece": with auto-orient (any open
// void accepts any piece as-is, this stage's ORIGINAL design), literally
// every open void was simultaneously "valid", which is both an odd fit
// for a game about spatial reasoning and the exact root cause of an
// earlier live rendering bug (many simultaneously-valid ghosts stacking
// into a solid wall, since a translucent layer's opacity compounds with
// every other overlapping one -- see this file's own git history / the
// project's own CLAUDE.md for the "cube isnt translucent" writeup). Every
// piece now starts at a fixed wrong orientation ('x+:in') and must be
// cycled -- tap the selected piece again -- through all 6 real targets
// before it will place, exactly Stage 4's own flow at 6-way instead of
// 12-way scale. Needed zero puzzle-state.js changes, same reason Stage 4
// didn't: flipPiece()/placeSelected() only ever compare `orientation`
// strings, already proven to generalize to any orientation-key count.
//
// What's still new this stage on top of that: the TRAY -- 6 identical
// piece entries, but only the next unplaced one is ever visible in the
// tray slot at once (main.js reveals the next after each placement)
// with the remaining count shown in the HUD text -- "tray needs to
// track counts of identical pieces" per the spec, without needing a new
// puzzle-state.js shape (they're still just 6 ordinary piece ids).
function buildStage3(scale) {
  const geometry = pyramidGeometry(scale);
  const skeletonGroup = new THREE.Group();
  skeletonGroup.add(makeOuterSolid(new THREE.BoxGeometry(scale, scale, scale)));

  const voids = PYRAMID_AXES.map((axisKey) => {
    const v = makeVoid(geometry, {
      id: `v-${axisKey}`,
      quaternion: inwardQuaternion(axisKey),
      position: AXIS_NORMALS[axisKey].clone().multiplyScalar(scale / 2),
      requiredOrientation: `${axisKey}:in`,
    });
    skeletonGroup.add(...v.sceneObjects);
    return v;
  });

  const homePosition = new THREE.Vector3(scale * 2.6, 0, 0);
  const pieces = PYRAMID_AXES.map((axisKey, i) => {
    const p = makePiece(geometry, { id: `p${i}`, orientation: 'x+:in', orientationOptions: CUBE_ORIENTATIONS, homePosition });
    p.mesh.visible = i === 0; // only the next available copy shows in the tray
    return p;
  });

  return {
    skeletonGroup,
    pieces,
    voids,
    hideIdleVoidWires: true,
  };
}

// Real bug, found and fixed 2026-09-04 (direct report: "these are
// unnecessarily challenging aspects like having two options that are
// the same, but you say one is wrong!"): the ORIGINAL scheme here was
// `PYRAMID_AXES.flatMap((axisKey) => [\`${axisKey}:in\`, \`${axisKey}:out\`])`
// -- 12 distinct STRING keys, on the assumption that "inward off axis A"
// and "outward off axis A" are always the only source of duplication (a
// real, correctly-DIFFERENT pair -- see `inwardQuaternion`/
// `outwardQuaternion`, they point opposite ways). What that scheme
// missed: `quaternionForApexDirection` (geometry.js) only cares about
// the FINAL apex direction, and inward-off-axis-A produces the exact
// SAME direction (hence the exact same quaternion) as outward-off-the-
// OPPOSITE-axis -- e.g. inward('x+') and outward('x-') both point the
// apex along -x. So the 12-string scheme actually only ever produced 6
// VISUALLY DISTINCT poses, each reachable under TWO different string
// names. From the player's own seat, cycling a selected (not yet
// placed) piece through 12 stops showed it visually repeating itself
// after every 2 taps -- and worse, a piece rotated to a pose that had
// JUST been accepted at one void could still get rejected at a
// different void tapped right after, because the two voids happened to
// name that same visual pose with different strings. Genuinely
// confusing, not intentional difficulty.
//
// Fixed by using the ACTUAL apex direction as the orientation key --
// `PYRAMID_AXES` itself (already exactly this vocabulary: Stage 1/2's
// own bare 'y+'/'y-' keys, resolved by `quaternionForOrientationKey`'s
// `outwardQuaternion(key)` fallback) -- rather than a second, redundant
// in/out encoding. `OPPOSITE_AXIS` below is what a void definition uses
// to convert "I want the apex pointing INWARD off axis A" into the
// canonical key for that real direction (the opposite axis's own outward
// pose) -- see `buildStage4`/`buildStage6`'s own void-building loops.
const OPPOSITE_AXIS = { 'x+': 'x-', 'x-': 'x+', 'y+': 'y-', 'y-': 'y+', 'z+': 'z-', 'z-': 'z+' };

// Stage 4 -- rhombic dodecahedron: 12 of the same pyramid, 2 per cube
// face (RHOMBIVERSE_SPEC_RHOMBIS_GAME_BUILD_PLAN.md's own RD row: "a
// cube's 6 inward pyramids, plus 6 more of the same pyramid mirrored
// outward on each face"). Per axis, the inward void (Stage 3's own) and
// the new outward void share the exact same `position` (both have their
// base on that same cube face) and differ only in `quaternion` --
// inward apex meets the shared center, outward apex is the RD's own
// spike. Verified numerically before landing (outward 'y+' at scale=2:
// base world (0,1,0), apex world (0,2,0), exactly the spec's own stated
// "(0,±s,0)" outward cap coordinate) rather than assumed from the
// Stage 3 pattern.
//
// Manual-orientation PROTOTYPE (direct instruction 2026-09-03, "let's
// prototype manual orientation on stage 4 and feel it out"): unlike
// Stage 3's auto-snap loose pieces, every piece here starts at a fixed
// wrong orientation ('x+', matching Stage 1's own "starts wrong" design)
// and must be cycled through PYRAMID_AXES (tap the selected piece again,
// same flip mechanic Stage 1/2 already use, just a 6-way cycle instead
// of binary) to the void's own `requiredOrientation` before it will
// place -- 6 real distinguishable poses, not the original 12-string
// scheme's accidental duplicates (see `OPPOSITE_AXIS`'s own comment
// above for the bug that fixed). "Inward and outward pyramids look
// identical but sit differently" (the spec's own Stage 4 note) now
// genuinely means the PLAYER has to tell them apart and orient for it,
// not just the raycaster resolving which region was tapped. Needed zero
// puzzle-state.js changes: flipPiece()/placeSelected() only ever
// compare `orientation` strings for equality, the same mechanism
// Stage 1/2 already exercise at 2-state scale.
function buildStage4(scale) {
  const geometry = pyramidGeometry(scale);
  const skeletonGroup = new THREE.Group();
  skeletonGroup.add(makeOuterSolid(rhombicDodecahedronGeometry(scale)));

  const voids = PYRAMID_AXES.flatMap((axisKey) => {
    const facePosition = AXIS_NORMALS[axisKey].clone().multiplyScalar(scale / 2);
    const vIn = makeVoid(geometry, {
      id: `v-in-${axisKey}`,
      quaternion: inwardQuaternion(axisKey),
      position: facePosition,
      requiredOrientation: OPPOSITE_AXIS[axisKey],
    });
    const vOut = makeVoid(geometry, {
      id: `v-out-${axisKey}`,
      quaternion: outwardQuaternion(axisKey),
      position: facePosition.clone(),
      requiredOrientation: axisKey,
    });
    skeletonGroup.add(...vIn.sceneObjects, ...vOut.sceneObjects);
    return [vIn, vOut];
  });

  const homePosition = new THREE.Vector3(scale * 3.2, 0, 0);
  const pieces = voids.map((_, i) => {
    const p = makePiece(geometry, {
      id: `p${i}`,
      orientation: 'x+',
      orientationOptions: PYRAMID_AXES,
      homePosition,
    });
    p.mesh.visible = i === 0; // only the next available copy shows in the tray
    return p;
  });

  return {
    skeletonGroup,
    pieces,
    voids,
    hideIdleVoidWires: true,
  };
}

// Disphenoid RD -- direct instruction (2026-09-04, "tetragonal
// disphenoids to form an RD", confirmed "for the RD not just single
// disphenoids"): the SAME RD skeleton as Stage 4, decomposed a
// completely different way -- 24 tetragonal disphenoids instead of 12
// pyramids (see `geometry.js`'s own `disphenoidGeometry`/
// `DISPHENOID_ORIENTATIONS` comment for the real geometric derivation
// and the numeric verification it was checked against before writing
// any of this).
//
// FIRST version of this stage offered all 24 as loose, individually-
// orientable pieces (Stage 4's own "one revealed at a time, tap-cycle
// to match" mechanic, just at 24-way instead of 12-way) -- built,
// verified live (a genuine full 24/24 solve, end to end), then
// DELIBERATELY REPLACED after direct feedback the moment it shipped:
// "stop its a good basis but I want lots of the pieces conjoined...
// it would end up too much of an x-ray exploration" -- 24 nearly-
// identical thin slivers, told apart only by careful rotation, read as
// tedious poking rather than a real puzzle. Confirmed via
// AskUserQuestion: group ALL 24 into a handful of fused chunks, no
// loose singles left at all.
//
// The 4 disphenoids sharing the same APEX point (`disphenoidApexAxisKey`,
// geometry.js) are always mutually face-adjacent -- verified
// numerically (every disphenoid has degree 3 in its own face-adjacency
// graph, exactly its 3 same-apex siblings) -- so grouping by apex axis
// gives 6 real, connected, non-arbitrary 4-disphenoid chunks, one per
// RD outward direction. Same self-centering discipline Molecules/Hulls
// already needed (see `buildMoleculeStage`'s own comment for the real
// bug that fix avoids repeating): each chunk's merged geometry is
// centered on ITS OWN centroid, with that same centroid as the group's
// placement anchor -- not the shared apex-convergence point at the
// RD's own center, which is NOT each chunk's own visual center of mass.
function buildDisphenoidRDStage(scale) {
  const skeletonGroup = new THREE.Group();
  skeletonGroup.add(makeOuterSolid(rhombicDodecahedronGeometry(scale)));

  const orientationIndexes = DISPHENOID_ORIENTATIONS.map((_, i) => i);
  const apexKeyFor = (i) => disphenoidApexAxisKey(i, scale);

  const voids = orientationIndexes.map((i) => {
    const key = DISPHENOID_ORIENTATIONS[i];
    return makeVoid(disphenoidGeometry(scale), {
      id: `v-${key}`,
      quaternion: quaternionForDisphenoidOrientation(key),
      position: ORIGIN,
      groupIds: [apexKeyFor(i)],
    });
  });
  voids.forEach((v) => skeletonGroup.add(...v.sceneObjects));

  const groups = [];
  const pieceSpecs = PYRAMID_AXES.map((axisKey) => {
    const memberIndexes = orientationIndexes.filter((i) => apexKeyFor(i) === axisKey);
    const memberGeometries = memberIndexes.map((i) =>
      disphenoidGeometry(scale).applyQuaternion(quaternionForDisphenoidOrientation(DISPHENOID_ORIENTATIONS[i])),
    );
    const memberCentroids = memberGeometries.map((g) => {
      g.computeBoundingSphere();
      return g.boundingSphere.center;
    });
    const chunkCentroid = memberCentroids.reduce((sum, c) => sum.add(c), new THREE.Vector3()).multiplyScalar(1 / memberCentroids.length);
    groups.push({ id: axisKey, position: chunkCentroid, quaternion: new THREE.Quaternion() });
    const geometry = mergeGeometries(
      memberGeometries.map((g) => g.translate(-chunkCentroid.x, -chunkCentroid.y, -chunkCentroid.z)),
      false,
    );
    return { id: `chunk-${axisKey}`, fillsGroup: axisKey, geometry };
  });

  // Same per-load Fisher-Yates as every other multi-piece tier.
  for (let i = pieceSpecs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pieceSpecs[i], pieceSpecs[j]] = [pieceSpecs[j], pieceSpecs[i]];
  }

  const { nextTrayPosition } = createTrayLayout(scale, pieceSpecs.length);
  const pieces = pieceSpecs.map((spec) => makeFusedPiece(spec.geometry, {
    id: spec.id,
    fillsGroup: spec.fillsGroup,
    homePosition: nextTrayPosition(spec.geometry),
  }));

  return { skeletonGroup, pieces, voids, groups, hideIdleVoidWires: true };
}

// Stage 5 -- conjoined pieces: the SAME 6-void cube as Stage 3 (now also
// manually-oriented, same reasoning as Stage 3's own header -- direct
// instruction 2026-09-03), but the tray now also offers a single
// pre-fused "cube" piece as an alternate fill for all 6 at once
// (RHOMBIVERSE_SPEC_RHOMBIS_GAME_BUILD_PLAN.md: "a fused six for a
// cube... optional fill for part of a larger void"). Demonstrates the
// spec's own Stage 5 "Done when" directly: solvable either by placing 6
// loose pyramids one at a time, each correctly oriented (exactly Stage
// 3's own flow, still fully available) OR by selecting the fused piece
// and tapping once -- both are real, independent decompositions of the
// identical cube volume (puzzle-state.js's own `fillsGroup`/`groupIds`
// mechanism, unit tested for both paths plus the "fused piece rejected
// once a loose piece has claimed part of the group" case). A void's
// `groupIds` (for the fused path) and `requiredOrientation` (for the
// loose path) are independent and don't conflict -- `voidValidityForPiece`
// /`placeSelected` only ever read `requiredOrientation` for a piece
// WITHOUT `fillsGroup`, and only ever read `groupIds` for one WITH it.
// The fused piece is a genuine `THREE.BoxGeometry` -- a real cube, not 6
// stitched copies of the shared pyramid mesh -- since it's honestly a
// DIFFERENT physical object, not a transform of the one shared piece the
// rest of Rhombis reuses; it has no orientation concept at all, unlike
// its loose siblings.
function buildStage5(scale) {
  const geometry = pyramidGeometry(scale);
  const skeletonGroup = new THREE.Group();
  skeletonGroup.add(makeOuterSolid(new THREE.BoxGeometry(scale, scale, scale)));
  const GROUP_ID = 'cube';

  const voids = PYRAMID_AXES.map((axisKey) => {
    const v = makeVoid(geometry, {
      id: `v-${axisKey}`,
      quaternion: inwardQuaternion(axisKey),
      position: AXIS_NORMALS[axisKey].clone().multiplyScalar(scale / 2),
      groupIds: [GROUP_ID],
      requiredOrientation: `${axisKey}:in`,
    });
    skeletonGroup.add(...v.sceneObjects);
    return v;
  });

  const homePosition = new THREE.Vector3(scale * 2.6, 0, 0);
  const loosePieces = PYRAMID_AXES.map((axisKey, i) => {
    const p = makePiece(geometry, { id: `p${i}`, orientation: 'x+:in', orientationOptions: CUBE_ORIENTATIONS, homePosition });
    p.mesh.visible = i === 0; // only the next available copy shows in the tray
    return p;
  });

  const fusedGeometry = new THREE.BoxGeometry(scale, scale, scale);
  const fusedHomePosition = new THREE.Vector3(scale * 2.6, -scale * 1.7, 0);
  const fusedPiece = makeFusedPiece(fusedGeometry, {
    id: 'fused',
    fillsGroup: GROUP_ID,
    homePosition: fusedHomePosition,
  });

  return {
    skeletonGroup,
    pieces: [...loosePieces, fusedPiece],
    voids,
    groups: [{ id: GROUP_ID, position: new THREE.Vector3(0, 0, 0), quaternion: new THREE.Quaternion() }],
    hideIdleVoidWires: true,
  };
}

// Stage 6 -- multi-cell: two full rhombic dodecahedra (Stage 4's own
// 12-void cell, repeated) at REAL adjacent FCC lattice positions --
// core/lattice.js's own NEIGHBOR_OFFSETS/cellToWorld, the exact math
// the main Rhombiverse app uses to place real RD cells, not a Rhombis-
// only approximation ("the connection back to the original 'strings of
// blocks' idea and the Rhombiverse lattice work", the spec's own
// framing for this stage). The two cells are centered on their own
// shared centroid (not cell 0's own position) so dragging rotates the
// whole composite around its natural middle, not off to one side.
//
// Each cell independently offers Stage 5's own loose-vs-fused choice,
// now at 12-piece scale: 12 loose pyramids (manually oriented, same
// 12-way in/out cycle as Stage 4's own pieces -- direct instruction
// 2026-09-03 extended manual orientation to every stage that still had
// auto-orienting loose pieces) OR one real, whole rhombic-
// dodecahedron piece (geometry.js's rhombicDodecahedronGeometry,
// reusing core/lattice.js's own rdRawVerts -- the exact same mesh the
// main app places for a real RD cell) that fills that cell's own 12
// voids in a single placement. With 2 independent per-cell choices this
// gives 4 real combinations overall (loose+loose, loose+fused,
// fused+loose, fused+fused) -- comfortably past the spec's own
// "fillable by more than one piece combination". All 24 loose pieces
// share ONE tray queue across both cells (visually and mechanically
// identical regardless of which cell or axis they end up on, same as
// Stage 4's own single-queue tray); the 2 fused RD pieces are each
// their own always-visible slot, same as Stage 5's fused cube.

// Shared by Stage 6 and Stage 7 -- the real adjacent-cell-pair position
// math (`core/lattice.js`'s own NEIGHBOR_OFFSETS/cellToWorld, the exact
// math the main app uses for real RD cells), centered on the pair's own
// midpoint so dragging rotates the composite around its natural middle.
// Factored out so both stages are PROVABLY the same underlying geometry,
// not just visually similar -- Stage 7 (direct instruction 2026-09-04,
// "the two target cells were joined previously no?" -- no, confirmed by
// reading the code: Stage 6's two fused pieces are independent, each
// filling only its own cell, never both at once) adds a genuinely new
// "joined pair" piece that fills both cells in a single placement,
// which needed no new cell-position math, only a new piece.
function twoCellCenters(scale) {
  const cellOffsets = [[0, 0, 0], NEIGHBOR_OFFSETS[0]];
  const cellWorldPositions = cellOffsets.map(([cx, cy, cz]) => new THREE.Vector3(...cellToWorld(cx, cy, cz, scale)));
  const centroid = cellWorldPositions[0].clone().add(cellWorldPositions[1]).multiplyScalar(0.5);
  return cellWorldPositions.map((p) => p.clone().sub(centroid));
}

function buildStage6(scale) {
  const pyramid = pyramidGeometry(scale);
  const skeletonGroup = new THREE.Group();
  const cellCenters = twoCellCenters(scale);

  const voids = [];
  const groups = [];
  const loosePieces = [];
  const fusedPieces = [];

  cellCenters.forEach((cellCenter, cellIndex) => {
    const groupId = `cell-${cellIndex}`;
    groups.push({ id: groupId, position: cellCenter.clone(), quaternion: new THREE.Quaternion() });
    skeletonGroup.add(makeOuterSolid(rhombicDodecahedronGeometry(scale), cellCenter));

    PYRAMID_AXES.forEach((axisKey) => {
      const facePosition = cellCenter.clone().add(AXIS_NORMALS[axisKey].clone().multiplyScalar(scale / 2));
      [['in', inwardQuaternion, OPPOSITE_AXIS[axisKey]], ['out', outwardQuaternion, axisKey]].forEach(([dirLabel, toQuaternion, canonicalOrientation]) => {
        const v = makeVoid(pyramid, {
          id: `v-${groupId}-${dirLabel}-${axisKey}`,
          quaternion: toQuaternion(axisKey),
          position: facePosition,
          groupIds: [groupId],
          requiredOrientation: canonicalOrientation,
        });
        skeletonGroup.add(...v.sceneObjects);
        voids.push(v);
      });
    });

    const fusedGeometry = rhombicDodecahedronGeometry(scale);
    const fusedHome = new THREE.Vector3(scale * 4, -scale * 2.6 * cellIndex, -scale * 1.6);
    fusedPieces.push(makeFusedPiece(fusedGeometry, {
      id: `fused-${groupId}`,
      fillsGroup: groupId,
      homePosition: fusedHome,
    }));
  });

  const looseHome = new THREE.Vector3(scale * 3.6, -scale * 1.3, scale * 2.2);
  for (let i = 0; i < voids.length; i++) {
    // Manual orientation, same reasoning as Stage 3/4/5's own headers
    // (direct instruction 2026-09-03) -- reuses PYRAMID_AXES unchanged,
    // since a Stage 6 loose piece is geometrically identical to a Stage
    // 4 one and needs the exact same 6-way cycle (see `OPPOSITE_AXIS`'s
    // own comment for why this isn't the original 12-string scheme).
    const p = makePiece(pyramid, { id: `p${i}`, orientation: 'x+', orientationOptions: PYRAMID_AXES, homePosition: looseHome });
    p.mesh.visible = i === 0; // only the next available copy shows in the tray
    loosePieces.push(p);
  }

  return {
    skeletonGroup,
    pieces: [...loosePieces, ...fusedPieces],
    voids,
    groups,
    hideIdleVoidWires: true,
  };
}

// Stage 7 -- joined pair: the SAME 2-cell composite as Stage 6
// (`twoCellCenters`, provably identical geometry), but a genuinely
// different puzzle, not more content on Stage 6's own engine. Direct
// instruction (2026-09-04): "2 joined cell arrangement - two joined
// cell solution... 1 single cell as decoy". No loose pieces at all --
// exactly two fused pieces:
//  - the JOINED PAIR: one real physical object spanning both cells,
//    filling all 24 voids in a single placement -- a genuinely new
//    mechanic (Stage 6's own two fused pieces are independent, each
//    only ever filling its own cell; nothing before this filled both
//    at once). Built by merging two rhombicDodecahedronGeometry(scale)
//    instances, each translated to its own cell's center, into one
//    real BufferGeometry (three/addons' mergeGeometries, the same
//    established pattern render.js already uses for its own merged
//    skeleton meshes) -- one real THREE.Mesh, not a Group, since
//    main.js's raycaster intersects pieceTargets non-recursively and
//    would never see a Group's children.
//  - the DECOY: an ordinary single-cell whole-RD fused piece, visually
//    identical to Stage 5/6's own fused pieces and just as functional
//    -- tap it onto cell-0 and it genuinely, correctly fills that
//    cell's 12 voids. The trap is real, not a fake/rejected button: use
//    it and cell-1 has nothing left to fill it with (no loose pieces,
//    only one decoy), so the composite is stuck open until Undo. A
//    decoy that simply rejected every tap wouldn't be a decoy, just a
//    disabled-looking button -- this one has to actually work to be
//    worth avoiding.
// This needed puzzle-state.js's own `groupIds` generalization (voids
// carry an ARRAY of group memberships now, not one) -- a cell-0 void
// belongs to BOTH 'cell-0' (the decoy's own group) and 'joined-01' (the
// joined pair's group) at once, so `voidValidityForPiece`/
// `placeSelected` can resolve either piece's own group correctly
// against the same 24 voids without the two mechanisms conflicting.
function buildStage7(scale) {
  const skeletonGroup = new THREE.Group();
  const cellCenters = twoCellCenters(scale);
  const pyramid = pyramidGeometry(scale);

  const voids = [];
  cellCenters.forEach((cellCenter, cellIndex) => {
    const cellGroupId = `cell-${cellIndex}`;
    skeletonGroup.add(makeOuterSolid(rhombicDodecahedronGeometry(scale), cellCenter));
    PYRAMID_AXES.forEach((axisKey) => {
      const facePosition = cellCenter.clone().add(AXIS_NORMALS[axisKey].clone().multiplyScalar(scale / 2));
      [['in', inwardQuaternion], ['out', outwardQuaternion]].forEach(([dirLabel, toQuaternion]) => {
        const v = makeVoid(pyramid, {
          id: `v-${cellGroupId}-${dirLabel}-${axisKey}`,
          quaternion: toQuaternion(axisKey),
          position: facePosition,
          groupIds: [cellGroupId, 'joined-01'],
        });
        skeletonGroup.add(...v.sceneObjects);
        voids.push(v);
      });
    });
  });

  const groups = [
    { id: 'cell-0', position: cellCenters[0].clone(), quaternion: new THREE.Quaternion() },
    { id: 'joined-01', position: ORIGIN, quaternion: new THREE.Quaternion() },
  ];

  const decoyGeometry = rhombicDodecahedronGeometry(scale);
  const decoySpec = { id: 'decoy', fillsGroup: 'cell-0', geometry: decoyGeometry };

  const joinedGeometry = mergeGeometries([
    rhombicDodecahedronGeometry(scale).translate(cellCenters[0].x, cellCenters[0].y, cellCenters[0].z),
    rhombicDodecahedronGeometry(scale).translate(cellCenters[1].x, cellCenters[1].y, cellCenters[1].z),
  ], false);
  const joinedSpec = { id: 'joined-pair', fillsGroup: 'joined-01', geometry: joinedGeometry };

  // A "different connection of 2" decoy was tried here and reverted the
  // same day -- direct live report ("stage 2 2 cells they are exactly
  // the same even rejected one"): in this lattice, EVERY 2-cell joined
  // pair is congruent to every other one (the symmetry group acts
  // transitively on nearest-neighbor pairs), so two RDs joined along a
  // different lattice direction isn't a genuinely different SHAPE at
  // all, just the same shape at a different rotation -- confirmed live,
  // it was visually indistinguishable from the real joined-pair, not a
  // real decoy.
  //
  // Replaced with the actual follow-up suggestion ("put two cube
  // together joined along edge") -- a genuinely different PRIMITIVE
  // (cube, not RD), same "wrong material" idea Stage 1's own single-
  // cube decoy already uses, extended to 2 cells instead of trying to
  // make a false RD variant. First attempt offset the cubes along only
  // ONE axis, which actually joins them flush FACE-to-face, not along
  // an edge -- corrected directly ("cubes should be joined at edges or
  // corners not on flats"): offsetting along TWO axes at once (here, X
  // and Y, by a full `scale` each) makes the two cubes share exactly
  // the one-dimensional edge where their corners meet, not a full 2D
  // face -- a visibly "twisted" silhouette that immediately reads as
  // NOT how real pieces connect in this game, rather than a flush block
  // that could pass for a plausible piece shape-wise.
  const cubeDecoyGeometry = mergeGeometries([
    new THREE.BoxGeometry(scale, scale, scale).translate(-scale / 2, -scale / 2, 0),
    new THREE.BoxGeometry(scale, scale, scale).translate(scale / 2, scale / 2, 0),
  ], false);
  const cubeDecoySpec = { id: 'decoy-cubes', fillsGroup: DECOY_NEVER_MATCHES, geometry: cubeDecoyGeometry };

  // A real per-load shuffle of the tray slots, not a fixed order --
  // direct instruction (2026-09-04, "there still seems to be a lot of
  // the right answers is the last piece"): the 3 fixed Y positions
  // below used to always go to the SAME piece (decoy, then joined-pair,
  // then the new cube decoy, in that order) every single load, which is
  // exactly the kind of learnable positional shortcut this stage's own
  // decoys are meant to prevent.
  const trayYs = [0, -scale * 2.6, -scale * 5.4];
  const specs = [decoySpec, joinedSpec, cubeDecoySpec];
  for (let i = specs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [specs[i], specs[j]] = [specs[j], specs[i]];
  }
  const pieces = specs.map((spec, i) => makeFusedPiece(spec.geometry, {
    id: spec.id,
    fillsGroup: spec.fillsGroup,
    homePosition: new THREE.Vector3(scale * 4, trayYs[i], 0),
  }));

  return {
    skeletonGroup,
    pieces,
    voids,
    groups,
    hideIdleVoidWires: true,
  };
}

// Stages 8-11 -- the 4 REAL, symmetry-verified 3-cell shapes
// (`cell-arrangements.js`'s own `enumerateShapes(3)`, computed and
// hand-checked 2026-09-04 -- not guessed: a triangle, a straight line,
// and two genuinely different bent-chain angles). Direct instruction:
// "all 4" get built, and each one's tray follows "an extra two piece
// with three pieces, after singles" -- N single-cell fused pieces (one
// per cell, each independently correct, unlike Stage 7's decoy) PLUS
// one "joined pair" fused piece spanning an ADJACENT pair of the N
// cells (which pair is actually adjacent varies per shape -- computed
// directly from the real cell coordinates, not assumed, since a bent
// chain's two end cells are NOT adjacent to each other even though
// they're both adjacent to the middle one). Unlike Stage 7, this is
// NOT a decoy/trap design -- every piece here is a genuine, always-
// correct way to make progress (matching Stage 5/6's own "more than
// one valid decomposition" spirit at 3-cell scale), so no
// group-partially-filled stuck states are the intended experience.
// Deliberately no loose pyramids at all, matching the direct
// instruction's own "singles" (whole-cell) framing, not raw per-void
// pieces.
//
// For N>2, also offers a "full" piece spanning ALL N cells at once --
// direct instruction (2026-09-04) generalizing the joined-pair pattern
// to its natural endpoint (a joined-pair already IS the full solution
// at N=2, which is why Stage 7 doesn't need a separate one) and
// retrofitted onto Stage 8-11 too ("maybe add this back to 3 piece
// level"). Every void gets a 'full' groupId alongside its own cell and
// (for the joined pair's own 2 cells) the joined-pair's groupId -- a
// void can belong to its cell's single, the joined pair (if it's one
// of that pair's own 2 cells), AND the full piece simultaneously, all
// independent thanks to `groupIds` already being an array.
//
// `joinedPairIndices` is optional (null for N=1 -- direct instruction
// 2026-09-04, "one RD to four RDs should be earliest stages... they are
// so simple": a genuine 1-cell stage needed a starting point below the
// existing 2-cell "Joined Pair" one, and there's no such thing as a
// joined PAIR spanning only one cell). Every other N-cell mechanic
// (interchangeable singles, the "full" piece past N=2) already
// generalizes down to N=1 for free: `includeFullPiece = n > 2` is
// already false there, and skipping the joined-pair block entirely just
// leaves the N independent singles -- for N=1, exactly one single, one
// cell, nothing else.
// N cubes chained together via a real, exact edge-only join -- the same
// two-axis offset (a full `scale` along each of two axes, so consecutive
// cubes share only the 1D edge where their corners meet, never a flush
// face) that Stage 2's own hand-built 2-cube decoy already uses. Cycling
// through axis pairs keeps a longer chain from reading as one boring
// straight diagonal. Every join is exact by construction -- no gap to
// patch, no tilt needed to sell it. See its call site for the direct
// instruction ("banknote forgery level, not monopoly money") this
// replaced a fudgier (oversized + randomly tilted) version of.
function cubeEdgeChainOffsets(n, scale) {
  const AXIS_PAIRS = [['x', 'y'], ['y', 'z'], ['z', 'x']];
  const offsets = [new THREE.Vector3(0, 0, 0)];
  for (let i = 1; i < n; i++) {
    const [a, b] = AXIS_PAIRS[(i - 1) % AXIS_PAIRS.length];
    const step = new THREE.Vector3();
    step[a] = scale;
    step[b] = scale;
    offsets.push(offsets[i - 1].clone().add(step));
  }
  const centroid = offsets.reduce((sum, p) => sum.add(p), new THREE.Vector3()).multiplyScalar(1 / offsets.length);
  return offsets.map((p) => p.clone().sub(centroid));
}

// A "wrong shape" decoy piece's own geometry -- direct instruction
// (2026-09-04, "some better decoys on new early stages... a cube for
// 1[cell]... other connections... etc", later "cubes can be among
// decoys at all levels"): a piece that LOOKS plausible (same rough
// size, same orange material) but is shaped wrong for every group in
// its own stage, so it can never actually seat anywhere -- distinct
// from Stage 2's own single-cell decoy (genuinely placeable, just a
// strategic trap). `decoyOption.cells` is another real N-cell lattice
// arrangement (typically a DIFFERENT enumerated shape than the calling
// stage's own target); `decoyOption.asCubes` renders that SAME
// arrangement in plain cubes instead of RDs -- a genuinely different
// primitive, not just a different topology. Factored out of
// `buildNCellStage` (2026-09-04) so `buildMoleculeStage` (below) can
// build its own 3 decoys from the exact same, already-proven
// construction rather than a second copy of this logic.
function buildDecoyGeometry(scale, decoyOption) {
  if (!decoyOption.cells) {
    return new THREE.BoxGeometry(scale, scale, scale);
  }
  if (decoyOption.asCubes) {
    // Cube decoys used to reuse the RD lattice's own cell positions
    // (right for the RD-rendered branch below, since that geometry
    // genuinely tiles at FCC neighbor spacing) -- but cubes DON'T tile
    // at that spacing, so the first version had to fake its way past
    // that: oversized 1.5x cubes to close a real raycast-missable hole
    // at a compact cluster's center, plus a small per-cube random tilt
    // "to look more plausible". Direct correction (2026-09-04): "make
    // the cubes look like they are really trying to pretend to be RDs
    // not just badly joined.. clean geometric shapes look right...
    // roughly joined looks bogus straight away we are going for
    // banknote forgery level not monopoly money level". A convincing
    // forgery is precise, not fudged -- so this now builds a genuinely
    // clean cube-native shape instead of forcing RD-spaced cubes to
    // fake it: `cubeEdgeChainOffsets` chains N cubes together with the
    // exact same edge-only join Stage 2's own 2-cube decoy already
    // uses (offset by a full `scale` along TWO axes, so consecutive
    // cubes share only the 1D edge where their corners meet, never a
    // flush face) -- every join is exact by construction, so there's
    // no gap to patch and nothing to tilt.
    const chainOffsets = cubeEdgeChainOffsets(decoyOption.cells.length, scale);
    return mergeGeometries(
      chainOffsets.map((offset) => new THREE.BoxGeometry(scale, scale, scale).translate(offset.x, offset.y, offset.z)),
      false,
    );
  }
  // The RD-rendered branch: an actual different real N-cell lattice
  // arrangement, rendered in genuine RD geometry -- this already tiles
  // cleanly at FCC neighbor spacing, so it needs none of the cube
  // branch's own fakery above.
  // Centered on the DECOY shape's own centroid, not the calling stage's
  // target centroid -- the two are different real shapes and can have
  // different centroids, so reusing the target's would leave the decoy
  // mesh visually off-center within its own bounding volume (its local
  // origin not at its own visual middle).
  const decoyWorldPositions = decoyOption.cells.map(([cx, cy, cz]) => new THREE.Vector3(...cellToWorld(cx, cy, cz, scale)));
  const decoyCentroid = decoyWorldPositions.reduce((sum, p) => sum.add(p), new THREE.Vector3()).multiplyScalar(1 / decoyWorldPositions.length);
  return mergeGeometries(
    decoyWorldPositions.map((p) => rhombicDodecahedronGeometry(scale).translate(p.x - decoyCentroid.x, p.y - decoyCentroid.y, p.z - decoyCentroid.z)),
    false,
  );
}

// Shared tray layout for every multi-piece stage builder in this file
// -- lays pieces out in a roughly SQUARE grid of columns instead of one
// long vertical line, direct instruction (2026-09-04, "with multiple
// picker pieces more than one row makes sense spacewise... too many
// pieces in a line"): the tray camera frames its own content by
// DISTANCE alone (`main.js`'s own `applyTrayFraming`), so a long single
// column forces it to zoom out much further than a compact grid of the
// SAME pieces would need -- every piece ends up smaller and harder to
// tap precisely, not just visually cluttered. `columns` is
// `round(sqrt(pieceCount))` so the arrangement stays close to square
// regardless of how many pieces a given stage happens to have, rather
// than a fixed column count that would look fine for one stage and
// terrible for another. Replaces the identical (previously duplicated
// six times across this file) single-column `trayCursorY` cursor.
function createTrayLayout(scale, pieceCount) {
  const columns = Math.max(1, Math.round(Math.sqrt(pieceCount)));
  const perColumn = Math.ceil(pieceCount / columns);
  const TRAY_GAP = scale * 0.5;
  const singleRDGeometry = rhombicDodecahedronGeometry(scale);
  singleRDGeometry.computeBoundingSphere();
  const MAX_TRAY_RADIUS = singleRDGeometry.boundingSphere.radius * 2.2;
  // Every piece's own RENDERED (post-trayScale-cap) radius never exceeds
  // MAX_TRAY_RADIUS -- that's the whole point of the cap just below --
  // so a column only ever needs to be wide enough for the WORST case,
  // not each piece's own real (possibly much bigger) geometry. A fixed
  // `scale`-based gap here was the actual bug behind "too many pieces
  // in a line" persisting even after adding columns at all: it worked
  // fine for small pieces but was imperceptibly thin next to Big Hull's
  // own much larger merged chunks, once the tray camera had zoomed out
  // far enough to fit them -- the SAME absolute gap reads as a huge gap
  // up close and a rounding error from far away.
  const COLUMN_GAP = MAX_TRAY_RADIUS * 2 + TRAY_GAP;

  let placedCount = 0;
  let columnCursorY = 0;

  function trayScaleFor(geometry) {
    geometry.computeBoundingSphere();
    const radius = geometry.boundingSphere.radius;
    return radius > MAX_TRAY_RADIUS ? MAX_TRAY_RADIUS / radius : 1;
  }

  function nextTrayPosition(geometry, trayScale = 1) {
    geometry.computeBoundingSphere();
    const radius = geometry.boundingSphere.radius * trayScale;
    const columnIndex = Math.floor(placedCount / perColumn);
    if (placedCount % perColumn === 0) columnCursorY = 0;
    if (columnCursorY !== 0) columnCursorY -= TRAY_GAP;
    columnCursorY -= radius;
    const y = columnCursorY;
    columnCursorY -= radius;
    placedCount++;
    return new THREE.Vector3(scale * 4 + columnIndex * COLUMN_GAP, y, 0);
  }

  return { trayScaleFor, nextTrayPosition };
}

function buildNCellStage(scale, cellLatticeOffsets, joinedPairIndices, decoyOption) {
  const skeletonGroup = new THREE.Group();
  const pyramid = pyramidGeometry(scale);
  const n = cellLatticeOffsets.length;

  const cellWorldPositions = cellLatticeOffsets.map(([cx, cy, cz]) => new THREE.Vector3(...cellToWorld(cx, cy, cz, scale)));
  const centroid = cellWorldPositions.reduce((sum, p) => sum.add(p), new THREE.Vector3()).multiplyScalar(1 / n);
  const cellCenters = cellWorldPositions.map((p) => p.clone().sub(centroid));

  const hasJoinedPair = Array.isArray(joinedPairIndices);
  const [ji, jj] = hasJoinedPair ? joinedPairIndices : [null, null];
  const joinedGroupId = hasJoinedPair ? `joined-${ji}${jj}` : null;
  const includeFullPiece = n > 2;

  const voids = [];
  cellCenters.forEach((cellCenter, cellIndex) => {
    const cellGroupId = `cell-${cellIndex}`;
    const groupIds = [cellGroupId];
    if (hasJoinedPair && (cellIndex === ji || cellIndex === jj)) groupIds.push(joinedGroupId);
    if (includeFullPiece) groupIds.push('full');
    skeletonGroup.add(makeOuterSolid(rhombicDodecahedronGeometry(scale), cellCenter));
    PYRAMID_AXES.forEach((axisKey) => {
      const facePosition = cellCenter.clone().add(AXIS_NORMALS[axisKey].clone().multiplyScalar(scale / 2));
      [['in', inwardQuaternion], ['out', outwardQuaternion]].forEach(([dirLabel, toQuaternion]) => {
        const v = makeVoid(pyramid, {
          id: `v-${cellGroupId}-${dirLabel}-${axisKey}`,
          quaternion: toQuaternion(axisKey),
          position: facePosition,
          groupIds,
        });
        skeletonGroup.add(...v.sceneObjects);
        voids.push(v);
      });
    });
  });

  const groups = cellCenters.map((center, i) => ({ id: `cell-${i}`, position: center.clone(), quaternion: new THREE.Quaternion() }));
  // The joined piece's own merged geometry already bakes in both
  // lobes' correct relative offset (each translated to its own
  // cellCenter, already expressed relative to the whole shape's
  // centroid-origin before merging) -- same reasoning as Stage 7's own
  // 'joined-01' group, so this snaps to the shared origin, not a
  // midpoint.
  if (hasJoinedPair) groups.push({ id: joinedGroupId, position: ORIGIN, quaternion: new THREE.Quaternion() });
  if (includeFullPiece) groups.push({ id: 'full', position: ORIGIN, quaternion: new THREE.Quaternion() });

  // Real live bug (2026-09-04, "picker tray pieces are overlapping each
  // other"): a fixed per-slot spacing (the old `homeSpacing * i`) is
  // correct for N single-RD-sized pieces, but the joined-pair and full
  // pieces are physically BIGGER (2 or N cells' worth of merged
  // geometry) -- at that same fixed spacing they visibly overlapped
  // both each other and the single above them (confirmed live,
  // screenshotted: N=4's tray showed a single crammed blob for its
  // last 2-3 slots). Fixed by laying out the tray with each piece's
  // OWN real bounding-sphere radius: track a running Y cursor, moving
  // it down by the previous piece's own half-height, a fixed gap, and
  // the next piece's own half-height before placing it -- correct
  // regardless of how much bigger the fused pieces get as N grows,
  // not a per-shape magic number.
  //
  // Second real live bug, found immediately after fixing the first:
  // Stage 15 (Straight Line) rendered as an entirely blank screen. Root
  // cause: `boundingRadiusFromOrigin` (main.js) frames the camera from
  // the FARTHEST point across skeleton AND every tray piece combined --
  // a straight 4-cell chain's own "full" piece spans real lattice
  // distance ~4.24 (its two end cells are the single farthest-apart
  // pair of any real N=4 shape, see cell-arrangements.js's own
  // Straight Line writeup), so its merged geometry's own bounding
  // sphere is dramatically bigger than a single RD's -- big enough,
  // positioned deep in the tray, to force the derived camera distance
  // out so far the actual target shape shrank to a few sub-pixel
  // specks. Fixed by CAPPING a merged tray piece's visual size
  // (`trayScale`, applied as a real THREE.Object3D.scale, reset to 1
  // the moment it's actually placed into the assembled shape --
  // main.js's own placement/undo-resync code) rather than restructuring
  // the shared camera framing -- ordinary 2-cell joined pairs and
  // compact N=4 "full" pieces (Tetrahedron/Ring/Star) stay full scale
  // (comfortably under the cap), only a genuinely oversized piece like
  // Straight Line's own full piece gets visually shrunk in the tray.
  // Every single here is a geometrically identical whole-RD piece --
  // direct instruction (2026-09-04, "doesn't make sense in real world"):
  // a plain, unmarked single cell should fit ANY open single-cell void,
  // not just the ONE cell it happened to be assigned at build time, the
  // same "identical pieces are interchangeable" property Stage 3's cube
  // pieces already have. ANY_SINGLE_CELL_GROUP (puzzle-state.js) makes
  // placeSelected()/voidValidityForPiece() resolve the ACTUAL target
  // group from whichever void gets tapped, instead of a group id fixed
  // on the piece.
  //
  // Every real piece is first collected as a {id, fillsGroup, geometry}
  // SPEC, not built/positioned immediately -- `decoyOption` (below)
  // needs to splice a decoy spec in at an arbitrary point in this same
  // list BEFORE tray positions get assigned, so the decoy gets real
  // spacing from `nextTrayPosition()` like every other piece instead of
  // needing its own hand-placed coordinates.
  const pieceSpecs = [];
  // The N singles are collected as ONE group entry, not N separate
  // pieceSpecs -- direct instruction (2026-09-04, "really dont want four
  // single RDs in a row taking up space in picker tray"): since they're
  // all the exact same interchangeable shape (see above), there's no
  // reason each one needs its OWN tray slot. `isSingleGroup` marks this
  // entry for the tray-position pass below to hand out ONE shared
  // homePosition to every single it contains, instead of the normal one-
  // slot-per-spec layout -- main.js's own revealNextTrayPiece() then
  // shows only one of them at a time in that shared slot, the same "one
  // at a time" queue it already runs for loose (non-fused) pieces.
  if (n > 0) {
    const singleSpecs = [];
    for (let i = 0; i < n; i++) {
      singleSpecs.push({ id: `single-${i}`, fillsGroup: ANY_SINGLE_CELL_GROUP, geometry: rhombicDodecahedronGeometry(scale) });
    }
    pieceSpecs.push({ isSingleGroup: true, specs: singleSpecs });
  }

  if (hasJoinedPair) {
    const joinedGeometry = mergeGeometries(
      [ji, jj].map((idx) => rhombicDodecahedronGeometry(scale).translate(cellCenters[idx].x, cellCenters[idx].y, cellCenters[idx].z)),
      false,
    );
    pieceSpecs.push({ id: 'joined-pair', fillsGroup: joinedGroupId, geometry: joinedGeometry });
  }

  if (includeFullPiece) {
    const fullGeometry = mergeGeometries(
      cellCenters.map((center) => rhombicDodecahedronGeometry(scale).translate(center.x, center.y, center.z)),
      false,
    );
    pieceSpecs.push({ id: 'full', fillsGroup: 'full', geometry: fullGeometry });
  }

  // A "wrong shape" decoy -- see `buildDecoyGeometry`'s own comment for
  // the construction detail. Where it lands in the tray is decided
  // below, by a real per-load shuffle of the WHOLE piece order (not
  // just the decoy's own slot -- see that shuffle's own comment for why).
  if (decoyOption) {
    pieceSpecs.push({ id: 'decoy', fillsGroup: DECOY_NEVER_MATCHES, geometry: buildDecoyGeometry(scale, decoyOption) });
  }

  // Real shuffle of the WHOLE tray order, every load -- direct
  // instruction (2026-09-04, "there still seems to be a lot of the
  // right answers is the last piece"): varying only the decoy's own
  // slot (the previous approach) left the underlying real-piece order
  // fixed every time (singles, then joined-pair, then "full" always
  // built last) -- "full" alone solves the whole stage in one tap, so
  // it staying predictably near the end was exactly the same learnable-
  // shortcut problem in a different piece. A genuine per-load
  // Fisher-Yates (not just a hand-picked-but-fixed order per stage)
  // means even replaying the SAME stage repeatedly never lets a
  // position-based shortcut form at all.
  for (let i = pieceSpecs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pieceSpecs[i], pieceSpecs[j]] = [pieceSpecs[j], pieceSpecs[i]];
  }

  const { trayScaleFor, nextTrayPosition } = createTrayLayout(scale, pieceSpecs.length);
  const pieces = [];
  for (const spec of pieceSpecs) {
    if (spec.isSingleGroup) {
      // One shared homePosition for the whole group -- the tray cursor
      // only advances once here, not once per single, which is the
      // actual space saving (main.js only ever shows one at a time in
      // it regardless, but a shared slot is what lets the OTHER pieces
      // below it in the shuffled order sit right underneath instead of
      // leaving dead space where the hidden singles would have been).
      const representativeGeometry = spec.specs[0].geometry;
      const trayScale = trayScaleFor(representativeGeometry);
      const homePosition = nextTrayPosition(representativeGeometry, trayScale);
      for (const single of spec.specs) {
        pieces.push(makeFusedPiece(single.geometry, {
          id: single.id,
          fillsGroup: single.fillsGroup,
          homePosition: homePosition.clone(),
          trayScale,
        }));
      }
    } else {
      const trayScale = trayScaleFor(spec.geometry);
      pieces.push(makeFusedPiece(spec.geometry, {
        id: spec.id,
        fillsGroup: spec.fillsGroup,
        homePosition: nextTrayPosition(spec.geometry, trayScale),
        trayScale,
      }));
    }
  }

  return {
    skeletonGroup,
    pieces,
    voids,
    groups,
    hideIdleVoidWires: true,
  };
}

// The 4 real N=3 shapes -- ACTUALLY called from enumerateShapes(3),
// not a hand-copied snapshot of its output (a real bug, caught live
// 2026-09-04, "you havent wired enumerator": the import existed but
// was never called, so this array was a frozen literal that would have
// silently drifted from the real generator the moment its internals
// ever changed). Each shape's own adjacent joined-pair indices are
// computed directly from its real cell coordinates (a bent chain's two
// END cells are NOT adjacent to each other even though both are
// adjacent to the middle one, so "any two of three" is never a safe
// default) rather than hardcoded per shape.
const NEIGHBOR_OFFSET_KEYS = new Set(NEIGHBOR_OFFSETS.map((v) => v.join(',')));

// Classifies a shape by its REAL geometric hinge angle, not an
// indirect proxy like raw max pairwise distance -- direct live
// correction (2026-09-04, "you missed right angle bend as option"):
// the original distance-based naming called the LARGER-max-distance
// shape "Wide Bend", which happens to be the 90-degree right-angle
// bend -- a name that gave no hint it was a right angle at all, while
// the real 120-degree (genuinely wider) bend was called "Narrow".
// Verified directly (this file's own hand-computed angles, cross-
// checked against cell-arrangements.js's own hand-built-shape tests):
// 60 degrees (Triangle, its own real internal angle -- every cell
// qualifies as "the hinge" since all three are mutually adjacent), 90
// degrees (a genuine right angle), 120 degrees (a wider, more open
// bend), 180 degrees (Straight Line, no bend at all). All 4 real N=3
// shapes were always correctly enumerated and built (direct
// instruction "all 4" was already fulfilled) -- this only fixes what
// they're CALLED.
const THREE_CELL_SIGNATURES = [
  { name: 'Triangle', angle: 60 },
  { name: 'Right-Angle Bend', angle: 90 },
  { name: 'Wide Bend', angle: 120 },
  { name: 'Straight Line', angle: 180 },
];

function threeCellHingeAngle(cells) {
  // The hinge is whichever cell is adjacent to BOTH others -- for a
  // closed triangle every cell qualifies (any one gives the triangle's
  // own real 60-degree internal angle); for an open chain exactly one
  // does (the other two, its "ends", are adjacent to the hinge but not
  // to each other).
  for (let hinge = 0; hinge < cells.length; hinge++) {
    const others = [0, 1, 2].filter((i) => i !== hinge);
    const isAdjacentToHinge = (i) => {
      const d = [cells[i][0] - cells[hinge][0], cells[i][1] - cells[hinge][1], cells[i][2] - cells[hinge][2]];
      return NEIGHBOR_OFFSET_KEYS.has(d.join(','));
    };
    if (others.every(isAdjacentToHinge)) {
      const [a, b] = others;
      const va = [cells[a][0] - cells[hinge][0], cells[a][1] - cells[hinge][1], cells[a][2] - cells[hinge][2]];
      const vb = [cells[b][0] - cells[hinge][0], cells[b][1] - cells[hinge][1], cells[b][2] - cells[hinge][2]];
      const dot = va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2];
      const magA = Math.hypot(...va);
      const magB = Math.hypot(...vb);
      return Math.acos(dot / (magA * magB)) * (180 / Math.PI);
    }
  }
  throw new Error('No hinge cell found -- shape is not actually connected');
}

function classifyThreeCellShape(cells) {
  const angle = threeCellHingeAngle(cells);
  const match = THREE_CELL_SIGNATURES.find((s) => Math.abs(s.angle - angle) < 0.5);
  if (!match) throw new Error(`Unrecognized 3-cell shape: hinge angle ${angle}`);
  return match.name;
}

function findAdjacentCellPair(cells) {
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) {
      const d = [cells[j][0] - cells[i][0], cells[j][1] - cells[i][1], cells[j][2] - cells[i][2]];
      if (NEIGHBOR_OFFSET_KEYS.has(d.join(','))) return [i, j];
    }
  }
  throw new Error('No adjacent cell pair found -- shape is not actually connected');
}

// Topological signature of a shape (independent of which stage size
// it's used for): edgeCount (how many of the possible cell pairs are
// actually lattice-adjacent), degrees (each cell's own adjacency count
// within the shape, sorted descending -- distinguishes e.g. a 3-edge
// chain [2,2,1,1] from a 3-edge star [3,1,1,1], same edge count but a
// genuinely different branching structure), and maxDistance (the
// farthest apart any two cells in the shape are -- a straight chain
// always maximizes this for its own cell count).
function shapeTopology(cells) {
  const n = cells.length;
  const degrees = new Array(n).fill(0);
  let edgeCount = 0;
  let maxDistance = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = [cells[j][0] - cells[i][0], cells[j][1] - cells[i][1], cells[j][2] - cells[i][2]];
      maxDistance = Math.max(maxDistance, Math.hypot(...d));
      if (NEIGHBOR_OFFSET_KEYS.has(d.join(','))) { degrees[i]++; degrees[j]++; edgeCount++; }
    }
  }
  return { edgeCount, degrees: [...degrees].sort((a, b) => b - a), maxDistance };
}

// The genuine start of the whole-RD progression -- direct instruction
// (2026-09-04, "one RD to four RDs should be earliest stages... they
// are so simple", reinforced: "knowing that the cube and RD can be
// composed from pyramids is advanced knowledge... so broken down single
// shapes belong at higher levels... but prior to multiple shape
// interactions yet to come"). One cell, one always-correct single, tap
// to place -- `buildNCellStage`'s own n=1 generalization (see its
// header comment) makes this a real, not special-cased, instance of the
// exact same N-cell mechanic every later whole-RD stage uses, not a
// bespoke builder.
// A single decoy cube -- direct instruction (2026-09-04, "some better
// decoys on new early stages... a cube for 1[cell]"). No `cells` key on
// the decoy option at all (buildNCellStage's own decoy branch falls
// back to a plain BoxGeometry when there's none) -- an N=1 stage has no
// OTHER real 1-cell shape to borrow as a decoy the way N>=2 stages can,
// so a genuinely different primitive (a cube, not an RD) is the natural
// "wrong shape" here instead.
const ONE_CELL_STAGE = {
  id: 1,
  name: '1 Cell: One RD',
  build: (scale) => buildNCellStage(scale, [[0, 0, 0]], null, {}),
};

// One real call, reused for every N this file needs (3, 4, 5) -- each
// separate `enumerateShapes(k)` call used to redundantly recompute
// every smaller N from scratch (BFS grows N=1 -> N=2 -> ... -> N=k), so
// calling it three times at N=3/4/5 separately would redo N=1-3's work
// twice over and N=1-4's work again for N=5. `enumerateShapes(5)`
// already returns every smaller N's own list too.
const ALL_ENUMERATED_SHAPES = enumerateShapes(5);

const THREE_CELL_STAGE_DEFS = ALL_ENUMERATED_SHAPES[3].map((shape) => ({
  name: classifyThreeCellShape(shape.cells),
  cells: shape.cells,
  joinedPair: findAdjacentCellPair(shape.cells),
}));

const THREE_CELL_STAGES = THREE_CELL_STAGE_DEFS.map((def, i) => {
  // Another of the SAME real N=3 shapes, never this stage's own --
  // direct instruction ("other connections of 2 for 2... etc",
  // generalized past N=2). Genuinely plausible at a glance (same cell
  // count, a real enumerated shape, not an arbitrary blob) but the
  // wrong overall geometry, so DECOY_NEVER_MATCHES correctly rejects it
  // everywhere in THIS stage's own skeleton.
  const decoyDef = THREE_CELL_STAGE_DEFS[(i + 1) % THREE_CELL_STAGE_DEFS.length];
  return {
    // Starts at 7, right after COLOR_MATCH_STAGES' own block (3-6) below
    // it -- direct instruction (2026-09-05): first tried interleaving
    // pairs (color-match, plain, color-match, plain...), corrected --
    // "it should be in group before non colored if its individual it
    // ruins the non colored playing" -- one full group before the
    // other, not pairwise, so the uncolored tier still plays as its own
    // coherent set once a player reaches it.
    id: 7 + i,
    name: `3 Cells: ${def.name}`,
    // Alternates RD-shaped vs. cube-shaped decoys across the 4 stages
    // (direct instruction, "cubes can be among decoys at all levels")
    // rather than every stage using the same kind. Where it lands in
    // the tray is a per-load shuffle (buildNCellStage's own), not
    // fixed here.
    build: (scale) => buildNCellStage(scale, def.cells, def.joinedPair, {
      cells: decoyDef.cells,
      asCubes: i % 2 === 1,
    }),
  };
});

// A CURATED subset of the 20 real N=4 shapes, not all of them (direct
// instruction 2026-09-04: N=3's "all 4" doesn't scale the same way to
// N=4's 20 -- start with a handful of genuinely distinct topologies,
// not every one). Each pick is selected from the real
// `enumerateShapes(4)[4]` output by its own verified topological
// signature (`shapeTopology`), never a hardcoded cell list -- same
// "wire it for real" fix this file's own N=3 section needed earlier
// the same day. Picks span structures that don't even exist at N=3:
// Tetrahedron (every cell mutually adjacent -- the maximally compact
// case, FCC's real N=4 analog of N=3's own triangle), Ring (a closed
// 4-cycle, every cell degree 2, no "ends" at all -- topologically
// impossible with only 3 cells), Star (one cell adjacent to the other
// 3, which aren't adjacent to each other -- a branching tripod, also
// impossible at N=3, since that needs a degree-3 cell), and Straight
// Line (the single shape with the greatest possible cell-to-cell
// distance for N=4, direct continuation of the N=3 pattern).
const fourCellShapesRaw = ALL_ENUMERATED_SHAPES[4];
function pickFourCellShape(matchSignature, tiebreakSmallestDistance) {
  const matches = fourCellShapesRaw.filter((s) => matchSignature(shapeTopology(s.cells)));
  if (matches.length === 0) throw new Error('No N=4 shape matched the requested signature');
  if (matches.length === 1 || tiebreakSmallestDistance === undefined) return matches[0];
  return matches.reduce((best, s) => {
    const bestDist = shapeTopology(best.cells).maxDistance;
    const sDist = shapeTopology(s.cells).maxDistance;
    return (tiebreakSmallestDistance ? sDist < bestDist : sDist > bestDist) ? s : best;
  });
}

const FOUR_CELL_STAGE_DEFS = [
  { name: 'Tetrahedron', shape: pickFourCellShape((t) => t.edgeCount === 6) },
  { name: 'Ring', shape: pickFourCellShape((t) => t.edgeCount === 4 && t.degrees.every((d) => d === 2)) },
  { name: 'Star', shape: pickFourCellShape((t) => t.edgeCount === 3 && t.degrees[0] === 3, true) },
  { name: 'Straight Line', shape: pickFourCellShape((t) => t.edgeCount === 3 && t.degrees[0] === 2, false) },
].map(({ name, shape }) => ({
  name,
  cells: shape.cells,
  joinedPair: findAdjacentCellPair(shape.cells),
}));

const FOUR_CELL_STAGES = FOUR_CELL_STAGE_DEFS.map((def, i) => {
  // Another of the SAME 4 curated N=4 shapes, never this stage's own --
  // same "other connections... etc" reasoning as the N=3 tier.
  const decoyDef = FOUR_CELL_STAGE_DEFS[(i + 1) % FOUR_CELL_STAGE_DEFS.length];
  return {
    id: 11 + i,
    name: `4 Cells: ${def.name}`,
    // Opposite parity from the N=3 tier's own alternation, purely so
    // the SAME cube-vs-RD pattern doesn't repeat identically stage-
    // after-stage across the two tiers. Where it lands in the tray is
    // a per-load shuffle (buildNCellStage's own), not fixed here.
    build: (scale) => buildNCellStage(scale, def.cells, def.joinedPair, {
      cells: decoyDef.cells,
      asCubes: i % 2 === 0,
    }),
  };
});

// Color Match -- 2026-09-05, direct instruction ("color coding
// assistance to make duplicates of existing levels", confirmed via
// AskUserQuestion: a real new stage, not a UI toggle on old ones) plus
// a follow-up ("there could also be generic additional content
// generated by the color content") and a sequencing correction
// ("color coded should be inserted earlier" -- these are meant as
// EASIER, assistive duplicates, so they belong right after the basic
// whole-RD tier they duplicate, not appended after the hardest content
// in the game; every id from here through the BCC tier was genuinely
// renumbered +4 to make room, the same "id and array position move
// together" discipline the project's own earlier resequencing already
// established).
//
// Real duplicates of THREE_CELL_STAGE_DEFS's own 4 shapes (Triangle,
// Right-Angle Bend, Wide Bend, Straight Line -- ids 3-6), same real
// geometry, same real cells -- but every cell gets its own distinct,
// non-interchangeable color, on BOTH the piece AND the skeleton region
// it belongs to (not just the piece -- the whole point is the player
// can SEE which colored region needs which colored piece before ever
// touching anything, the actual "assist"). This genuinely changes the
// puzzle logic, not just the paint: ids 3-6's own pieces are
// interchangeable-by-shape (any single RD fits any open cell, no real
// spatial reasoning needed once the last valid slot is obvious); here
// each piece's `fillsGroup` is a real per-cell id, so the ONLY way to
// solve it is by matching color, a genuinely different (and for a new
// player, easier/more legible) kind of reasoning than orientation-
// matching or shape-matching. Palette deliberately avoids this file's
// own feedback colors (REJECT_FLASH_COLOR's red, VALID_TARGET_COLOR's
// green, both main.js) so a piece's own identity color is never
// confusable with an accept/reject flash.
const COLOR_MATCH_PALETTE = [0x4a90e2, 0xf5a623, 0x9013fe, 0x2ecc71, 0xe91e8c, 0x1abc9c];

function buildColorMatchStage(scale, cellOffsets, decoyOption, decoyColor) {
  const skeletonGroup = new THREE.Group();
  const rdGeometry = rhombicDodecahedronGeometry(scale);

  const cellWorldPositions = cellOffsets.map(([cx, cy, cz]) => new THREE.Vector3(...cellToWorld(cx, cy, cz, scale)));
  const centroid = cellWorldPositions.reduce((sum, p) => sum.add(p), new THREE.Vector3()).multiplyScalar(1 / cellWorldPositions.length);
  const cellCenters = cellWorldPositions.map((p) => p.clone().sub(centroid));

  const voids = [];
  cellCenters.forEach((cellCenter, i) => {
    skeletonGroup.add(makeOuterSolid(rdGeometry, cellCenter, COLOR_MATCH_PALETTE[i]));
    const v = makeVoid(rdGeometry, { id: `v-cell-${i}`, position: cellCenter, groupIds: [`cell-${i}`] });
    skeletonGroup.add(...v.sceneObjects);
    voids.push(v);
  });

  const groups = cellCenters.map((center, i) => ({ id: `cell-${i}`, position: center.clone(), quaternion: new THREE.Quaternion() }));
  const pieceSpecs = cellCenters.map((_, i) => ({ id: `single-${i}`, fillsGroup: `cell-${i}`, geometry: rdGeometry, color: COLOR_MATCH_PALETTE[i] }));

  // Real decoy, same buildDecoyGeometry every other tier already uses
  // -- direct instruction (2026-09-05, "change decoys on colored
  // version to vary between two sets"): the color-match tier shipped
  // with no decoys at all, unlike everywhere else in the game. Reuses
  // THREE_CELL_STAGES' own alternating pattern (asCubes on odd stages)
  // so the two decoy "sets" (RD-shaped, cube-shaped) both show up
  // across the 4 stages, not just one kind.
  //
  // Follow-up direct instruction: "decoys should be colored too just
  // dont want to ruin non colored by making exactly same pattern" --
  // `decoyColor` is always drawn from a PALETTE SLOT this stage's own
  // real cells never use (see COLOR_MATCH_STAGES' own call site), never
  // computed by hand per-stage -- guarantees a real color, genuinely
  // impossible to collide with any of the real per-cell colors here,
  // without needing to track "which colors are already taken" as a
  // fragile parallel calculation.
  if (decoyOption) {
    pieceSpecs.push({ id: 'decoy-0', fillsGroup: DECOY_NEVER_MATCHES, geometry: buildDecoyGeometry(scale, decoyOption), color: decoyColor });
  }

  for (let i = pieceSpecs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pieceSpecs[i], pieceSpecs[j]] = [pieceSpecs[j], pieceSpecs[i]];
  }

  const { trayScaleFor, nextTrayPosition } = createTrayLayout(scale, pieceSpecs.length);
  const pieces = pieceSpecs.map((spec) => {
    const trayScale = trayScaleFor(spec.geometry);
    return makeFusedPiece(spec.geometry, {
      id: spec.id,
      fillsGroup: spec.fillsGroup,
      homePosition: nextTrayPosition(spec.geometry, trayScale),
      trayScale,
      color: spec.color,
    });
  });

  // Real bug caught live (2026-09-05, "the multicolor early stage was
  // really confusing as colors were switching to green and red as well
  // as having their own colors too"): `makeVoid`'s own `wire` ghost is
  // a SEPARATE mesh at the exact same position as this stage's own
  // per-cell palette tint, and main.js's refreshVoidHighlights()
  // unconditionally recolors it green/red the moment a piece is
  // selected -- stacking a generic validity color directly on top of
  // the real identity color, AND (worse) instantly revealing the one
  // correct void regardless of which piece you picked, defeating the
  // entire point of matching by color in the first place.
  // `suppressValidityHighlight` (main.js) makes refreshVoidHighlights()
  // treat every void as idle always, so ONLY this stage's own palette
  // tint ever shows -- real color-matching, not a green-light shortcut.
  return { skeletonGroup, pieces, voids, groups, hideIdleVoidWires: true, suppressValidityHighlight: true };
}

const COLOR_MATCH_STAGES = THREE_CELL_STAGE_DEFS.map((def, i) => {
  const decoyDef = THREE_CELL_STAGE_DEFS[(i + 1) % THREE_CELL_STAGE_DEFS.length];
  // Every real cell here uses COLOR_MATCH_PALETTE[0..2] (def.cells.length
  // is always 3 for this catalog) -- the decoy's own color is drawn from
  // [3..5] instead, a palette slot genuinely never assigned to a real
  // piece in THIS stage, cycling across the 4 stages for real variety
  // rather than reusing one fixed decoy color everywhere.
  const decoyColor = COLOR_MATCH_PALETTE[def.cells.length + (i % (COLOR_MATCH_PALETTE.length - def.cells.length))];
  return {
    id: 3 + i,
    name: `Color Match: ${def.name}`,
    derivedFrom: [{ id: 7 + i, tier: def.name }],
    build: (scale) => buildColorMatchStage(scale, def.cells, { cells: decoyDef.cells, asCubes: i % 2 === 0 }, decoyColor),
  };
});

// Hulls -- direct instruction (2026-09-04, after playing through
// Molecules on a real phone, "no complaints so far... enjoyable but
// challenging" then "minimal hulls and skeletons of geometric solids
// broken into 3 with 4 minimally different decoys"), confirmed via
// AskUserQuestion: NOT two different shapes joined (that's Molecules)
// -- ONE compact 5-cell whole-RD shape, split into 3 real sub-pieces
// that reassemble it exactly.
//
// Splits a shape's own N=5 cells into two disjoint adjacent PAIRS and
// one leftover single cell -- the only way to split 5 cells into
// exactly 3 non-empty pieces without a group of 3+ (5 = 2+2+1 is the
// sole option; 3+1+1 would leave two singles, worse for "no singles as
// a general rule"). Finds two disjoint edges in the shape's own
// adjacency graph (an "edge" = two cells that are real FCC neighbors);
// not every 5-cell shape has two disjoint edges (e.g., one hub cell
// adjacent to all 4 others, none of which are adjacent to each other)
// -- `FIVE_CELL_HULL_DEFS` below filters those out rather than force an
// invalid split.
function partitionIntoTwoPairsAndSingle(cells) {
  const edges = [];
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) {
      const d = [cells[j][0] - cells[i][0], cells[j][1] - cells[i][1], cells[j][2] - cells[i][2]];
      if (NEIGHBOR_OFFSET_KEYS.has(d.join(','))) edges.push([i, j]);
    }
  }
  for (let e1 = 0; e1 < edges.length; e1++) {
    for (let e2 = e1 + 1; e2 < edges.length; e2++) {
      const [a, b] = edges[e1];
      const [c, d] = edges[e2];
      if (a !== c && a !== d && b !== c && b !== d) {
        const used = new Set([a, b, c, d]);
        const singleIdx = cells.findIndex((_, i) => !used.has(i));
        return { pairA: [cells[a], cells[b]], pairB: [cells[c], cells[d]], single: cells[singleIdx] };
      }
    }
  }
  return null;
}

// Same real-shape-signature curation this file already uses for N=3/4
// (edge count + sorted degree sequence -- ignores absolute position/
// orientation, only real graph topology), applied to N=5 -- one
// representative per DISTINCT topology among the shapes that actually
// admit a 2-pair-plus-single split, computed for real from
// `ALL_ENUMERATED_SHAPES[5]` (not a hardcoded literal -- this file's
// own git history already has one real bug from doing that the first
// time, see THREE_CELL_STAGE_DEFS's own comment above). 13 real,
// topologically distinct 5-cell hulls came out of this.
function fiveCellShapeSignature(cells) {
  const degrees = cells.map(() => 0);
  let edgeCount = 0;
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) {
      const d = [cells[j][0] - cells[i][0], cells[j][1] - cells[i][1], cells[j][2] - cells[i][2]];
      if (NEIGHBOR_OFFSET_KEYS.has(d.join(','))) { degrees[i]++; degrees[j]++; edgeCount++; }
    }
  }
  return `${edgeCount}:${degrees.slice().sort((a, b) => b - a).join('')}`;
}

const FIVE_CELL_HULL_DEFS = (() => {
  const bySignature = new Map();
  for (const shape of ALL_ENUMERATED_SHAPES[5]) {
    const partition = partitionIntoTwoPairsAndSingle(shape.cells);
    if (!partition) continue;
    const signature = fiveCellShapeSignature(shape.cells);
    if (!bySignature.has(signature)) bySignature.set(signature, { cells: shape.cells, partition });
  }
  return [...bySignature.values()];
})();

// A real CHIRAL 5-cell shape -- direct instruction (2026-09-04,
// "mirrored molecules split it into 3 with 3 decoys"): a molecule whose
// two lobes are genuine mirror images of each other only means anything
// if some real shape's mirror image ISN'T reachable by rotating it (a
// piece can only be physically ROTATED into place, never reflected
// through a mirror -- see `geometry.js`'s own Disphenoid comment for
// the same reasoning applied to a single piece's own symmetry).
// Checked numerically before building anything (not assumed): NONE of
// the N=3 or N=4 catalog shapes this file already uses are chiral (0
// of 4, 0 of 20 -- every one of them IS superimposable on its own
// mirror via pure rotation, so mirroring any of them would produce
// nothing new), but 8 of the 131 real N=5 shapes ARE genuinely chiral.
// `permutationParity`/`properSymmetryOperations` mirror
// `geometry.js`'s own disphenoid math (the 24 determinant-+1 operations
// are real rotations; the other 24 are reflections a physical piece
// can't use) -- reused here rather than re-derived a third way.
function properSymmetryOperations() {
  return SYMMETRY_OPERATIONS.filter(
    (op) => permutationParity(op.perm) * op.signs[0] * op.signs[1] * op.signs[2] === 1,
  );
}
function permutationParity(perm) {
  let inversions = 0;
  for (let i = 0; i < perm.length; i++) {
    for (let j = i + 1; j < perm.length; j++) {
      if (perm[i] > perm[j]) inversions++;
    }
  }
  return inversions % 2 === 0 ? 1 : -1;
}
function canonicalCellsUnder(cells, ops) {
  let best = null;
  for (const op of ops) {
    const transformed = cells.map((c) => applySymmetry(op, c));
    // Numeric sort first to find a stable translation-reference corner,
    // THEN a second lexicographic sort of the translated cells' own
    // string keys -- numeric tuple order and string order disagree for
    // negative/multi-digit coordinates (e.g. "-1,0,0" vs "2,0,0" sorts
    // opposite ways numerically vs lexicographically), so skipping this
    // second sort silently produces a non-canonical, inconsistent key
    // (a real bug caught immediately: a first version without it made
    // `isChiralShape` never match anything, `.find()` returning
    // `undefined`, straight to a page-load crash).
    const numericSorted = [...transformed].sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
    const [ox, oy, oz] = numericSorted[0];
    const key = transformed
      .map(([x, y, z]) => `${x - ox},${y - oy},${z - oz}`)
      .sort()
      .join('|');
    if (best === null || key < best) best = key;
  }
  return best;
}
function isChiralShape(cells) {
  return canonicalCellsUnder(cells, SYMMETRY_OPERATIONS) !== canonicalCellsUnder(cells, properSymmetryOperations());
}
function mirrorCells(cells) {
  return cells.map(([x, y, z]) => [-x, y, z]);
}
// All 8 real chiral N=5 shapes, deduped so each mirror-PAIR (a shape and
// its own reflection) only ever contributes ONE entry -- checked
// numerically: none of the 8 happen to be each other's own mirror image
// (comparing canonical forms under PROPER rotation only), so all 8
// genuinely distinct, no dedup actually needed to fire this session,
// but kept as a real check rather than an assumption for whenever the
// enumerator or this list's own basis ever changes. Direct instruction
// (2026-09-04, "I thought the molecule mirroring etc would generate
// more variants...?"): 8 real chiral shapes means 8 real Mirrored
// Molecule stages, not one hand-picked example.
const CHIRAL_FIVE_CELL_SHAPES = (() => {
  const chosen = [];
  for (const shape of ALL_ENUMERATED_SHAPES[5]) {
    if (!isChiralShape(shape.cells)) continue;
    const alreadyCounted = chosen.some((prev) => {
      const key = (c) => canonicalCellsUnder(c, properSymmetryOperations());
      return key(prev) === key(shape.cells) || key(prev) === key(mirrorCells(shape.cells));
    });
    if (!alreadyCounted) chosen.push(shape.cells);
  }
  return chosen;
})();

function buildHullSplitStage(scale, hullDef) {
  const skeletonGroup = new THREE.Group();
  const pyramid = pyramidGeometry(scale);
  const { pairA, pairB, single } = hullDef.partition;

  const cellWorldPositions = hullDef.cells.map(([cx, cy, cz]) => new THREE.Vector3(...cellToWorld(cx, cy, cz, scale)));
  const centroid = cellWorldPositions.reduce((sum, p) => sum.add(p), new THREE.Vector3()).multiplyScalar(1 / cellWorldPositions.length);
  const cellIndexByKey = new Map(hullDef.cells.map((c, i) => [c.join(','), i]));
  const centerFor = (cell) => cellWorldPositions[cellIndexByKey.get(cell.join(','))].clone().sub(centroid);

  const chunks = [
    { groupId: 'chunk-a', cells: pairA },
    { groupId: 'chunk-b', cells: pairB },
    { groupId: 'chunk-c', cells: [single] },
  ];

  const voids = [];
  const groups = [];
  const pieceSpecs = [];
  for (const chunk of chunks) {
    const chunkCenters = chunk.cells.map(centerFor);
    chunkCenters.forEach((cellCenter, i) => {
      skeletonGroup.add(makeOuterSolid(rhombicDodecahedronGeometry(scale), cellCenter));
      PYRAMID_AXES.forEach((axisKey) => {
        const facePosition = cellCenter.clone().add(AXIS_NORMALS[axisKey].clone().multiplyScalar(scale / 2));
        [['in', inwardQuaternion], ['out', outwardQuaternion]].forEach(([dirLabel, toQuaternion]) => {
          const v = makeVoid(pyramid, {
            id: `v-${chunk.groupId}-${i}-${dirLabel}-${axisKey}`,
            quaternion: toQuaternion(axisKey),
            position: facePosition,
            groupIds: [chunk.groupId],
          });
          skeletonGroup.add(...v.sceneObjects);
          voids.push(v);
        });
      });
    });
    // Self-centered on this CHUNK's own centroid, not the whole hull's
    // shared one -- the exact bug found and fixed in Molecules (see
    // buildMoleculeStage's own comment): a chunk's real solid mass sits
    // off to one side of the hull's shared origin, so building its
    // piece geometry relative to that shared origin would silently
    // break tray-select raycasting again.
    const chunkCentroid = chunkCenters.reduce((sum, c) => sum.add(c), new THREE.Vector3()).multiplyScalar(1 / chunkCenters.length);
    groups.push({ id: chunk.groupId, position: chunkCentroid, quaternion: new THREE.Quaternion() });
    const chunkGeometry = mergeGeometries(
      chunkCenters.map((c) => rhombicDodecahedronGeometry(scale).translate(c.x - chunkCentroid.x, c.y - chunkCentroid.y, c.z - chunkCentroid.z)),
      false,
    );
    pieceSpecs.push({ id: chunk.groupId, fillsGroup: chunk.groupId, geometry: chunkGeometry });
  }

  // 4 decoys, deliberately rendered in CUBES, not RDs -- direct
  // instruction ("4 minimally different decoys"). Every real 2-cell RD
  // pair in this lattice is geometrically IDENTICAL to every other one
  // (the symmetry group acts transitively on nearest-neighbor
  // directions -- see the Molecules tier's own decoy notes) -- an
  // RD-rendered 2-cell decoy here would be visually INDISTINGUISHABLE
  // from this stage's own real chunk-a/chunk-b pieces, not just
  // "minimally" different, which risks exactly the "two options that
  // are the same but you say one is wrong" complaint the RD-orientation
  // bug already drew once this session. Cube-rendered decoys, sized to
  // match the real chunks (two pair-sized, two single-sized), stay
  // genuinely distinguishable up close -- the same "wrong material"
  // idea every other decoy in this file already uses -- while their
  // matched SIZE is what makes them "minimally different" rather than
  // an obvious mismatch.
  pieceSpecs.push({ id: 'decoy-pair-0', fillsGroup: DECOY_NEVER_MATCHES, geometry: buildDecoyGeometry(scale, { cells: pairA, asCubes: true }) });
  pieceSpecs.push({ id: 'decoy-pair-1', fillsGroup: DECOY_NEVER_MATCHES, geometry: buildDecoyGeometry(scale, { cells: pairB, asCubes: true }) });
  pieceSpecs.push({ id: 'decoy-single-0', fillsGroup: DECOY_NEVER_MATCHES, geometry: buildDecoyGeometry(scale, {}) });
  pieceSpecs.push({ id: 'decoy-single-1', fillsGroup: DECOY_NEVER_MATCHES, geometry: buildDecoyGeometry(scale, {}) });

  // Same per-load Fisher-Yates as every other tier.
  for (let i = pieceSpecs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pieceSpecs[i], pieceSpecs[j]] = [pieceSpecs[j], pieceSpecs[i]];
  }

  const { trayScaleFor, nextTrayPosition } = createTrayLayout(scale, pieceSpecs.length);

  const pieces = pieceSpecs.map((spec) => {
    const trayScale = trayScaleFor(spec.geometry);
    return makeFusedPiece(spec.geometry, {
      id: spec.id,
      fillsGroup: spec.fillsGroup,
      homePosition: nextTrayPosition(spec.geometry, trayScale),
      trayScale,
    });
  });

  return { skeletonGroup, pieces, voids, groups, hideIdleVoidWires: true };
}

// Renumbered 2026-09-04 (direct instruction, after playing through it:
// "those were okay but actually all easier than molecule stages so
// should be renumbered and sequenced before molecules", confirmed "45-
// 57 too easy" at their OLD ids) -- 5-cell hulls are objectively
// smaller than Molecules' own 6-8 cell composites, so the original
// build order (Molecules 17-44, then Hulls 45-57) put the easier tier
// AFTER the harder one. Now ids 17-29 (was 45-57); Molecules shifts to
// 30-57 (was 17-44) to make room. Branching Molecules (58-63) is
// unaffected -- 13 (Hulls) + 28 (Molecules) = 41 stages either way, so
// it still starts at 17 + 41 = 58 regardless of which of the two comes
// first.
const HULL_STAGES = FIVE_CELL_HULL_DEFS.map((hullDef, i) => ({
  id: 21 + i,
  name: `Hull ${i + 1}: 5-Cell Split`,
  build: (scale) => buildHullSplitStage(scale, hullDef),
}));

// Molecules -- direct instruction (2026-09-04, after playing through the
// pyramid-decomposition tier on a real phone, "no group to scope should
// be based on simple interesting molecule shapes created by two joined
// sets some shapes already featured can be reused but main feature is
// formed from two different picker shapes and there should be three
// similar decoys mixed in no singles as a general rule"): a genuinely
// new composite -- two already-enumerated N-cell shapes (reused directly
// from `THREE_CELL_STAGE_DEFS`/`FOUR_CELL_STAGE_DEFS` above, not new
// geometry) joined into one bigger connected cluster, solved by placing
// exactly the two REAL lobe pieces (each a genuine fused RD-cluster,
// `fillsGroup` scoped to its own lobe's cells) against 3 decoys drawn
// from the SAME catalog. Direct instruction, confirmed via a follow-up
// question (2026-09-04): NO all-in-one "whole molecule" shortcut piece
// and NO interchangeable singles at all -- solving genuinely requires
// placing both real lobes, nothing else offered. Same "no orientation-
// matching, just does this shape go here" spirit as the whole-RD tier
// (ids 1-10) this reuses so much of, not the pyramid-decomposition
// tier's own 6/12-way rotation mechanic.
//
// Finds a real, non-overlapping, FCC-adjacent join between two shapes'
// own cell-lattice offsets -- tries every (cell in A, cell in B, one of
// the 12 real neighbor directions) combination in a fixed order and
// returns shapeB's cells translated to the FIRST placement that touches
// A without occupying any of the same cells, rather than a hand-picked
// join point per shape pair (would need one bespoke case per lobe
// combination, and silently break the moment either shape's own cell
// list changes).
// `anchorCells` (2026-09-04, added for branching molecules below) lets
// a caller restrict WHERE the join is allowed to attach, separately
// from what counts as already-occupied space -- e.g. a second branch
// joining a hub must avoid overlapping the hub AND the first branch
// (`cellsA` = both, for the overlap check) while still being required
// to attach to the HUB specifically, not the first branch (`anchorCells`
// = hub only). Defaults to `cellsA` itself, so every existing 2-lobe
// caller (`buildMoleculeStage`) is unchanged -- same overlap set and
// attachment set as before this parameter existed.
function joinTwoShapes(cellsA, cellsB, anchorCells = cellsA) {
  const key = (c) => c.join(',');
  const aKeys = new Set(cellsA.map(key));
  for (let ai = 0; ai < anchorCells.length; ai++) {
    for (let bi = 0; bi < cellsB.length; bi++) {
      for (const [dx, dy, dz] of NEIGHBOR_OFFSETS) {
        const anchor = [anchorCells[ai][0] + dx, anchorCells[ai][1] + dy, anchorCells[ai][2] + dz];
        const translation = [anchor[0] - cellsB[bi][0], anchor[1] - cellsB[bi][1], anchor[2] - cellsB[bi][2]];
        const translatedB = cellsB.map(([x, y, z]) => [x + translation[0], y + translation[1], z + translation[2]]);
        if (!translatedB.some((c) => aKeys.has(key(c)))) return translatedB;
      }
    }
  }
  throw new Error('joinTwoShapes: no non-overlapping adjacent placement found');
}

function buildMoleculeStage(scale, lobeADef, lobeBDef, decoyDefs) {
  const skeletonGroup = new THREE.Group();
  const pyramid = pyramidGeometry(scale);
  const lobeBCells = joinTwoShapes(lobeADef.cells, lobeBDef.cells);
  const lobes = [
    { groupId: 'lobe-a', cells: lobeADef.cells },
    { groupId: 'lobe-b', cells: lobeBCells },
  ];

  const allWorldPositions = [...lobeADef.cells, ...lobeBCells]
    .map(([cx, cy, cz]) => new THREE.Vector3(...cellToWorld(cx, cy, cz, scale)));
  const centroid = allWorldPositions.reduce((sum, p) => sum.add(p), new THREE.Vector3()).multiplyScalar(1 / allWorldPositions.length);

  const voids = [];
  const groups = [];
  let cursor = 0;
  const pieceSpecs = [];
  for (const lobe of lobes) {
    const lobeCenters = lobe.cells.map(() => allWorldPositions[cursor++].clone().sub(centroid));
    lobeCenters.forEach((cellCenter, i) => {
      skeletonGroup.add(makeOuterSolid(rhombicDodecahedronGeometry(scale), cellCenter));
      PYRAMID_AXES.forEach((axisKey) => {
        const facePosition = cellCenter.clone().add(AXIS_NORMALS[axisKey].clone().multiplyScalar(scale / 2));
        [['in', inwardQuaternion], ['out', outwardQuaternion]].forEach(([dirLabel, toQuaternion]) => {
          const v = makeVoid(pyramid, {
            id: `v-${lobe.groupId}-${i}-${dirLabel}-${axisKey}`,
            quaternion: toQuaternion(axisKey),
            position: facePosition,
            groupIds: [lobe.groupId],
          });
          skeletonGroup.add(...v.sceneObjects);
          voids.push(v);
        });
      });
    });
    // Real bug, caught live before shipping (a tray-select tap on a
    // lobe piece silently missed): a molecule has TWO real centroids in
    // play -- the whole assembled shape's own shared centroid (what
    // `lobeCenters` is expressed relative to, correctly, for the
    // SKELETON's own void positions above) and each LOBE's own centroid
    // (which is generally NOT the shared one -- two joined clusters sit
    // on opposite sides of their shared midpoint, not centered on it
    // individually). Building this piece's own geometry from
    // `lobeCenters` directly, like `buildNCellStage`'s "full" piece
    // does, put its real solid mass well off to one side of the mesh's
    // own LOCAL origin -- everything downstream that assumes a piece's
    // visual center of mass sits at its own `mesh.position` (tray
    // layout spacing, raycast/tap targeting) was silently aimed at the
    // wrong point. Fixed by self-centering the geometry on the LOBE's
    // own centroid instead, and placing that centroid (not the shared
    // origin) as the group's own placement anchor -- `mesh.position +
    // (cell - lobeCentroid)` still lands on the correct shared-skeleton
    // `cell` position once placed, exactly like every other fused piece
    // in this file, just with the right centroid for THIS piece.
    const lobeCentroid = lobeCenters.reduce((sum, c) => sum.add(c), new THREE.Vector3()).multiplyScalar(1 / lobeCenters.length);
    groups.push({ id: lobe.groupId, position: lobeCentroid, quaternion: new THREE.Quaternion() });
    const lobeGeometry = mergeGeometries(
      lobeCenters.map((c) => rhombicDodecahedronGeometry(scale).translate(c.x - lobeCentroid.x, c.y - lobeCentroid.y, c.z - lobeCentroid.z)),
      false,
    );
    pieceSpecs.push({ id: lobe.groupId, fillsGroup: lobe.groupId, geometry: lobeGeometry });
  }

  // Exactly 3 decoys, no more/fewer -- direct instruction ("three similar
  // decoys mixed in"). Each is a genuine OTHER real shape from the same
  // catalog these two lobes came from, rendered as a real RD cluster
  // (never `asCubes`, unlike the whole-RD tier's own alternation) -- a
  // different primitive here would stand out as obviously fake rather
  // than reading as "similar" to the two real lobe pieces.
  for (const decoyDef of decoyDefs) {
    pieceSpecs.push({ id: `decoy-${decoyDef.name}`, fillsGroup: DECOY_NEVER_MATCHES, geometry: buildDecoyGeometry(scale, { cells: decoyDef.cells, asCubes: false }) });
  }

  // Same per-load Fisher-Yates as every other tier -- see buildNCellStage's
  // own comment for why (no position-based shortcut should ever form).
  for (let i = pieceSpecs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pieceSpecs[i], pieceSpecs[j]] = [pieceSpecs[j], pieceSpecs[i]];
  }

  const { trayScaleFor, nextTrayPosition } = createTrayLayout(scale, pieceSpecs.length);

  const pieces = pieceSpecs.map((spec) => {
    const trayScale = trayScaleFor(spec.geometry);
    return makeFusedPiece(spec.geometry, {
      id: spec.id,
      fillsGroup: spec.fillsGroup,
      homePosition: nextTrayPosition(spec.geometry, trayScale),
      trayScale,
    });
  });

  return { skeletonGroup, pieces, voids, groups, hideIdleVoidWires: true };
}

// A Y-shaped molecule -- direct instruction (2026-09-04, "plus more
// molecules maybe some with two branching ends"): THREE real shapes,
// not two -- a hub plus two separate branches, each joined to the HUB
// specifically (not to each other, not to one another in a chain) via
// `joinTwoShapes`' own `anchorCells` parameter (restricts branch2's
// attachment points to the hub's own cells, while its overlap check
// still spans hub+branch1 so it can't land on branch1's own cells
// either). Deliberately a near-duplicate of `buildMoleculeStage` rather
// than a shared generalized N-lobe builder -- the 28 existing 2-lobe
// stages are already shipped and the user is actively playing through
// them; refactoring that working, verified builder to also serve this
// new 3-lobe shape risks a regression in already-tested content for a
// DRY win, not worth it here (same reasoning `buildStage7` already
// stayed its own function instead of folding into `buildNCellStage`).
function buildBranchingMoleculeStage(scale, hubDef, branch1Def, branch2Def, decoyDefs, hubIsKey = false) {
  const skeletonGroup = new THREE.Group();
  const pyramid = pyramidGeometry(scale);
  const branch1Cells = joinTwoShapes(hubDef.cells, branch1Def.cells);
  const occupiedSoFar = [...hubDef.cells, ...branch1Cells];
  const branch2Cells = joinTwoShapes(occupiedSoFar, branch2Def.cells, hubDef.cells);
  const lobes = [
    { groupId: 'lobe-hub', cells: hubDef.cells },
    { groupId: 'lobe-branch1', cells: branch1Cells },
    { groupId: 'lobe-branch2', cells: branch2Cells },
  ];

  const allWorldPositions = [...hubDef.cells, ...branch1Cells, ...branch2Cells]
    .map(([cx, cy, cz]) => new THREE.Vector3(...cellToWorld(cx, cy, cz, scale)));
  const centroid = allWorldPositions.reduce((sum, p) => sum.add(p), new THREE.Vector3()).multiplyScalar(1 / allWorldPositions.length);

  const voids = [];
  const groups = [];
  let cursor = 0;
  const pieceSpecs = [];
  for (const lobe of lobes) {
    const lobeCenters = lobe.cells.map(() => allWorldPositions[cursor++].clone().sub(centroid));
    lobeCenters.forEach((cellCenter, i) => {
      skeletonGroup.add(makeOuterSolid(rhombicDodecahedronGeometry(scale), cellCenter));
      PYRAMID_AXES.forEach((axisKey) => {
        const facePosition = cellCenter.clone().add(AXIS_NORMALS[axisKey].clone().multiplyScalar(scale / 2));
        [['in', inwardQuaternion], ['out', outwardQuaternion]].forEach(([dirLabel, toQuaternion]) => {
          const v = makeVoid(pyramid, {
            id: `v-${lobe.groupId}-${i}-${dirLabel}-${axisKey}`,
            quaternion: toQuaternion(axisKey),
            position: facePosition,
            groupIds: [lobe.groupId],
          });
          skeletonGroup.add(...v.sceneObjects);
          voids.push(v);
        });
      });
    });
    // Same self-centering fix `buildMoleculeStage` needed -- see its own
    // comment for the real bug this avoids repeating.
    const lobeCentroid = lobeCenters.reduce((sum, c) => sum.add(c), new THREE.Vector3()).multiplyScalar(1 / lobeCenters.length);
    groups.push({ id: lobe.groupId, position: lobeCentroid, quaternion: new THREE.Quaternion() });
    const lobeGeometry = mergeGeometries(
      lobeCenters.map((c) => rhombicDodecahedronGeometry(scale).translate(c.x - lobeCentroid.x, c.y - lobeCentroid.y, c.z - lobeCentroid.z)),
      false,
    );
    pieceSpecs.push({ id: lobe.groupId, fillsGroup: lobe.groupId, geometry: lobeGeometry });
  }

  // Burr-style hub key -- optional (default false leaves the 6 plain
  // Branching Molecule stages exactly as they were). A real Y-joint's
  // hub genuinely can't seat until both arms are in, so this is the
  // same `requiresPlacedFirst` machinery `buildBigHullStage` already
  // uses, just naming the two branch lobe ids instead of chunk ids.
  if (hubIsKey) {
    const hubSpec = pieceSpecs.find((spec) => spec.id === 'lobe-hub');
    hubSpec.requiresPlacedFirst = ['lobe-branch1', 'lobe-branch2'];
  }

  // Still exactly 3 decoys -- same "similar decoys" reasoning as the
  // 2-lobe tier, just against 3 real pieces instead of 2 this time.
  for (const decoyDef of decoyDefs) {
    pieceSpecs.push({ id: `decoy-${decoyDef.name}`, fillsGroup: DECOY_NEVER_MATCHES, geometry: buildDecoyGeometry(scale, { cells: decoyDef.cells, asCubes: false }) });
  }

  for (let i = pieceSpecs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pieceSpecs[i], pieceSpecs[j]] = [pieceSpecs[j], pieceSpecs[i]];
  }

  const { trayScaleFor, nextTrayPosition } = createTrayLayout(scale, pieceSpecs.length);

  // `requiresPlacedFirst` forwarded to makeFusedPiece -- real bug caught
  // live (2026-09-05): this map originally omitted it entirely (this
  // function never needed it before `hubIsKey`), which silently dropped
  // the hub's key constraint set above -- verified fixed by inspecting
  // built.pieces directly (Stage 92 now shows lobe-hub really carrying
  // requiresPlacedFirst, matching buildBigHullStage's own equivalent map).
  const pieces = pieceSpecs.map((spec) => {
    const trayScale = trayScaleFor(spec.geometry);
    return makeFusedPiece(spec.geometry, {
      id: spec.id,
      fillsGroup: spec.fillsGroup,
      homePosition: nextTrayPosition(spec.geometry, trayScale),
      trayScale,
      requiresPlacedFirst: spec.requiresPlacedFirst,
    });
  });

  return { skeletonGroup, pieces, voids, groups, hideIdleVoidWires: true };
}

// The shared catalog every molecule stage's lobes AND decoys draw from
// -- direct instruction ("some shapes already featured can be reused").
// 4 real N=3 shapes + 4 curated N=4 shapes, 8 total.
const MOLECULE_SHAPE_CATALOG = [...THREE_CELL_STAGE_DEFS, ...FOUR_CELL_STAGE_DEFS];

// 3 other real shapes from the catalog, never the two this molecule's
// own lobes already used -- a fixed rotating offset per stage (not
// random at build-registration time, which only runs once at module
// load) keeps each molecule stage's own decoy set stable and distinct
// from its neighbors', while the ACTUAL tray position/order still gets
// a genuine per-load shuffle above like everything else. Candidates
// whose own cell count matches EITHER lobe sort first -- direct
// instruction (2026-09-04, "three similar decoys", reinforced "I want
// the upper ones to be challenging to higher IQ individuals"): a decoy
// sized like one of the two real lobes is genuinely confusable at a
// glance; one with a wildly different cell count gives itself away by
// bulk alone before a player even looks at its actual topology. This
// makes every stage's own decoys as similar as the catalog allows,
// rather than only the later/harder ones -- the real difficulty ramp
// across stages comes from `MOLECULE_STAGE_DEFS`' own cell-count
// ordering below, not from making early stages easier to spot fakes in.
function pickMoleculeDecoys(lobeA, lobeB, startIndex) {
  const excluded = new Set([lobeA, lobeB]);
  const lobeSizes = new Set([lobeA.cells.length, lobeB.cells.length]);
  const pool = MOLECULE_SHAPE_CATALOG.filter((d) => !excluded.has(d));
  const bySimilarity = [...pool].sort((a, b) => {
    const aMatch = lobeSizes.has(a.cells.length) ? 0 : 1;
    const bMatch = lobeSizes.has(b.cells.length) ? 0 : 1;
    return aMatch - bMatch;
  });
  return [0, 1, 2].map((i) => bySimilarity[(startIndex + i) % bySimilarity.length]);
}

// Every real, distinct lobe-pair combination the current 8-shape catalog
// can form -- direct instruction (2026-09-04, "generate as many
// different ones as you can"): C(8,2) = 28 unique unordered pairs (order
// doesn't matter -- "Triangle + Ring" and "Ring + Triangle" are the same
// physical molecule), not a small hand-picked sample. Sorted by total
// cell count ascending (6 -> 7 -> 8) so the stage ORDER itself is the
// real difficulty ramp -- direct instruction ("making the higher stages
// truly challenging... challenging to higher IQ individuals"): more
// cells means more real spatial complexity to hold in mind at once
// (bigger silhouette, more possible rotations to check against), the
// same legitimate difficulty lever the whole-RD tier's own 1 -> 2 -> 3
// -> 4 cell progression already uses, not an artificial trick. `sort`
// is stable (guaranteed since ES2019), so pairs tied on cell count keep
// their generation order (catalog index order) rather than reshuffling
// unpredictably on every module load.
const MOLECULE_STAGE_DEFS = [];
for (let a = 0; a < MOLECULE_SHAPE_CATALOG.length; a++) {
  for (let b = a + 1; b < MOLECULE_SHAPE_CATALOG.length; b++) {
    MOLECULE_STAGE_DEFS.push({ lobeA: MOLECULE_SHAPE_CATALOG[a], lobeB: MOLECULE_SHAPE_CATALOG[b] });
  }
}
MOLECULE_STAGE_DEFS.sort((x, y) => (x.lobeA.cells.length + x.lobeB.cells.length) - (y.lobeA.cells.length + y.lobeB.cells.length));

// Each lobe's own cell count is part of its name -- "Straight Line"
// exists in BOTH the N=3 and N=4 catalogs (a genuinely different real
// shape at each size, not a duplicate), so "Straight Line + Straight
// Line" alone would misleadingly read as the same piece twice.
// Starts at 30, not 17 -- Hulls (17-29) got resequenced ahead of
// Molecules after direct feedback that 5-cell hulls read easier than
// Molecules' own 6-8 cell composites (see HULL_STAGES' own comment).
const MOLECULE_STAGES = MOLECULE_STAGE_DEFS.map(({ lobeA, lobeB }, i) => ({
  id: 34 + i,
  name: `Molecule: ${lobeA.name} (${lobeA.cells.length}) + ${lobeB.name} (${lobeB.cells.length})`,
  build: (scale) => buildMoleculeStage(scale, lobeA, lobeB, pickMoleculeDecoys(lobeA, lobeB, i * 2)),
}));

// Same same-size-preferred decoy picking as `pickMoleculeDecoys`, just
// excluding 3 real shapes (hub + both branches) instead of 2.
function pickBranchMoleculeDecoys(hub, branch1, branch2, startIndex) {
  const excluded = new Set([hub, branch1, branch2]);
  const lobeSizes = new Set([hub.cells.length, branch1.cells.length, branch2.cells.length]);
  const pool = MOLECULE_SHAPE_CATALOG.filter((d) => !excluded.has(d));
  const bySimilarity = [...pool].sort((a, b) => {
    const aMatch = lobeSizes.has(a.cells.length) ? 0 : 1;
    const bMatch = lobeSizes.has(b.cells.length) ? 0 : 1;
    return aMatch - bMatch;
  });
  return [0, 1, 2].map((i) => bySimilarity[(startIndex + i) % bySimilarity.length]);
}

// A curated batch of Y-shaped (branching) molecules, not every possible
// hub+2-branch combination the catalog could form (C(8,3) x 3 hub
// choices is a lot, and many combinations -- e.g. two 4-cell branches
// off a 4-cell hub -- would produce a 12-cell composite bigger than
// anything else in the game, more unwieldy than genuinely harder).
// Hand-picked for a reasonable total-cell-count spread (9-11 cells,
// past Molecules' own 6-8 range -- another real step up the difficulty
// ramp) while keeping each one a real, distinct topology. Direct
// instruction: "plus more molecules maybe some with two branching ends".
const BRANCHING_MOLECULE_STAGE_DEFS = [
  { hub: THREE_CELL_STAGE_DEFS[0], branch1: THREE_CELL_STAGE_DEFS[1], branch2: THREE_CELL_STAGE_DEFS[2] }, // Triangle hub + Right-Angle Bend + Wide Bend (9 cells)
  { hub: THREE_CELL_STAGE_DEFS[2], branch1: FOUR_CELL_STAGE_DEFS[0], branch2: THREE_CELL_STAGE_DEFS[3] }, // Wide Bend hub + Tetrahedron + Straight Line-3 (10 cells)
  { hub: THREE_CELL_STAGE_DEFS[1], branch1: FOUR_CELL_STAGE_DEFS[1], branch2: FOUR_CELL_STAGE_DEFS[2] }, // Right-Angle Bend hub + Ring + Star (11 cells)
  { hub: FOUR_CELL_STAGE_DEFS[0], branch1: THREE_CELL_STAGE_DEFS[0], branch2: THREE_CELL_STAGE_DEFS[1] }, // Tetrahedron hub + Triangle + Right-Angle Bend (10 cells)
  { hub: FOUR_CELL_STAGE_DEFS[2], branch1: THREE_CELL_STAGE_DEFS[2], branch2: THREE_CELL_STAGE_DEFS[3] }, // Star hub + Wide Bend + Straight Line-3 (10 cells)
  { hub: FOUR_CELL_STAGE_DEFS[3], branch1: THREE_CELL_STAGE_DEFS[0], branch2: FOUR_CELL_STAGE_DEFS[0] }, // Straight Line-4 hub + Triangle + Tetrahedron (11 cells)
];

const BRANCHING_MOLECULE_STAGES = BRANCHING_MOLECULE_STAGE_DEFS.map(({ hub, branch1, branch2 }, i) => ({
  id: 78 + i,
  name: `Branching Molecule: ${hub.name} (${hub.cells.length}) hub + ${branch1.name} (${branch1.cells.length}) + ${branch2.name} (${branch2.cells.length})`,
  build: (scale) => buildBranchingMoleculeStage(scale, hub, branch1, branch2, pickBranchMoleculeDecoys(hub, branch1, branch2, i * 2)),
}));

// Big Hulls -- direct instruction (2026-09-04, correcting the earlier
// "Hulls" tier which turned out to mean something smaller than intended):
// "when I said hulls i meant structures like a Cube octahedron, or
// tetrahedral hull made from many pieces but broken into three or four
// irregular pieces so more like a building broken up in terms of blocks
// ... some grouped in different clusters". Two real, physically-motivated
// macro shapes, not curated/enumerated ones like every earlier tier:
//
// CUBOCTAHEDRON: 1 center cell + all 12 of its real nearest-neighbor
// cells (`NEIGHBOR_OFFSETS` itself) -- this is the genuine FCC
// "coordination shape" (already documented in `core/lattice.js`'s own
// comments: "the convex hull of a lattice point's 12 nearest neighbors
// ... is exactly a cuboctahedron"), so this needed no curation or
// enumeration at all, just the lattice's own real structure. 13 cells.
//
// TETRAHEDRAL STACK: real FCC "cannonball stacking" -- 3 lattice
// directions that are mutually adjacent to each other (verified: their
// pairwise differences are themselves real neighbor offsets, i.e. genuine
// close-packed triangular-layer basis vectors) build successive
// triangular layers (1, 3, 6, 10 cells) offset along a third mutually-
// adjacent direction, the same construction real tetrahedral-number ball
// stacking uses. 4 layers = 20 cells, verified connected (every cell
// reachable from any other via real neighbor steps) and non-degenerate
// (real extent along all 3 axes, not a flat slab).
const CUBOCTAHEDRON_CELLS = [[0, 0, 0], ...NEIGHBOR_OFFSETS];

const TETRA_STACK_BASIS = { a: [1, 1, 0], b: [1, 0, 1], c: [0, 1, 1] };
function tetrahedralStackCells(layers) {
  const { a, b, c } = TETRA_STACK_BASIS;
  const cells = [];
  for (let k = 0; k < layers; k++) {
    for (let i = 0; i <= k; i++) {
      for (let j = 0; i + j <= k; j++) {
        cells.push([
          i * a[0] + j * b[0] + k * c[0],
          i * a[1] + j * b[1] + k * c[1],
          i * a[2] + j * b[2] + k * c[2],
        ]);
      }
    }
  }
  return cells;
}
const TETRAHEDRAL_STACK_CELLS = tetrahedralStackCells(4);

// Splits a connected cell cluster into `count` genuinely IRREGULAR
// connected chunks -- direct instruction ("broken into three or four
// irregular pieces... like a building broken into blocks... some
// grouped in different clusters"), a deliberately different shape of
// split than the earlier (small, neat, symmetric 2+2+1) Hulls tier.
// Round-robin multi-source BFS (a real, deterministic "Voronoi growth"
// from spread-out seeds, not a hand-picked partition): `seedIndexes`
// picks `count` cells maximally spread apart (greedy farthest-point,
// starting from cell 0), then each region takes turns claiming
// whichever of its OWN frontier's unclaimed neighbors comes first in
// cell order -- since the whole shape is connected, this always
// terminates with every cell claimed by exactly one region, each region
// itself guaranteed connected (grown outward from a single seed one
// step at a time), sizes naturally UNEVEN (a region boxed in early by
// its neighbors' own growth simply stops early) rather than forced into
// equal shares -- exactly the "irregular blocks" character asked for.
function farthestPointSeeds(cells, count) {
  const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  const seeds = [0];
  while (seeds.length < count) {
    let best = -1;
    let bestDist = -1;
    for (let i = 0; i < cells.length; i++) {
      if (seeds.includes(i)) continue;
      const minDistToSeeds = Math.min(...seeds.map((s) => dist2(cells[i], cells[s])));
      if (minDistToSeeds > bestDist) { bestDist = minDistToSeeds; best = i; }
    }
    seeds.push(best);
  }
  return seeds;
}

function partitionIntoIrregularChunks(cells, count, seedOffset = 0) {
  const key = (c) => c.join(',');
  const indexByKey = new Map(cells.map((c, i) => [key(c), i]));
  const seeds = farthestPointSeeds(cells, count).map((s) => (s + seedOffset) % cells.length);
  const owner = new Array(cells.length).fill(-1);
  const frontiers = seeds.map((s) => [s]);
  seeds.forEach((s, r) => { owner[s] = r; });
  let remaining = cells.length - count;
  while (remaining > 0) {
    for (let r = 0; r < count && remaining > 0; r++) {
      while (frontiers[r].length > 0) {
        const cur = frontiers[r].shift();
        const cellCoord = cells[cur];
        const unclaimedNeighbor = NEIGHBOR_OFFSETS
          .map(([dx, dy, dz]) => indexByKey.get(key([cellCoord[0] + dx, cellCoord[1] + dy, cellCoord[2] + dz])))
          .find((idx) => idx !== undefined && owner[idx] === -1);
        if (unclaimedNeighbor !== undefined) {
          owner[unclaimedNeighbor] = r;
          frontiers[r].push(cur, unclaimedNeighbor);
          remaining--;
          break;
        }
      }
    }
  }
  return owner.map((r, i) => ({ chunkIndex: r, cell: cells[i] }));
}

function buildBigHullStage(scale, allCells, chunkCount, decoyChunkCount, keyChunkIndexes = [], pieceColor = PIECE_COLOR, skeletonColor = WIRE_COLOR) {
  const skeletonGroup = new THREE.Group();
  const pyramid = pyramidGeometry(scale);
  const assignments = partitionIntoIrregularChunks(allCells, chunkCount);

  const cellWorldPositions = allCells.map(([cx, cy, cz]) => new THREE.Vector3(...cellToWorld(cx, cy, cz, scale)));
  const centroid = cellWorldPositions.reduce((sum, p) => sum.add(p), new THREE.Vector3()).multiplyScalar(1 / cellWorldPositions.length);

  const voids = [];
  const groups = [];
  const pieceSpecs = [];
  for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex++) {
    const groupId = `chunk-${chunkIndex}`;
    const memberCellIndexes = assignments
      .map((a, i) => (a.chunkIndex === chunkIndex ? i : -1))
      .filter((i) => i >= 0);
    const chunkCenters = memberCellIndexes.map((i) => cellWorldPositions[i].clone().sub(centroid));
    chunkCenters.forEach((cellCenter, i) => {
      skeletonGroup.add(makeOuterSolid(rhombicDodecahedronGeometry(scale), cellCenter, skeletonColor));
      PYRAMID_AXES.forEach((axisKey) => {
        const facePosition = cellCenter.clone().add(AXIS_NORMALS[axisKey].clone().multiplyScalar(scale / 2));
        [['in', inwardQuaternion], ['out', outwardQuaternion]].forEach(([dirLabel, toQuaternion]) => {
          const v = makeVoid(pyramid, {
            id: `v-${groupId}-${i}-${dirLabel}-${axisKey}`,
            quaternion: toQuaternion(axisKey),
            position: facePosition,
            groupIds: [groupId],
          });
          skeletonGroup.add(...v.sceneObjects);
          voids.push(v);
        });
      });
    });
    // Same self-centering discipline every fused multi-cell piece in
    // this file needs (see `buildMoleculeStage`'s own comment for the
    // real bug this avoids repeating) -- doubly important here since
    // these chunks are IRREGULAR (not a clean symmetric pair), so their
    // own centroid is even less likely to coincide with the shared
    // shape centroid than usual.
    const chunkCentroid = chunkCenters.reduce((sum, c) => sum.add(c), new THREE.Vector3()).multiplyScalar(1 / chunkCenters.length);
    groups.push({ id: groupId, position: chunkCentroid, quaternion: new THREE.Quaternion() });
    const chunkGeometry = mergeGeometries(
      chunkCenters.map((c) => rhombicDodecahedronGeometry(scale).translate(c.x - chunkCentroid.x, c.y - chunkCentroid.y, c.z - chunkCentroid.z)),
      false,
    );
    pieceSpecs.push({ id: groupId, fillsGroup: groupId, geometry: chunkGeometry });
  }

  // Burr-puzzle "key piece(s)" -- direct instruction (2026-09-04, "a
  // key piece must go last... most pieces place freely, one or two key
  // pieces are blocked until everything else is in"). Optional (`[]`
  // for the two plain Big Hull stages, which stay exactly as they
  // were) -- each key chunk's own `requiresPlacedFirst` names every
  // OTHER *non-key* real chunk (never the decoys, which never place at
  // all, and never another key -- two keys don't block each other, so
  // a 2-key stage still has a real final choice: either key can go in
  // either order once the regular pieces are down, not one single
  // forced sequence) -- puzzle-state.js's own `isPieceBlocked` rejects
  // a key exactly until all of those are placed, same visible reject-
  // flash as any other invalid placement.
  const keyIndexSet = new Set(keyChunkIndexes);
  for (const keyIndex of keyChunkIndexes) {
    pieceSpecs[keyIndex].requiresPlacedFirst = pieceSpecs
      .filter((spec, i) => i < chunkCount && !keyIndexSet.has(i))
      .map((spec) => spec.id);
  }

  // Decoys: genuine ALTERNATE irregular partitions of the SAME shape
  // (same growth algorithm, different seed offset so the split lands
  // differently), tagged DECOY_NEVER_MATCHES -- a real, similarly-sized,
  // similarly-irregular chunk shape, just not one this stage's own
  // assembly actually needs, same "plausible but wrong" idea every
  // other decoy in this file already uses.
  for (let d = 0; d < decoyChunkCount; d++) {
    const decoyAssignments = partitionIntoIrregularChunks(allCells, chunkCount, d + 1);
    const decoyCellIndexes = decoyAssignments
      .map((a, i) => (a.chunkIndex === (d % chunkCount) ? i : -1))
      .filter((i) => i >= 0);
    const decoyWorldPositions = decoyCellIndexes.map((i) => cellWorldPositions[i]);
    const decoyCentroid = decoyWorldPositions.reduce((sum, p) => sum.add(p), new THREE.Vector3()).multiplyScalar(1 / decoyWorldPositions.length);
    const decoyGeometry = mergeGeometries(
      decoyWorldPositions.map((p) => rhombicDodecahedronGeometry(scale).translate(p.x - decoyCentroid.x, p.y - decoyCentroid.y, p.z - decoyCentroid.z)),
      false,
    );
    pieceSpecs.push({ id: `decoy-${d}`, fillsGroup: DECOY_NEVER_MATCHES, geometry: decoyGeometry });
  }

  for (let i = pieceSpecs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pieceSpecs[i], pieceSpecs[j]] = [pieceSpecs[j], pieceSpecs[i]];
  }

  const { trayScaleFor, nextTrayPosition } = createTrayLayout(scale, pieceSpecs.length);

  const pieces = pieceSpecs.map((spec) => {
    const trayScale = trayScaleFor(spec.geometry);
    return makeFusedPiece(spec.geometry, {
      id: spec.id,
      fillsGroup: spec.fillsGroup,
      homePosition: nextTrayPosition(spec.geometry, trayScale),
      trayScale,
      requiresPlacedFirst: spec.requiresPlacedFirst,
      color: pieceColor,
    });
  });

  return { skeletonGroup, pieces, voids, groups, hideIdleVoidWires: true };
}

// Big Hull + Disphenoid key -- crossover (2026-09-05, direct
// instruction, confirmed via AskUserQuestion after flagging the risk):
// "only the key chunk gets disphenoid detail" -- Big Hull's own coarse
// whole-cell chunks stay exactly as `buildBigHullStage` already builds
// them for every OTHER cell; a small number of designated cells (real
// extremities, not the macro shape's own most-connected center) get
// decomposed into their own 6 fused disphenoid-groups instead of
// staying a single whole-cell piece -- literally `buildDisphenoidRDStage`'s
// own already-proven 6-groups-of-4 construction, just translated onto
// each cell's real world position instead of a stage-local origin.
// Deliberately NOT the literal "24 loose disphenoids per macro-shape
// cell" reading -- that would repeat, at Big Hull's much larger 13/20-
// cell scale, the exact "too much of an x-ray exploration" mistake
// Disphenoid RD's own header comment already documents making and
// reverting on a SINGLE cell.
//
// Real design flaw caught BEFORE shipping, not after (direct question:
// "won't the disphenoid detail give away that it is the key, shouldn't
// there be deep end pieces on several chunks?"): with only ONE cell
// decomposed, the tray shows 3-4 big lumpy multi-cell chunks next to 6
// small pointy disphenoid slivers -- the SHAPE FAMILY alone spoils which
// piece is blocked before the player ever taps anything, defeating the
// whole "discover by trying" point of a Burr key (the original 3-chunk
// Burr stages avoid this because every chunk is a similarly-sized
// irregular cluster; nothing about a chunk's own appearance singles out
// the key). Fixed by decomposing 3 cells the same way, not 1 -- 18 real,
// freely-placeable fine pieces exist purely so "small pointy piece" no
// longer implies "blocked" (confirmed via AskUserQuestion: 3 cells,
// 1-in-3 read, over the smaller 2-cell option).
//
// Second real flaw caught after the sibling `buildDisphenoidElsewhereKeyHullStage`
// shipped (direct instruction, "mix in the non disphenoid burr key so
// the approach is less obvious"): this stage always hid its key among
// the fine pieces, and that sibling always hid its key in a coarse
// chunk -- either FIXED pattern is its own exploit once noticed. Fixed
// by drawing the real key at random, per load, from EVERY real piece
// (coarse chunks and fine groups alike) -- see the random draw below.
function buildDisphenoidKeyHullStage(scale, allCells, fineCellIndexes, chunkCount, decoyChunkCount) {
  const skeletonGroup = new THREE.Group();
  const pyramid = pyramidGeometry(scale);

  const cellWorldPositions = allCells.map(([cx, cy, cz]) => new THREE.Vector3(...cellToWorld(cx, cy, cz, scale)));
  const centroid = cellWorldPositions.reduce((sum, p) => sum.add(p), new THREE.Vector3()).multiplyScalar(1 / cellWorldPositions.length);

  const fineIndexSet = new Set(fineCellIndexes);
  const coarseCells = allCells.filter((_, i) => !fineIndexSet.has(i));
  const coarseWorldPositions = cellWorldPositions.filter((_, i) => !fineIndexSet.has(i));

  const voids = [];
  const groups = [];
  const pieceSpecs = [];

  // Coarse chunks -- identical construction to buildBigHullStage's own
  // per-chunk loop, over every cell except the fine ones.
  const assignments = partitionIntoIrregularChunks(coarseCells, chunkCount);
  for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex++) {
    const groupId = `chunk-${chunkIndex}`;
    const memberCellIndexes = assignments
      .map((a, i) => (a.chunkIndex === chunkIndex ? i : -1))
      .filter((i) => i >= 0);
    const chunkCenters = memberCellIndexes.map((i) => coarseWorldPositions[i].clone().sub(centroid));
    chunkCenters.forEach((cellCenter, i) => {
      skeletonGroup.add(makeOuterSolid(rhombicDodecahedronGeometry(scale), cellCenter));
      PYRAMID_AXES.forEach((axisKey) => {
        const facePosition = cellCenter.clone().add(AXIS_NORMALS[axisKey].clone().multiplyScalar(scale / 2));
        [['in', inwardQuaternion], ['out', outwardQuaternion]].forEach(([dirLabel, toQuaternion]) => {
          const v = makeVoid(pyramid, {
            id: `v-${groupId}-${i}-${dirLabel}-${axisKey}`,
            quaternion: toQuaternion(axisKey),
            position: facePosition,
            groupIds: [groupId],
          });
          skeletonGroup.add(...v.sceneObjects);
          voids.push(v);
        });
      });
    });
    const chunkCentroid = chunkCenters.reduce((sum, c) => sum.add(c), new THREE.Vector3()).multiplyScalar(1 / chunkCenters.length);
    groups.push({ id: groupId, position: chunkCentroid, quaternion: new THREE.Quaternion() });
    const chunkGeometry = mergeGeometries(
      chunkCenters.map((c) => rhombicDodecahedronGeometry(scale).translate(c.x - chunkCentroid.x, c.y - chunkCentroid.y, c.z - chunkCentroid.z)),
      false,
    );
    pieceSpecs.push({ id: groupId, fillsGroup: groupId, geometry: chunkGeometry });
  }

  // The fine cells -- buildDisphenoidRDStage's own 24-disphenoid /
  // 6-group construction, translated onto each cell's real position
  // instead of a stage-local origin. requiresPlacedFirst is assigned
  // AFTER every real piece (coarse + fine) exists -- see below.
  const coarseChunkIds = pieceSpecs.map((spec) => spec.id);
  const orientationIndexes = DISPHENOID_ORIENTATIONS.map((_, i) => i);
  const apexKeyFor = (i) => disphenoidApexAxisKey(i, scale);
  fineCellIndexes.forEach((cellIndex, fineSlot) => {
    const fineCellCenter = cellWorldPositions[cellIndex].clone().sub(centroid);
    skeletonGroup.add(makeOuterSolid(rhombicDodecahedronGeometry(scale), fineCellCenter));
    orientationIndexes.forEach((i) => {
      const key = DISPHENOID_ORIENTATIONS[i];
      const v = makeVoid(disphenoidGeometry(scale), {
        id: `v-fine${fineSlot}-${key}`,
        quaternion: quaternionForDisphenoidOrientation(key),
        position: fineCellCenter,
        groupIds: [`fine${fineSlot}-${apexKeyFor(i)}`],
      });
      skeletonGroup.add(...v.sceneObjects);
      voids.push(v);
    });
    PYRAMID_AXES.forEach((axisKey) => {
      const groupId = `fine${fineSlot}-${axisKey}`;
      const memberIndexes = orientationIndexes.filter((i) => apexKeyFor(i) === axisKey);
      const memberGeometries = memberIndexes.map((i) =>
        disphenoidGeometry(scale).applyQuaternion(quaternionForDisphenoidOrientation(DISPHENOID_ORIENTATIONS[i])),
      );
      const memberCentroids = memberGeometries.map((g) => {
        g.computeBoundingSphere();
        return g.boundingSphere.center;
      });
      const localCentroid = memberCentroids.reduce((sum, c) => sum.add(c), new THREE.Vector3()).multiplyScalar(1 / memberCentroids.length);
      const worldCentroid = fineCellCenter.clone().add(localCentroid);
      groups.push({ id: groupId, position: worldCentroid, quaternion: new THREE.Quaternion() });
      const geometry = mergeGeometries(
        memberGeometries.map((g) => g.translate(-localCentroid.x, -localCentroid.y, -localCentroid.z)),
        false,
      );
      pieceSpecs.push({ id: `chunk-${groupId}`, fillsGroup: groupId, geometry });
    });
  });

  // The real key -- picked at RANDOM, per load, from EVERY real piece
  // (coarse chunks AND fine groups alike), not fixed to always be a
  // fine piece. Direct instruction (2026-09-05, "mix in the non
  // disphenoid burr key so the approach is less obvious"): the sibling
  // `buildDisphenoidElsewhereKeyHullStage` always hides its key in a
  // coarse chunk; this stage previously always hid its key in a fine
  // group -- either fixed pattern is itself a real exploit once a
  // player notices it ("Disphenoid Key stages always gate a fine
  // piece"). Merging both possibilities into ONE random draw here means
  // the key's own LOCATION TYPE, not just its identity, is unknown
  // ahead of time -- same per-load Math.random() discipline the tray's
  // own Fisher-Yates shuffle already uses (no position/pattern-based
  // shortcut should ever form).
  const allRealIds = [...coarseChunkIds, ...pieceSpecs.filter((s) => s.id.startsWith('chunk-fine')).map((s) => s.id)];
  const keyId = allRealIds[Math.floor(Math.random() * allRealIds.length)];
  const keySpec = pieceSpecs.find((spec) => spec.id === keyId);
  keySpec.requiresPlacedFirst = allRealIds.filter((id) => id !== keyId);

  // Decoys -- same alternate-irregular-partition idea buildBigHullStage
  // already uses, over the coarse cells only (the fine cells' own groups
  // get no decoys, matching Disphenoid RD's own choice not to add any
  // loose/fake disphenoid pieces either).
  for (let d = 0; d < decoyChunkCount; d++) {
    const decoyAssignments = partitionIntoIrregularChunks(coarseCells, chunkCount, d + 1);
    const decoyCellIndexes = decoyAssignments
      .map((a, i) => (a.chunkIndex === (d % chunkCount) ? i : -1))
      .filter((i) => i >= 0);
    const decoyWorldPositions = decoyCellIndexes.map((i) => coarseWorldPositions[i]);
    const decoyCentroid = decoyWorldPositions.reduce((sum, p) => sum.add(p), new THREE.Vector3()).multiplyScalar(1 / decoyWorldPositions.length);
    const decoyGeometry = mergeGeometries(
      decoyWorldPositions.map((p) => rhombicDodecahedronGeometry(scale).translate(p.x - decoyCentroid.x, p.y - decoyCentroid.y, p.z - decoyCentroid.z)),
      false,
    );
    pieceSpecs.push({ id: `decoy-${d}`, fillsGroup: DECOY_NEVER_MATCHES, geometry: decoyGeometry });
  }

  for (let i = pieceSpecs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pieceSpecs[i], pieceSpecs[j]] = [pieceSpecs[j], pieceSpecs[i]];
  }

  const { trayScaleFor, nextTrayPosition } = createTrayLayout(scale, pieceSpecs.length);
  const pieces = pieceSpecs.map((spec) => {
    const trayScale = trayScaleFor(spec.geometry);
    return makeFusedPiece(spec.geometry, {
      id: spec.id,
      fillsGroup: spec.fillsGroup,
      homePosition: nextTrayPosition(spec.geometry, trayScale),
      trayScale,
      requiresPlacedFirst: spec.requiresPlacedFirst,
    });
  });

  return { skeletonGroup, pieces, voids, groups, hideIdleVoidWires: true };
}

const BIG_HULL_STAGES = [
  { id: 85, name: 'Big Hull: Cuboctahedron', build: (scale) => buildBigHullStage(scale, CUBOCTAHEDRON_CELLS, 3, 3) },
  { id: 86, name: 'Big Hull: Tetrahedral Stack', build: (scale) => buildBigHullStage(scale, TETRAHEDRAL_STACK_CELLS, 4, 4) },
];

// Burr Puzzle -- direct instruction (2026-09-04, "scope both... key
// piece must go last"): the SAME Big Hull machinery (irregular region-
// grown chunks), on a smaller, faster-to-read shape, with ONE chunk
// designated the "key" -- genuinely unplaceable until the other 2 are
// already in, a real order-dependent constraint, not just a visual
// theme. Reuses the Cuboctahedron's own 13-cell shape (already proven,
// no new geometry needed) at a smaller 3-chunk split so the "why is
// this one refusing to go in" moment reads clearly against a shape
// small enough to hold in mind, rather than getting lost in Big Hull's
// own much bigger 156/240-void scale.
// Extended 2026-09-04 (direct instruction, "where to next" -> "Burr
// variety" -> "all tested... no issues" on the first one): the SAME
// machinery generalizes past a single key -- `buildBigHullStage`'s own
// `keyChunkIndexes` now takes an ARRAY, so a 2-key stage is just
// passing 2 indexes, not a separate mechanic. Two keys deliberately
// don't block EACH OTHER (only the non-key pieces) -- a 2-key stage
// still has a real final choice (either key, in either order, once the
// regular pieces are down), not one single forced sequence, which
// would just be a strict full ordering wearing a "2 keys" label.
const BURR_PUZZLE_STAGES = [
  { id: 87, name: 'Burr Puzzle: Key Piece', build: (scale) => buildBigHullStage(scale, CUBOCTAHEDRON_CELLS, 3, 2, [0]) },
  { id: 88, name: 'Burr Puzzle: Key Piece (Tetrahedral)', build: (scale) => buildBigHullStage(scale, TETRAHEDRAL_STACK_CELLS, 4, 3, [0]) },
  { id: 89, name: 'Burr Puzzle: Two Keys', build: (scale) => buildBigHullStage(scale, TETRAHEDRAL_STACK_CELLS, 4, 3, [0, 1]) },
];

// --- Crossover tiers (2026-09-05, direct instruction: "Burr + Molecule
// Split", "Burr + Mirrored Molecule", "Branching Molecule + Burr hub-
// key", picked from an AskUserQuestion menu against real gaps in the
// existing 9-tier taxonomy). Each one is a genuine combination two
// existing tiers never did together, built entirely from unmodified or
// minimally-extended existing machinery -- no new geometry primitives.

// Burr + Molecule Split: 3 of Molecule Split's own two-real-shape
// composites (different MOLECULE_STAGE_DEFS indexes than Molecule
// Split itself uses, so this reads as fresh content, not a re-skin),
// with a Burr key chunk added on top -- `buildBigHullStage` completely
// unchanged, `keyChunkIndexes` is the only new argument.
const BURR_MOLECULE_SPLIT_STAGE_DEFS = [2, 14, 26].map((i) => MOLECULE_STAGE_DEFS[i]);
const BURR_MOLECULE_SPLIT_STAGES = BURR_MOLECULE_SPLIT_STAGE_DEFS.map(({ lobeA, lobeB }, i) => {
  const cells = joinTwoShapes(lobeA.cells, lobeB.cells);
  return {
    id: 101 + i,
    name: `Burr Puzzle: Molecule Split (${lobeA.name} + ${lobeB.name})`,
    derivedFrom: [{ id: 70, tier: 'Molecule Split' }, { id: 87, tier: 'Burr Puzzle' }],
    build: (scale) => buildBigHullStage(scale, cells, 3, 3, [0]),
  };
});

// Burr + Mirrored Molecule: same crossover, on a genuine chiral mirror-
// pair lobe (CHIRAL_FIVE_CELL_SHAPES, same source Mirrored Molecule
// itself draws from) instead of two different catalog shapes.
const BURR_MIRRORED_MOLECULE_INDEXES = [0, 3, 6];
const BURR_MIRRORED_MOLECULE_STAGES = BURR_MIRRORED_MOLECULE_INDEXES.map((shapeIndex, i) => {
  const cellsA = CHIRAL_FIVE_CELL_SHAPES[shapeIndex];
  const cells = joinTwoShapes(cellsA, mirrorCells(cellsA));
  return {
    id: 104 + i,
    name: `Burr Puzzle: Mirrored Molecule ${shapeIndex + 1}`,
    derivedFrom: [{ id: 62, tier: 'Mirrored Molecule' }, { id: 87, tier: 'Burr Puzzle' }],
    build: (scale) => buildBigHullStage(scale, cells, 3, 3, [0]),
  };
});

// Branching Molecule + Burr hub-key: a Y-joint's shared hub genuinely
// can't seat until both arms are already in, so making the hub a Burr
// key is the natural extension, not an arbitrary pairing -- see
// `buildBranchingMoleculeStage`'s own `hubIsKey` param.
const BURR_BRANCHING_MOLECULE_INDEXES = [0, 2, 4];
const BURR_BRANCHING_MOLECULE_STAGES = BURR_BRANCHING_MOLECULE_INDEXES.map((defIndex, i) => {
  const { hub, branch1, branch2 } = BRANCHING_MOLECULE_STAGE_DEFS[defIndex];
  return {
    id: 107 + i,
    name: `Branching Molecule: ${hub.name} hub + ${branch1.name} + ${branch2.name} (II)`,
    derivedFrom: [{ id: 78, tier: 'Branching Molecule' }, { id: 87, tier: 'Burr Puzzle' }],
    build: (scale) => buildBranchingMoleculeStage(scale, hub, branch1, branch2, pickBranchMoleculeDecoys(hub, branch1, branch2, defIndex * 2), true),
  };
});

// Big Hull x Disphenoid key -- the 4th crossover. `fineCellIndexes[0]`
// is the real key; the other 2 are real extremity cells too (never the
// macro shape's own most-connected center), decomposed the same way
// purely so the key can't be spotted by its own shape family alone (see
// `buildDisphenoidKeyHullStage`'s own header comment for the real bug
// this avoids). Cuboctahedron: 3 of its 12 real nearest-neighbor cells
// (never index 0, the shared center). Tetrahedral Stack: the real apex
// (index 0, layer k=0) plus 2 cells from the outermost layer (k=3,
// indices 10-19) -- all genuine extremities, not an arbitrary pick.
const DISPHENOID_KEY_HULL_STAGES = [
  {
    id: 110,
    name: 'Big Hull: Cuboctahedron (Disphenoid)',
    derivedFrom: [{ id: 85, tier: 'Big Hull' }, { id: 84, tier: 'Disphenoid RD' }, { id: 87, tier: 'Burr Puzzle' }],
    build: (scale) => buildDisphenoidKeyHullStage(scale, CUBOCTAHEDRON_CELLS, [1, 5, 9], 3, 1),
  },
  {
    id: 111,
    name: 'Big Hull: Tetrahedral Stack (Disphenoid)',
    derivedFrom: [{ id: 86, tier: 'Big Hull' }, { id: 84, tier: 'Disphenoid RD' }, { id: 87, tier: 'Burr Puzzle' }],
    build: (scale) => buildDisphenoidKeyHullStage(scale, TETRAHEDRAL_STACK_CELLS, [0, 10, 19], 4, 1),
  },
];

// Crystal tier (2026-09-05, direct instruction: real FCC element
// theming, "both" real unit-cell-shaped geometry AND real names
// throughout, confirmed via AskUserQuestion once a real mechanical
// mismatch was flagged and the scope corrected). A literal textbook
// "conventional unit cell" (8 corner atoms shared 1/8 each + 6
// face-centered atoms shared 1/2 each) is a FRACTIONAL construct --
// every other stage in this file works in WHOLE FCC lattice cells, so
// building that literally would mean inventing fractional-cell clipping
// geometry nothing else here does, purely to look different, a real
// research risk for no puzzle-logic gain. The honest crystallography
// content isn't "8 different unit-cell shapes" anyway -- FCC
// coordination geometry (12 nearest neighbors, coordination number 12)
// is IDENTICAL for every real FCC element; only the real color differs.
// So this reuses `buildBigHullStage` on the already-proven
// `CUBOCTAHEDRON_CELLS` (already documented elsewhere in this file as
// the genuine convex hull of a lattice point's 12 real nearest
// neighbors) completely unchanged except for `pieceColor` -- 8 real
// FCC-crystallizing metals (verified, standard materials-science list:
// Al, Cu, Ag, Au, Ni, Pb, Pt, Pd), each stage identical in mechanic and
// geometry to Big Hull: Cuboctahedron (81), differing only in real name
// and real characteristic color. Colors are standard real-world
// reference approximations for each metal's actual appearance (exact
// shade varies with finish/oxidation in reality) -- not invented, but
// not exact spectrophotometry either.
// Real bug caught live (2026-09-05, "colors werent good on metals the
// colors seemed to be at war with themselves"): `pieceColor` only ever
// tinted the PIECE, never the skeleton's own per-cell outer-solid ghost
// -- so a real dark metal (Iron especially) sat right next to a
// completely unrelated bright cyan WIRE_COLOR region for every cell not
// yet filled, clashing badly rather than reading as "this whole space
// is the same real metal." `buildBigHullStage`/`buildBCCCellsStage`
// both now take a second `skeletonColor` param (default WIRE_COLOR, so
// every OTHER call site -- plain Big Hull, Burr Puzzle, plain BCC --
// is visually unchanged); the merged metal stages pass the same real
// element color to both.
// Merged 2026-09-05 (direct instruction: "I didnt realise all the
// metals puzzles were so simple, please merge all the similar ones
// down to one source... the single puzzle can have multiple
// attributions dont bother with the bare attribution"): all 8 of these
// were genuinely identical in mechanic AND geometry -- FCC coordination
// geometry doesn't differ by element, only the real color does (see
// the original reasoning below, kept for the record) -- so 8 stage
// entries for a single real puzzle was real, needless duplication, not
// 8 real puzzles. Down to ONE stage, colored as Copper (the most
// commonly-cited real FCC textbook example), carrying the other 7 real
// elements as `attributions` -- real names, not a placeholder list --
// rather than shipping a second, uncolored/generic version alongside
// it ("dont bother with the bare attribution").
const FCC_ELEMENTS = [
  { symbol: 'Cu', name: 'Copper', color: 0xb87333 },
  { symbol: 'Al', name: 'Aluminum' },
  { symbol: 'Ag', name: 'Silver' },
  { symbol: 'Au', name: 'Gold' },
  { symbol: 'Ni', name: 'Nickel' },
  { symbol: 'Pb', name: 'Lead' },
  { symbol: 'Pt', name: 'Platinum' },
  { symbol: 'Pd', name: 'Palladium' },
];
const CRYSTAL_STAGES = [{
  id: 112,
  name: `Crystal: ${FCC_ELEMENTS[0].name} (${FCC_ELEMENTS[0].symbol})`,
  attributions: FCC_ELEMENTS.map((el) => `${el.name} (${el.symbol})`),
  derivedFrom: [{ id: 85, tier: 'Big Hull' }],
  build: (scale) => buildBigHullStage(scale, CUBOCTAHEDRON_CELLS, 3, 3, [], FCC_ELEMENTS[0].color, FCC_ELEMENTS[0].color),
}];

// BCC tier (2026-09-05, following up on "would BCC or pieces that form
// other lattices work"): a genuinely different real lattice, not
// another FCC skin. BCC's own real Voronoi cell is a truncated
// octahedron (`truncatedOctahedronGeometry` above), and its own real
// coordination is 8 nearest (body-diagonal) + 6 second-nearest (axis)
// neighbors -- `BCC_NEIGHBOR_OFFSETS`, already real and verified in
// `geometry-extensions/dual-lattice.js`. Both lattices share the exact
// same world coordinate frame and `cellToWorld` transform (confirmed in
// `bcc-detail-lattice.js`'s own header), so BCC cell positions need no
// new coordinate math, only BCC's own real neighbor offsets and its own
// real shape.
//
// Deliberately NOT a reuse of `buildNCellStage` -- that function's own
// decoy/joined-pair/pyramid-decomposition-void machinery is real,
// heavily-played, RD-specific content with no BCC analog yet (no proven
// way to decompose a truncated octahedron into sub-pieces exists), so
// `buildBCCCellsStage` mirrors only buildNCellStage's OUTER shape --
// whole interchangeable cells via `ANY_SINGLE_CELL_GROUP`, tap to
// place, no orientation -- rather than risking that proven builder.
function buildBCCCellsStage(scale, cellOffsets, pieceColor = PIECE_COLOR, skeletonColor = WIRE_COLOR) {
  const skeletonGroup = new THREE.Group();
  const shapeScale = bccShapeScaleFor(scale);
  const toGeometry = truncatedOctahedronGeometry(shapeScale);

  const cellWorldPositions = cellOffsets.map(([cx, cy, cz]) => new THREE.Vector3(...cellToWorld(cx, cy, cz, scale)));
  const centroid = cellWorldPositions.reduce((sum, p) => sum.add(p), new THREE.Vector3()).multiplyScalar(1 / cellWorldPositions.length);
  const cellCenters = cellWorldPositions.map((p) => p.clone().sub(centroid));

  const voids = [];
  cellCenters.forEach((cellCenter, i) => {
    skeletonGroup.add(makeOuterSolid(toGeometry, cellCenter, skeletonColor));
    const v = makeVoid(toGeometry, {
      id: `v-cell-${i}`,
      position: cellCenter,
      groupIds: [`cell-${i}`],
    });
    skeletonGroup.add(...v.sceneObjects);
    voids.push(v);
  });

  const groups = cellCenters.map((center, i) => ({ id: `cell-${i}`, position: center.clone(), quaternion: new THREE.Quaternion() }));
  const pieceSpecs = cellCenters.map((_, i) => ({ id: `single-${i}`, fillsGroup: ANY_SINGLE_CELL_GROUP, geometry: toGeometry }));

  const { trayScaleFor, nextTrayPosition } = createTrayLayout(scale, pieceSpecs.length);
  const pieces = pieceSpecs.map((spec) => {
    const trayScale = trayScaleFor(spec.geometry);
    return makeFusedPiece(spec.geometry, {
      id: spec.id,
      fillsGroup: spec.fillsGroup,
      homePosition: nextTrayPosition(spec.geometry, trayScale),
      trayScale,
      color: pieceColor,
    });
  });

  return { skeletonGroup, pieces, voids, groups, hideIdleVoidWires: true };
}

// One real cell, one real neighbor -- the genuine BCC proof-of-concept
// (mirrors ONE_CELL_STAGE's own bootstrap role for FCC/RD), verified
// with real execution before any element theming was added on top.
const BCC_TWO_CELL_OFFSETS = [[0, 0, 0], ...BCC_NEIGHBOR_OFFSETS.slice(0, 1)];
const ONE_BCC_STAGE = {
  id: 113,
  name: 'BCC: One Cell',
  build: (scale) => buildBCCCellsStage(scale, [[0, 0, 0]]),
};

// Merged 2026-09-05, same real duplication caught in the FCC Crystal
// tier and the same fix: 9 stage entries for one real puzzle (BCC
// coordination geometry doesn't differ by element either) is real
// duplication, not 9 real puzzles. Down to ONE stage, colored as Iron
// (the most commonly-cited real BCC textbook example -- room-
// temperature alpha-iron), the other 8 real elements carried as
// `attributions`, no separate bare/generic version.
const BCC_ELEMENTS = [
  { symbol: 'Fe', name: 'Iron', color: 0x43464b },
  { symbol: 'Cr', name: 'Chromium' },
  { symbol: 'W', name: 'Tungsten' },
  { symbol: 'Mo', name: 'Molybdenum' },
  { symbol: 'V', name: 'Vanadium' },
  { symbol: 'Nb', name: 'Niobium' },
  { symbol: 'Ta', name: 'Tantalum' },
  { symbol: 'Na', name: 'Sodium' },
  { symbol: 'K', name: 'Potassium' },
];
const BCC_CRYSTAL_STAGES = [{
  id: 114,
  name: `BCC Crystal: ${BCC_ELEMENTS[0].name} (${BCC_ELEMENTS[0].symbol})`,
  attributions: BCC_ELEMENTS.map((el) => `${el.name} (${el.symbol})`),
  derivedFrom: [{ id: 113, tier: 'BCC' }],
  build: (scale) => buildBCCCellsStage(scale, BCC_TWO_CELL_OFFSETS, BCC_ELEMENTS[0].color, BCC_ELEMENTS[0].color),
}];

// Real BCC ALLOY puzzles -- direct instruction ("lets do something
// real with the BCC lattice and make some great alloy puzzles"),
// following the pure-metal merge above. `isBCC`'s own parity check
// (dual-lattice.js) already splits every real BCC lattice point into
// exactly two sublattices -- all-even and all-odd -- and that split
// IS the real structure of a B2 (CsCl-type) ordered intermetallic
// alloy: one element on the "corner" sublattice, a different element
// on the "body-center" sublattice, real second-nearest neighbors
// (BCC_NEIGHBOR_OFFSETS' own 6 axis offsets, e.g. [2,0,0], landing
// back on the SAME parity as the seed cell) staying the same element,
// real nearest neighbors (the 8 body-diagonal offsets, all opposite
// parity) always the OTHER element -- not an invented rule, the actual
// physics of how these compounds order. Real, well-known B2 alloys:
// NiAl and FeAl (aerospace/corrosion-resistant iron/nickel aluminides)
// and CuZn (the beta phase of brass) -- all genuinely CsCl-structured,
// all reusing colors already established above (Ni/Al/Fe/Cu) where
// verified, one new real color (Zn) where not.
function buildBCCAlloyStage(scale, cellOffsets, colorEven, colorOdd) {
  const skeletonGroup = new THREE.Group();
  const shapeScale = bccShapeScaleFor(scale);
  const toGeometry = truncatedOctahedronGeometry(shapeScale);

  const cellWorldPositions = cellOffsets.map(([cx, cy, cz]) => new THREE.Vector3(...cellToWorld(cx, cy, cz, scale)));
  const centroid = cellWorldPositions.reduce((sum, p) => sum.add(p), new THREE.Vector3()).multiplyScalar(1 / cellWorldPositions.length);
  const cellCenters = cellWorldPositions.map((p) => p.clone().sub(centroid));
  const cellColors = cellOffsets.map(([cx, cy, cz]) => (isBCC(cx, cy, cz) && ((((cx % 2) + 2) % 2) === 0) ? colorEven : colorOdd));

  const voids = [];
  cellCenters.forEach((cellCenter, i) => {
    skeletonGroup.add(makeOuterSolid(toGeometry, cellCenter, cellColors[i]));
    const v = makeVoid(toGeometry, { id: `v-cell-${i}`, position: cellCenter, groupIds: [`cell-${i}`] });
    skeletonGroup.add(...v.sceneObjects);
    voids.push(v);
  });

  const groups = cellCenters.map((center, i) => ({ id: `cell-${i}`, position: center.clone(), quaternion: new THREE.Quaternion() }));
  const pieceSpecs = cellCenters.map((_, i) => ({ id: `single-${i}`, fillsGroup: `cell-${i}`, geometry: toGeometry, color: cellColors[i] }));

  // Real difficulty, not just piece count -- direct instruction ("I
  // would like them to represent challenging as possible puzzles as
  // well otherwise they should go down to an appropriate difficulty
  // stage"). This engine's own green/red validity highlight already
  // reveals the ONE correct void the instant any piece is selected, so
  // a plain 15-piece sort (no orientation, no decoys, no order) is
  // genuinely no harder than the game's very simplest tier despite the
  // bigger piece count -- real difficulty here has to come from the
  // SAME proven levers every other tier uses: a real decoy (wrong
  // color, DECOY_NEVER_MATCHES, so it never validates against anything)
  // and a real Burr-style key -- physically motivated, not arbitrary:
  // the shared coordination CENTER genuinely can't be recognized as
  // correctly seated until its entire real 14-neighbor shell surrounds
  // it, so it's blocked (`requiresPlacedFirst`) until every neighbor is
  // down, same mechanism `buildBigHullStage`'s own `keyChunkIndexes`
  // already uses.
  const neighborIds = pieceSpecs.slice(1).map((spec) => spec.id);
  pieceSpecs[0].requiresPlacedFirst = neighborIds;
  // Default PIECE_COLOR -- distinct from every real alloy pairing used
  // below (verified: none of BCC_ALLOY_DEFS' own colorEven/colorOdd
  // values are close to it), same "neutral, not plausibly a real
  // answer" decoy convention Color Match's own decoy already uses.
  pieceSpecs.push({ id: 'decoy-0', fillsGroup: DECOY_NEVER_MATCHES, geometry: toGeometry, color: PIECE_COLOR });

  for (let i = pieceSpecs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pieceSpecs[i], pieceSpecs[j]] = [pieceSpecs[j], pieceSpecs[i]];
  }

  const { trayScaleFor, nextTrayPosition } = createTrayLayout(scale, pieceSpecs.length);
  const pieces = pieceSpecs.map((spec) => {
    const trayScale = trayScaleFor(spec.geometry);
    return makeFusedPiece(spec.geometry, {
      id: spec.id,
      fillsGroup: spec.fillsGroup,
      homePosition: nextTrayPosition(spec.geometry, trayScale),
      trayScale,
      color: spec.color,
      requiresPlacedFirst: spec.requiresPlacedFirst,
    });
  });

  return { skeletonGroup, pieces, voids, groups, hideIdleVoidWires: true };
}

// 1 center (even) + all 14 real neighbors (the 8 odd body-diagonal
// nearest + the 6 even axis second-nearest) -- the real local
// coordination environment of one atom in a B2 alloy, not an arbitrary
// cluster. Mirrors CUBOCTAHEDRON_CELLS' own "[0,0,0], ...NEIGHBOR_OFFSETS"
// pattern for the analogous real FCC coordination shell.
const BCC_ALLOY_CELLS = [[0, 0, 0], ...BCC_NEIGHBOR_OFFSETS];

const BCC_ALLOY_DEFS = [
  { name: 'Nickel Aluminide', formula: 'NiAl', colorEven: 0x727472, colorOdd: 0xc8c9cb }, // Ni (even/corner), Al (odd/body-center)
  { name: 'Iron Aluminide', formula: 'FeAl', colorEven: 0x43464b, colorOdd: 0xc8c9cb }, // Fe (even/corner), Al (odd/body-center)
  { name: 'Beta Brass', formula: 'CuZn', colorEven: 0xb87333, colorOdd: 0xd0d3c8 }, // Cu (even/corner), Zn (odd/body-center) -- Zn: real pale blue-white metal color
];
const BCC_ALLOY_STAGES = BCC_ALLOY_DEFS.map((def, i) => ({
  id: 90 + i,
  name: `Alloy: ${def.name} (${def.formula})`,
  derivedFrom: [{ id: 113, tier: 'BCC' }],
  build: (scale) => buildBCCAlloyStage(scale, BCC_ALLOY_CELLS, def.colorEven, def.colorOdd),
}));

// Dilute alloy steels (2026-09-05, direct instruction: "different grade
// steels including carbon, ... chrome, molybidenum"): real Chrome/
// Molybdenum steels are NOT ordered 50/50 compounds like NiAl/FeAl/CuZn
// above -- they're DILUTE substitutional solid solutions, a small
// random fraction of Cr or Mo atoms replacing Fe at otherwise-ordinary
// BCC lattice sites, real alpha-iron everywhere else. Genuinely
// different real structure from the B2 alloys, not a reskin -- a
// near-duplicate of buildBCCAlloyStage rather than a shared function,
// same reasoning this file already applies elsewhere (see
// buildBranchingMoleculeStage's own header) -- the coloring rule itself
// is fundamentally different (real per-load RANDOM site selection, not
// a fixed deterministic parity split), not just a parameter change.
function buildBCCDiluteAlloyStage(scale, cellOffsets, baseColor, dopantColor, dopantCount) {
  const skeletonGroup = new THREE.Group();
  const shapeScale = bccShapeScaleFor(scale);
  const toGeometry = truncatedOctahedronGeometry(shapeScale);

  const cellWorldPositions = cellOffsets.map(([cx, cy, cz]) => new THREE.Vector3(...cellToWorld(cx, cy, cz, scale)));
  const centroid = cellWorldPositions.reduce((sum, p) => sum.add(p), new THREE.Vector3()).multiplyScalar(1 / cellWorldPositions.length);
  const cellCenters = cellWorldPositions.map((p) => p.clone().sub(centroid));

  // Real per-load randomness (same Math.random() discipline the tray's
  // own Fisher-Yates shuffle already uses elsewhere in this file) --
  // real dilute alloys don't favor any particular site, so which cells
  // are the dopant genuinely varies every time this stage loads.
  const indices = cellOffsets.map((_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const dopantIndexSet = new Set(indices.slice(0, dopantCount));
  const cellColors = cellOffsets.map((_, i) => (dopantIndexSet.has(i) ? dopantColor : baseColor));

  const voids = [];
  cellCenters.forEach((cellCenter, i) => {
    skeletonGroup.add(makeOuterSolid(toGeometry, cellCenter, cellColors[i]));
    const v = makeVoid(toGeometry, { id: `v-cell-${i}`, position: cellCenter, groupIds: [`cell-${i}`] });
    skeletonGroup.add(...v.sceneObjects);
    voids.push(v);
  });

  const groups = cellCenters.map((center, i) => ({ id: `cell-${i}`, position: center.clone(), quaternion: new THREE.Quaternion() }));
  const pieceSpecs = cellCenters.map((_, i) => ({ id: `single-${i}`, fillsGroup: `cell-${i}`, geometry: toGeometry, color: cellColors[i] }));

  // Same physically-motivated key as the ordered alloys above (the
  // shared coordination center can't be recognized as seated until its
  // whole real neighbor shell surrounds it) -- true regardless of
  // which cell happens to be the dopant this time.
  const neighborIds = pieceSpecs.slice(1).map((spec) => spec.id);
  pieceSpecs[0].requiresPlacedFirst = neighborIds;
  pieceSpecs.push({ id: 'decoy-0', fillsGroup: DECOY_NEVER_MATCHES, geometry: toGeometry, color: PIECE_COLOR });

  for (let i = pieceSpecs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pieceSpecs[i], pieceSpecs[j]] = [pieceSpecs[j], pieceSpecs[i]];
  }

  const { trayScaleFor, nextTrayPosition } = createTrayLayout(scale, pieceSpecs.length);
  const pieces = pieceSpecs.map((spec) => {
    const trayScale = trayScaleFor(spec.geometry);
    return makeFusedPiece(spec.geometry, {
      id: spec.id,
      fillsGroup: spec.fillsGroup,
      homePosition: nextTrayPosition(spec.geometry, trayScale),
      trayScale,
      color: spec.color,
      requiresPlacedFirst: spec.requiresPlacedFirst,
    });
  });

  return { skeletonGroup, pieces, voids, groups, hideIdleVoidWires: true };
}

const DILUTE_ALLOY_DEFS = [
  { name: 'Chromium Steel', formula: 'Fe + Cr', dopantColor: 0xc6c7c8, dopantCount: 2 }, // Cr, real color from BCC_ELEMENTS
  { name: 'Molybdenum Steel', formula: 'Fe + Mo', dopantColor: 0x8c92ac, dopantCount: 2 }, // Mo, real color from BCC_ELEMENTS
];
const DILUTE_ALLOY_STAGES = DILUTE_ALLOY_DEFS.map((def, i) => ({
  id: 93 + i,
  name: `Alloy: ${def.name} (${def.formula})`,
  derivedFrom: [{ id: 113, tier: 'BCC' }],
  build: (scale) => buildBCCDiluteAlloyStage(scale, BCC_ALLOY_CELLS, BCC_ELEMENTS[0].color, def.dopantColor, def.dopantCount),
}));

// Carbon Steel (2026-09-05, direct instruction): real carbon in
// alpha-iron is NOT a substitutional alloy at all -- it's an
// INTERSTITIAL solute, sitting in the real octahedral "hole" between
// lattice points, not replacing one. `geometry-extensions/
// interstitial-lattice.js`'s own `octahedronVerts` is exactly this real
// site (numerically verified there via a real Delaunay triangulation of
// a real BCC lattice patch -- "the same distorted sites carbon occupies
// in alpha-iron", that file's own header), already wired into real
// production rendering (render.js's own buildInterstitialGeometry, the
// same ConvexGeometry-from-real-vertices pattern this file already
// reuses for the plain truncated-octahedron cells) -- reused directly,
// not re-derived, per the standing "if it isn't in rhombiverse and we
// need it, it should be in rhombiverse" principle. A genuinely
// different PIECE OF GEOMETRY, not a recolored cell -- the real
// physical reason carbon steel is a distinct real material from pure
// iron, not just "iron with a different paint job".
function buildCarbonSteelStage(scale, cellOffsets, baseColor, carbonColor) {
  const skeletonGroup = new THREE.Group();
  const shapeScale = bccShapeScaleFor(scale);
  const toGeometry = truncatedOctahedronGeometry(shapeScale);

  const cellWorldPositions = cellOffsets.map(([cx, cy, cz]) => new THREE.Vector3(...cellToWorld(cx, cy, cz, scale)));
  const centroid = cellWorldPositions.reduce((sum, p) => sum.add(p), new THREE.Vector3()).multiplyScalar(1 / cellWorldPositions.length);
  const cellCenters = cellWorldPositions.map((p) => p.clone().sub(centroid));

  const voids = [];
  cellCenters.forEach((cellCenter, i) => {
    skeletonGroup.add(makeOuterSolid(toGeometry, cellCenter, baseColor));
    const v = makeVoid(toGeometry, { id: `v-cell-${i}`, position: cellCenter, groupIds: [`cell-${i}`] });
    skeletonGroup.add(...v.sceneObjects);
    voids.push(v);
  });

  const groups = cellCenters.map((center, i) => ({ id: `cell-${i}`, position: center.clone(), quaternion: new THREE.Quaternion() }));
  const pieceSpecs = cellCenters.map((_, i) => ({ id: `single-${i}`, fillsGroup: `cell-${i}`, geometry: toGeometry, color: baseColor }));

  // The real interstitial site: one real octahedral hole (anchor at the
  // shared coordination center, axis offset [2,0,0] -- one of
  // dual-lattice.js's own 6 real BCC axis neighbor directions, already
  // part of this shell) built from octahedronVerts' own real 6 vertices,
  // converted through the SAME cellToWorld this whole file already uses
  // for every other lattice coordinate (both math libraries share one
  // real coordinate frame, confirmed in bcc-detail-lattice.js's own
  // header). Self-centered on its own real centroid, same discipline
  // every other fused/merged piece in this file needs.
  const interstitialLatticeVerts = octahedronVerts([0, 0, 0], [2, 0, 0]);
  const interstitialWorldVerts = interstitialLatticeVerts.map(([x, y, z]) => new THREE.Vector3(...cellToWorld(x, y, z, scale)).sub(centroid));
  const interstitialCentroid = interstitialWorldVerts.reduce((sum, p) => sum.add(p), new THREE.Vector3()).multiplyScalar(1 / interstitialWorldVerts.length);
  const interstitialGeometry = new ConvexGeometry(interstitialWorldVerts.map((p) => p.clone().sub(interstitialCentroid)));

  skeletonGroup.add(makeOuterSolid(interstitialGeometry, interstitialCentroid, carbonColor));
  const carbonVoid = makeVoid(interstitialGeometry, { id: 'v-carbon', position: interstitialCentroid, groupIds: ['carbon'] });
  skeletonGroup.add(...carbonVoid.sceneObjects);
  voids.push(carbonVoid);
  groups.push({ id: 'carbon', position: interstitialCentroid.clone(), quaternion: new THREE.Quaternion() });
  pieceSpecs.push({ id: 'carbon-atom', fillsGroup: 'carbon', geometry: interstitialGeometry, color: carbonColor });

  // Same physically-motivated key as the other Alloy stages -- the
  // shared coordination center can't be recognized as seated until its
  // whole real neighbor shell (now including the real interstitial
  // site) surrounds it.
  const nonKeyIds = pieceSpecs.filter((spec) => spec.id !== 'single-0').map((spec) => spec.id);
  pieceSpecs[0].requiresPlacedFirst = nonKeyIds;
  pieceSpecs.push({ id: 'decoy-0', fillsGroup: DECOY_NEVER_MATCHES, geometry: toGeometry, color: PIECE_COLOR });

  for (let i = pieceSpecs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pieceSpecs[i], pieceSpecs[j]] = [pieceSpecs[j], pieceSpecs[i]];
  }

  const { trayScaleFor, nextTrayPosition } = createTrayLayout(scale, pieceSpecs.length);
  const pieces = pieceSpecs.map((spec) => {
    const trayScale = trayScaleFor(spec.geometry);
    return makeFusedPiece(spec.geometry, {
      id: spec.id,
      fillsGroup: spec.fillsGroup,
      homePosition: nextTrayPosition(spec.geometry, trayScale),
      trayScale,
      color: spec.color,
      requiresPlacedFirst: spec.requiresPlacedFirst,
    });
  });

  return { skeletonGroup, pieces, voids, groups, hideIdleVoidWires: true };
}

// Real graphite/carbon color (a very dark, slightly warm near-black --
// standard reference for elemental carbon/graphite).
const CARBON_COLOR = 0x2b2b2b;
const CARBON_STEEL_STAGE = {
  id: 95,
  name: 'Alloy: Carbon Steel (Fe + C, interstitial)',
  derivedFrom: [{ id: 113, tier: 'BCC' }],
  build: (scale) => buildCarbonSteelStage(scale, BCC_ALLOY_CELLS, BCC_ELEMENTS[0].color, CARBON_COLOR),
};

// FCC dilute alloys (2026-09-05, direct instruction: "silver and gold
// alloy, white gold, 9ct, 14ct, and 18ct gold, bronze, spelter etc").
// Same real "dilute substitutional solid solution" mechanism as
// Chromium/Molybdenum Steel above, on FCC's own real coordination shell
// (CUBOCTAHEDRON_CELLS, already proven for the Crystal tier) instead of
// BCC's -- a near-duplicate of buildBCCDiluteAlloyStage rather than a
// shared function (whole-cell RD geometry/void construction, not TO),
// same reasoning this file already applies to its other near-duplicate
// builders. "Spelter" deliberately NOT included -- it's a historical/
// informal term for zinc die-casting alloys with no one settled real
// composition to verify against, unlike every other alloy here.
function buildFCCDiluteAlloyStage(scale, cellOffsets, baseColor, dopantColor, dopantCount) {
  const skeletonGroup = new THREE.Group();
  const rdGeometry = rhombicDodecahedronGeometry(scale);

  const cellWorldPositions = cellOffsets.map(([cx, cy, cz]) => new THREE.Vector3(...cellToWorld(cx, cy, cz, scale)));
  const centroid = cellWorldPositions.reduce((sum, p) => sum.add(p), new THREE.Vector3()).multiplyScalar(1 / cellWorldPositions.length);
  const cellCenters = cellWorldPositions.map((p) => p.clone().sub(centroid));

  const indices = cellOffsets.map((_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const dopantIndexSet = new Set(indices.slice(0, dopantCount));
  const cellColors = cellOffsets.map((_, i) => (dopantIndexSet.has(i) ? dopantColor : baseColor));

  const voids = [];
  cellCenters.forEach((cellCenter, i) => {
    skeletonGroup.add(makeOuterSolid(rdGeometry, cellCenter, cellColors[i]));
    const v = makeVoid(rdGeometry, { id: `v-cell-${i}`, position: cellCenter, groupIds: [`cell-${i}`] });
    skeletonGroup.add(...v.sceneObjects);
    voids.push(v);
  });

  const groups = cellCenters.map((center, i) => ({ id: `cell-${i}`, position: center.clone(), quaternion: new THREE.Quaternion() }));
  const pieceSpecs = cellCenters.map((_, i) => ({ id: `single-${i}`, fillsGroup: `cell-${i}`, geometry: rdGeometry, color: cellColors[i] }));

  // Same physically-motivated key as the BCC alloys -- the shared
  // coordination center can't be recognized as seated until its whole
  // real 12-neighbor shell surrounds it.
  const neighborIds = pieceSpecs.slice(1).map((spec) => spec.id);
  pieceSpecs[0].requiresPlacedFirst = neighborIds;
  pieceSpecs.push({ id: 'decoy-0', fillsGroup: DECOY_NEVER_MATCHES, geometry: rdGeometry, color: PIECE_COLOR });

  for (let i = pieceSpecs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pieceSpecs[i], pieceSpecs[j]] = [pieceSpecs[j], pieceSpecs[i]];
  }

  const { trayScaleFor, nextTrayPosition } = createTrayLayout(scale, pieceSpecs.length);
  const pieces = pieceSpecs.map((spec) => {
    const trayScale = trayScaleFor(spec.geometry);
    return makeFusedPiece(spec.geometry, {
      id: spec.id,
      fillsGroup: spec.fillsGroup,
      homePosition: nextTrayPosition(spec.geometry, trayScale),
      trayScale,
      color: spec.color,
      requiresPlacedFirst: spec.requiresPlacedFirst,
    });
  });

  return { skeletonGroup, pieces, voids, groups, hideIdleVoidWires: true };
}

// Real compositions, not invented proportions -- CUBOCTAHEDRON_CELLS
// has 13 real cells (1 center + 12 neighbors), so dopantCount is each
// alloy's own real minority fraction rounded to the nearest whole cell:
// - Electrum (Ag-Au): naturally occurring, fully FCC-miscible across
//   all compositions -- ~23% Ag / 77% Au here (3 of 13), an illustrative
//   real ratio within electrum's own well-documented natural range
//   (roughly 10-45% Ag), not a single fixed "the" composition (there
//   isn't one in nature).
// - White Gold: real 18ct formulations are ~75% Au + ~25% Ni (or Pd/Pt
//   nickel-free) -- 3 of 13 (23%) rounds to the same real 18ct fraction.
// - 18ct Rose Gold: real 18ct is 75% Au + 25% alloying metal, Cu for
//   the real rose/red tint -- same 3-of-13 fraction as White Gold
//   (same karat), distinguished by real dopant COLOR, not count.
// - Bronze (Cu-Sn): real standard bronze is ~88% Cu / 12% Sn -- 2 of 13
//   (15%) is the nearest whole-cell match to that real ratio.
const GOLD_COLOR = 0xd4af37;
const COPPER_COLOR = 0xb87333;
const FCC_ALLOY_DEFS = [
  { name: 'Electrum', formula: 'Au + Ag', baseColor: GOLD_COLOR, dopantColor: 0xc0c0c0, dopantCount: 3 }, // Ag in Au
  { name: 'White Gold', formula: 'Au + Ni', baseColor: GOLD_COLOR, dopantColor: 0x727472, dopantCount: 3 }, // Ni in Au
  { name: 'Rose Gold (18ct)', formula: 'Au + Cu', baseColor: GOLD_COLOR, dopantColor: COPPER_COLOR, dopantCount: 3 }, // Cu in Au
  { name: 'Bronze', formula: 'Cu + Sn', baseColor: COPPER_COLOR, dopantColor: 0xd8d8d0, dopantCount: 2 }, // Sn in Cu -- Sn: real pale tin color
];
const FCC_ALLOY_STAGES = FCC_ALLOY_DEFS.map((def, i) => ({
  id: 96 + i,
  name: `Alloy: ${def.name} (${def.formula})`,
  derivedFrom: [{ id: 85, tier: 'Big Hull' }],
  build: (scale) => buildFCCDiluteAlloyStage(scale, CUBOCTAHEDRON_CELLS, def.baseColor, def.dopantColor, def.dopantCount),
}));

// Salt (NaCl, rock-salt/B1 structure) -- 2026-09-05, direct instruction
// ("household materials like salt etc"), built on the new
// `geometry-extensions/rock-salt-lattice.js` (scoped, created, and
// numerically self-verified this same session -- see that file's own
// standalone sanity gate). A GENUINELY different real structure from
// every Alloy stage above: those are all real coordination shells of
// ONE species (BCC or FCC) with a second element substituted in or
// interstitially inserted; NaCl's own defining feature is real
// CROSS-species octahedral coordination -- 1 real cation + its 6 real
// nearest anion neighbors, not same-species neighbors at all. Each
// ion's own real Voronoi cell in this structure is an ordinary CUBE
// (rock-salt-lattice.js's own header explains why: combined, both
// sublattices are a genuine simple-cubic lattice) -- needs no new mesh
// derivation, `THREE.BoxGeometry(scale, scale, scale)` is exactly
// correct at this same `scale` cellToWorld already uses everywhere
// else (cation-anion spacing here is exactly 1 raw lattice unit).
const ROCK_SALT_CELLS = [[0, 0, 0], ...CATION_ANION_OFFSETS];

function buildRockSaltStage(scale, cellOffsets, cationColor, anionColor) {
  const skeletonGroup = new THREE.Group();
  const cubeGeometry = new THREE.BoxGeometry(scale, scale, scale);

  const cellWorldPositions = cellOffsets.map(([cx, cy, cz]) => new THREE.Vector3(...cellToWorld(cx, cy, cz, scale)));
  const centroid = cellWorldPositions.reduce((sum, p) => sum.add(p), new THREE.Vector3()).multiplyScalar(1 / cellWorldPositions.length);
  const cellCenters = cellWorldPositions.map((p) => p.clone().sub(centroid));
  const cellColors = cellOffsets.map(([cx, cy, cz]) => (isCationSite(cx, cy, cz) ? cationColor : anionColor));

  const voids = [];
  cellCenters.forEach((cellCenter, i) => {
    skeletonGroup.add(makeOuterSolid(cubeGeometry, cellCenter, cellColors[i]));
    const v = makeVoid(cubeGeometry, { id: `v-cell-${i}`, position: cellCenter, groupIds: [`cell-${i}`] });
    skeletonGroup.add(...v.sceneObjects);
    voids.push(v);
  });

  const groups = cellCenters.map((center, i) => ({ id: `cell-${i}`, position: center.clone(), quaternion: new THREE.Quaternion() }));
  const pieceSpecs = cellCenters.map((_, i) => ({ id: `single-${i}`, fillsGroup: `cell-${i}`, geometry: cubeGeometry, color: cellColors[i] }));

  // Same physically-motivated key as every other Alloy stage -- the
  // shared central ion can't be recognized as correctly seated until
  // its whole real neighbor shell surrounds it.
  const neighborIds = pieceSpecs.slice(1).map((spec) => spec.id);
  pieceSpecs[0].requiresPlacedFirst = neighborIds;
  pieceSpecs.push({ id: 'decoy-0', fillsGroup: DECOY_NEVER_MATCHES, geometry: cubeGeometry, color: PIECE_COLOR });

  for (let i = pieceSpecs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pieceSpecs[i], pieceSpecs[j]] = [pieceSpecs[j], pieceSpecs[i]];
  }

  const { trayScaleFor, nextTrayPosition } = createTrayLayout(scale, pieceSpecs.length);
  const pieces = pieceSpecs.map((spec) => {
    const trayScale = trayScaleFor(spec.geometry);
    return makeFusedPiece(spec.geometry, {
      id: spec.id,
      fillsGroup: spec.fillsGroup,
      homePosition: nextTrayPosition(spec.geometry, trayScale),
      trayScale,
      color: spec.color,
      requiresPlacedFirst: spec.requiresPlacedFirst,
    });
  });

  return { skeletonGroup, pieces, voids, groups, hideIdleVoidWires: true };
}

// Real reference colors: sodium metal is a soft, bright silvery-white
// (same value already used for BCC_ELEMENTS' own Sodium entry, reused
// for consistency); chlorine gas is a real, well-documented pale
// yellow-green.
const SALT_STAGE = {
  id: 100,
  name: 'Salt: Sodium Chloride (NaCl)',
  derivedFrom: [{ id: 85, tier: 'Big Hull' }],
  build: (scale) => buildRockSaltStage(scale, ROCK_SALT_CELLS, 0xd8d8d0, 0xc9d67a),
};

// Mirrored Molecule -- direct instruction (2026-09-04, "mirrored
// molecules split it into 3 with 3 decoys", confirmed "both could
// work" against two different readings): this is the FIRST reading --
// a molecule whose two lobes are genuine mirror images of each other,
// using `CHIRAL_FIVE_CELL_SHAPES` above. Direct follow-up after the
// first version shipped with just ONE example: "I thought the molecule
// mirroring etc would generate more variants...?" -- there are 8 real
// chiral shapes, not 1, so this now builds all 8, the same "generate
// every real combination, not a hand-picked sample" principle the
// plain Molecules tier already used for its own 28. Reuses
// `buildMoleculeStage` completely unchanged -- it only ever needed
// `{name, cells}` lobe defs, never actual catalog membership, so a
// genuinely different real shape pair (not from
// `MOLECULE_SHAPE_CATALOG` at all) works with zero new stage-building
// code.
const MIRRORED_MOLECULE_STAGES = CHIRAL_FIVE_CELL_SHAPES.map((cells, i) => {
  const lobeA = { name: `Chiral Piece ${i + 1}`, cells };
  const lobeB = { name: `Chiral Piece ${i + 1} (Mirror)`, cells: mirrorCells(cells) };
  return {
    id: 62 + i,
    name: `Mirrored Molecule ${i + 1}`,
    build: (scale) => buildMoleculeStage(scale, lobeA, lobeB, pickMoleculeDecoys(lobeA, lobeB, i * 2)),
  };
});

// Molecule Split -- the SECOND reading of the same instruction: a
// molecule (two real catalog shapes joined, exactly like the plain
// Molecules tier) but reassembled via Big Hull's own irregular 3-way
// partition instead of the clean 2-lobe split -- genuinely different
// solving logic (an irregular region-grown 3-chunk puzzle) over
// genuinely different SOURCE geometry (a real 2-shape composite) from
// what Big Hulls itself uses (a single physically-motivated macro
// shape). Reuses `buildBigHullStage` completely unchanged -- it was
// always generic over `allCells`, never tied to Cuboctahedron/
// Tetrahedral specifically. Same "generate more variants" follow-up as
// Mirrored Molecule above -- 8 real lobe-pairs (a spread across
// `MOLECULE_STAGE_DEFS`' own real 28, not one hand-picked example),
// each joined for real via `joinTwoShapes` and split for real via
// `partitionIntoIrregularChunks`.
const MOLECULE_SPLIT_STAGE_DEFS = [0, 4, 8, 12, 16, 20, 24, 27].map((i) => MOLECULE_STAGE_DEFS[i]);
const MOLECULE_SPLIT_STAGES = MOLECULE_SPLIT_STAGE_DEFS.map(({ lobeA, lobeB }, i) => {
  const cells = joinTwoShapes(lobeA.cells, lobeB.cells);
  return {
    id: 70 + i,
    name: `Molecule Split: ${lobeA.name} (${lobeA.cells.length}) + ${lobeB.name} (${lobeB.cells.length})`,
    build: (scale) => buildBigHullStage(scale, cells, 3, 3),
  };
});

// Reordered 2026-09-04 (direct instruction, "one RD to four RDs should
// be earliest stages... they are so simple", reinforced: "knowing that
// the cube and RD can be composed from pyramids is advanced knowledge...
// so broken down single shapes belong at higher levels... but prior to
// multiple shape interactions yet to come") -- three tiers, in this
// order, not the original 1-6-then-7-15 build order: whole-RD spatial
// arrangement first (1-10, no orientation-matching at all, just "does
// this piece go here"), THEN pyramid decomposition (11-14, the "a shape
// is actually made of smaller pieces" reveal, requiring real 6/12-way
// orientation matching), THEN stages that combine both ideas at once
// (15-16). Every id below is a genuine renumbering, not just a reorder
// of references -- `?stage=N` deep links and the picker both key off
// `id`, not array position, so the two have to move together.
export const STAGES = [
  ONE_CELL_STAGE,
  { id: 2, name: '2 Cells: Joined Pair', build: buildStage7 },
  ...COLOR_MATCH_STAGES,
  ...THREE_CELL_STAGES,
  ...FOUR_CELL_STAGES,
  { id: 15, name: 'One Piece', build: buildStage1 },
  { id: 16, name: 'Octahedron', build: buildStage2 },
  { id: 17, name: 'Cube', build: buildStage3 },
  { id: 18, name: 'Rhombic Dodecahedron', build: buildStage4 },
  { id: 19, name: 'Conjoined Pieces', build: buildStage5 },
  { id: 20, name: 'Multi-Cell', build: buildStage6 },
  ...HULL_STAGES,
  ...MOLECULE_STAGES,
  ...MIRRORED_MOLECULE_STAGES,
  ...MOLECULE_SPLIT_STAGES,
  ...BRANCHING_MOLECULE_STAGES,
  { id: 84, name: 'Rhombic Dodecahedron (Disphenoids)', build: buildDisphenoidRDStage },
  ...BIG_HULL_STAGES,
  ...BURR_PUZZLE_STAGES,
  // Alloy tier sits here, not after the crossover tiers -- direct
  // instruction/self-assessment (2026-09-05, "is insertion position
  // valid for difficulty/challenge level?"): these puzzles' real
  // difficulty comes from the same levers as the plain Burr Puzzle
  // tier right above (a key + a decoy + precise per-slot matching),
  // not the deeper two-mechanisms-at-once complexity of the crossover
  // tiers below -- more pieces, not more reasoning depth. Positioning
  // them after Burr Puzzle (their real difficulty peer) rather than
  // after every crossover tier is the honest read, same principle
  // already applied to Color Match's own positioning earlier.
  ...BCC_ALLOY_STAGES,
  ...DILUTE_ALLOY_STAGES,
  CARBON_STEEL_STAGE,
  ...FCC_ALLOY_STAGES,
  SALT_STAGE,
  ...BURR_MOLECULE_SPLIT_STAGES,
  ...BURR_MIRRORED_MOLECULE_STAGES,
  ...BURR_BRANCHING_MOLECULE_STAGES,
  ...DISPHENOID_KEY_HULL_STAGES,
  ...CRYSTAL_STAGES,
  ONE_BCC_STAGE,
  ...BCC_CRYSTAL_STAGES,
];
