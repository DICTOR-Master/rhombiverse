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
import { pyramidGeometry, outwardQuaternion, inwardQuaternion, AXIS_NORMALS, rhombicDodecahedronGeometry, quaternionForOrientationKey } from './geometry.js';
import { PYRAMID_AXES, NEIGHBOR_OFFSETS, cellToWorld } from '../core/lattice.js';
import { enumerateShapes } from './cell-arrangements.js';
import { ANY_SINGLE_CELL_GROUP } from './puzzle-state.js';

export const WIRE_COLOR = 0x6ad0ff;
const PIECE_COLOR = 0xffb35c;
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

function pieceMaterial() {
  return new THREE.MeshStandardMaterial({ color: PIECE_COLOR, roughness: 0.5, metalness: 0.1 });
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
function makeOuterSolid(geometry, position = ORIGIN) {
  const material = new THREE.MeshStandardMaterial({
    color: WIRE_COLOR, transparent: true, opacity: TRANSLUCENT_OPACITY, depthWrite: false, roughness: 0.6,
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
function makePiece(geometry, { id, orientation, orientationOptions, homePosition }) {
  const mesh = new THREE.Mesh(geometry, pieceMaterial());
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
function makeFusedPiece(geometry, { id, fillsGroup, homePosition, trayScale = 1 }) {
  const mesh = new THREE.Mesh(geometry, pieceMaterial());
  mesh.position.copy(homePosition);
  mesh.scale.setScalar(trayScale);
  mesh.userData.pieceId = id;
  return { id, fillsGroup, mesh, homePosition: homePosition.clone(), trayScale };
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

// Every orientation a Stage 4 piece can be turned to: all 6 axes, both
// directions -- 'x+:in', 'x+:out', 'x-:in', ... 12 total (geometry.js's
// quaternionForOrientationKey resolves each to its real quaternion).
const RD_ORIENTATIONS = PYRAMID_AXES.flatMap((axisKey) => [`${axisKey}:in`, `${axisKey}:out`]);

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
// wrong orientation ('x+:in', matching Stage 1's own "starts wrong"
// design) and must be cycled through RD_ORIENTATIONS (tap the selected
// piece again, same flip mechanic Stage 1/2 already use, just a 12-way
// cycle instead of binary) to the void's own `requiredOrientation`
// before it will place. "Inward and outward pyramids look identical
// but sit differently" (the spec's own Stage 4 note) now genuinely
// means the PLAYER has to tell them apart and orient for it, not just
// the raycaster resolving which region was tapped. Needed zero
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
      requiredOrientation: `${axisKey}:in`,
    });
    const vOut = makeVoid(geometry, {
      id: `v-out-${axisKey}`,
      quaternion: outwardQuaternion(axisKey),
      position: facePosition.clone(),
      requiredOrientation: `${axisKey}:out`,
    });
    skeletonGroup.add(...vIn.sceneObjects, ...vOut.sceneObjects);
    return [vIn, vOut];
  });

  const homePosition = new THREE.Vector3(scale * 3.2, 0, 0);
  const pieces = voids.map((_, i) => {
    const p = makePiece(geometry, {
      id: `p${i}`,
      orientation: 'x+:in',
      orientationOptions: RD_ORIENTATIONS,
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
      [['in', inwardQuaternion], ['out', outwardQuaternion]].forEach(([dirLabel, toQuaternion]) => {
        const v = makeVoid(pyramid, {
          id: `v-${groupId}-${dirLabel}-${axisKey}`,
          quaternion: toQuaternion(axisKey),
          position: facePosition,
          groupIds: [groupId],
          requiredOrientation: `${axisKey}:${dirLabel}`,
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
    // (direct instruction 2026-09-03) -- reuses RD_ORIENTATIONS
    // unchanged, since a Stage 6 loose piece is geometrically identical
    // to a Stage 4 one and needs the exact same 12-way in/out cycle.
    const p = makePiece(pyramid, { id: `p${i}`, orientation: 'x+:in', orientationOptions: RD_ORIENTATIONS, homePosition: looseHome });
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
  const decoyPiece = makeFusedPiece(decoyGeometry, {
    id: 'decoy',
    fillsGroup: 'cell-0',
    homePosition: new THREE.Vector3(scale * 4, 0, 0),
  });

  const joinedGeometry = mergeGeometries([
    rhombicDodecahedronGeometry(scale).translate(cellCenters[0].x, cellCenters[0].y, cellCenters[0].z),
    rhombicDodecahedronGeometry(scale).translate(cellCenters[1].x, cellCenters[1].y, cellCenters[1].z),
  ], false);
  const joinedPiece = makeFusedPiece(joinedGeometry, {
    id: 'joined-pair',
    fillsGroup: 'joined-01',
    homePosition: new THREE.Vector3(scale * 4, -scale * 2.6, 0),
  });

  return {
    skeletonGroup,
    pieces: [decoyPiece, joinedPiece],
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
function buildNCellStage(scale, cellLatticeOffsets, joinedPairIndices) {
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
  const singleRDGeometry = rhombicDodecahedronGeometry(scale);
  singleRDGeometry.computeBoundingSphere();
  const MAX_TRAY_RADIUS = singleRDGeometry.boundingSphere.radius * 2.2;

  function trayScaleFor(geometry) {
    geometry.computeBoundingSphere();
    const radius = geometry.boundingSphere.radius;
    return radius > MAX_TRAY_RADIUS ? MAX_TRAY_RADIUS / radius : 1;
  }

  const TRAY_GAP = scale * 0.5;
  let trayCursorY = 0;
  function nextTrayPosition(geometry, trayScale = 1) {
    geometry.computeBoundingSphere();
    const radius = geometry.boundingSphere.radius * trayScale;
    if (trayCursorY !== 0) trayCursorY -= TRAY_GAP;
    trayCursorY -= radius;
    const y = trayCursorY;
    trayCursorY -= radius;
    return new THREE.Vector3(scale * 4, y, 0);
  }

  // Every single here is a geometrically identical whole-RD piece --
  // direct instruction (2026-09-04, "doesn't make sense in real world"):
  // a plain, unmarked single cell should fit ANY open single-cell void,
  // not just the ONE cell it happened to be assigned at build time, the
  // same "identical pieces are interchangeable" property Stage 3's cube
  // pieces already have. ANY_SINGLE_CELL_GROUP (puzzle-state.js) makes
  // placeSelected()/voidValidityForPiece() resolve the ACTUAL target
  // group from whichever void gets tapped, instead of a group id fixed
  // on the piece.
  const pieces = [];
  for (let i = 0; i < n; i++) {
    const geometry = rhombicDodecahedronGeometry(scale);
    pieces.push(makeFusedPiece(geometry, {
      id: `single-${i}`,
      fillsGroup: ANY_SINGLE_CELL_GROUP,
      homePosition: nextTrayPosition(geometry),
    }));
  }

  if (hasJoinedPair) {
    const joinedGeometry = mergeGeometries(
      [ji, jj].map((idx) => rhombicDodecahedronGeometry(scale).translate(cellCenters[idx].x, cellCenters[idx].y, cellCenters[idx].z)),
      false,
    );
    const joinedTrayScale = trayScaleFor(joinedGeometry);
    pieces.push(makeFusedPiece(joinedGeometry, {
      id: 'joined-pair',
      fillsGroup: joinedGroupId,
      homePosition: nextTrayPosition(joinedGeometry, joinedTrayScale),
      trayScale: joinedTrayScale,
    }));
  }

  if (includeFullPiece) {
    const fullGeometry = mergeGeometries(
      cellCenters.map((center) => rhombicDodecahedronGeometry(scale).translate(center.x, center.y, center.z)),
      false,
    );
    const fullTrayScale = trayScaleFor(fullGeometry);
    pieces.push(makeFusedPiece(fullGeometry, {
      id: 'full',
      fillsGroup: 'full',
      homePosition: nextTrayPosition(fullGeometry, fullTrayScale),
      trayScale: fullTrayScale,
    }));
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
const ONE_CELL_STAGE = {
  id: 1,
  name: '1 Cell: One RD',
  build: (scale) => buildNCellStage(scale, [[0, 0, 0]], null),
};

const THREE_CELL_STAGE_DEFS = enumerateShapes(3)[3].map((shape) => ({
  name: classifyThreeCellShape(shape.cells),
  cells: shape.cells,
  joinedPair: findAdjacentCellPair(shape.cells),
}));

const THREE_CELL_STAGES = THREE_CELL_STAGE_DEFS.map((def, i) => ({
  id: 3 + i,
  name: `3 Cells: ${def.name}`,
  build: (scale) => buildNCellStage(scale, def.cells, def.joinedPair),
}));

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
const fourCellShapesRaw = enumerateShapes(4)[4];
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

const FOUR_CELL_STAGES = FOUR_CELL_STAGE_DEFS.map((def, i) => ({
  id: 7 + i,
  name: `4 Cells: ${def.name}`,
  build: (scale) => buildNCellStage(scale, def.cells, def.joinedPair),
}));

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
  ...THREE_CELL_STAGES,
  ...FOUR_CELL_STAGES,
  { id: 11, name: 'One Piece', build: buildStage1 },
  { id: 12, name: 'Octahedron', build: buildStage2 },
  { id: 13, name: 'Cube', build: buildStage3 },
  { id: 14, name: 'Rhombic Dodecahedron', build: buildStage4 },
  { id: 15, name: 'Conjoined Pieces', build: buildStage5 },
  { id: 16, name: 'Multi-Cell', build: buildStage6 },
];
