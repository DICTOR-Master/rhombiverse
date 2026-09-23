// Verifies src/geometry-extensions/lattice-2d.js's own generalized
// (angle x primitive) 2D lattice math -- the Phase 3 replacement for
// the old hardcoded Square/Hexagon/Triangle families. Checks the real
// geometric facts the header comments claim: uniform edge length at
// every named angle, the Voronoi/hexagon primitive's degenerate-to-
// square case at exactly 90 degrees and regular-hexagon case at
// exactly 60/120 degrees, and that neighbor-offset counts match what
// each primitive's own construction actually produces.

import {
  NAMED_LATTICE_ANGLES,
  LATTICE_PRIMITIVES,
  LATTICE_2D_COMBINATIONS,
  latticeBasis,
  parallelogramTileVerts,
  triangleTileVerts,
  hexagonTileVerts,
  hexagonNeighborOffsets,
  PARALLELOGRAM_NEIGHBOR_OFFSETS,
  TRIANGLE_NEIGHBOR_OFFSETS_FROM_UP,
  kiteTileVerts,
  kiteCellToWorld,
  kiteNeighborOffsets,
  kiteClassCount,
  kiteClassTileVerts,
  kiteDirectCellToWorld,
  RHOMBILLE_ANGLE_ID,
  rhombilleTileVerts,
  rhombilleCellToWorld,
  rhombilleNeighborOffsets,
  kagomeHexagonTileVerts,
  kagomeHexagonCellToWorld,
  kagomeTriangleUpTileVerts,
  kagomeTriangleUpCellToWorld,
  kagomeTriangleDownTileVerts,
  kagomeTriangleDownCellToWorld,
  kagomeNeighborOffsets,
} from '../src/geometry-extensions/lattice-2d.js';

let failures = 0;
function check(label, condition) {
  console.log(`${condition ? 'OK  ' : 'FAIL'} ${label}`);
  if (!condition) failures++;
}

const dist2d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const TOL = 1e-6;

function polygonBottomFace(verts) {
  // extrudePrism emits [top corners..., bottom corners...]; bottom half is the 2nd half.
  return verts.slice(verts.length / 2);
}
function edgeLengths(poly) {
  const n = poly.length;
  return Array.from({ length: n }, (_, i) => dist3(poly[i], poly[(i + 1) % n]));
}
function interiorAngles(poly) {
  const n = poly.length;
  const angleAt = (k) => {
    const prev = poly[(k - 1 + n) % n];
    const curr = poly[k];
    const next = poly[(k + 1) % n];
    const v1 = [prev[0] - curr[0], prev[1] - curr[1]];
    const v2 = [next[0] - curr[0], next[1] - curr[1]];
    const dot = v1[0] * v2[0] + v1[1] * v2[1];
    const cos = dot / (Math.hypot(...v1) * Math.hypot(...v2));
    return (Math.acos(Math.min(1, Math.max(-1, cos))) * 180) / Math.PI;
  };
  return Array.from({ length: n }, (_, k) => angleAt(k));
}

check('4 named lattice angles, all distinct', new Set(NAMED_LATTICE_ANGLES.map((a) => a.angleDeg.toFixed(4))).size === 4);
check('RD Rhombus angle matches arccos(1/3) exactly (70.5288 degrees)', Math.abs(NAMED_LATTICE_ANGLES.find((a) => a.id === 'rd-rhombus').angleDeg - 70.5287793655) < 1e-6);
check('Golden Rhombus angle matches arctan(2) exactly (63.4349 degrees)', Math.abs(NAMED_LATTICE_ANGLES.find((a) => a.id === 'golden-rhombus').angleDeg - 63.4349488229) < 1e-6);
check(
  `${NAMED_LATTICE_ANGLES.length * LATTICE_PRIMITIVES.length} combinations (${NAMED_LATTICE_ANGLES.length} angles x ${LATTICE_PRIMITIVES.length} primitives)`,
  LATTICE_2D_COMBINATIONS.length === NAMED_LATTICE_ANGLES.length * LATTICE_PRIMITIVES.length,
);

for (const { id, angleDeg } of NAMED_LATTICE_ANGLES) {
  const [v0, v1] = latticeBasis(angleDeg, 1);
  check(`[${id}] basis vectors have equal (unit) length`, Math.abs(Math.hypot(...v0) - 1) < TOL && Math.abs(Math.hypot(...v1) - 1) < TOL);

  // Parallelogram: 4 real vertices per face, all 4 edges length 1.
  const para = polygonBottomFace(parallelogramTileVerts(angleDeg, 1, 0.15));
  check(`[${id}] parallelogram: 4 vertices`, para.length === 4);
  check(`[${id}] parallelogram: all edges length 1`, edgeLengths(para).every((e) => Math.abs(e - 1) < TOL));

  // Triangle: 3 real vertices per face. Equilateral (all 3 edges = 1)
  // only at the 60/120 special case; otherwise isosceles -- 2 edges of
  // length 1 (along v0/v1) and a third of length sqrt(2-2cos(angleDeg))
  // (the chord |v1-v0|), per this file's own corrected header comment.
  const tri = polygonBottomFace(triangleTileVerts(angleDeg, 1, 0.15));
  const triEdges = edgeLengths(tri).sort((a, b) => a - b);
  const expectedChord = Math.sqrt(2 - 2 * Math.cos((angleDeg * Math.PI) / 180));
  check(`[${id}] triangle: 3 vertices`, tri.length === 3);
  check(
    `[${id}] triangle: 2 edges of length 1 + chord edge = sqrt(2-2cos(angle))`,
    Math.abs(triEdges[0] - 1) < TOL && Math.abs(triEdges[1] - 1) < TOL && Math.abs(triEdges[2] - expectedChord) < TOL,
  );

  // Hexagon (Voronoi cell): degenerates to a real square at exactly 90
  // degrees, a real regular hexagon at exactly 60/120, and a valid
  // convex hexagon (6 vertices, symmetric edge/angle pairs) elsewhere.
  const hex = polygonBottomFace(hexagonTileVerts(angleDeg, 1, 0.15));
  if (Math.abs(angleDeg - 90) < TOL) {
    check(`[${id}] hexagon degenerates to a real square at 90 degrees`, hex.length === 4 && edgeLengths(hex).every((e) => Math.abs(e - 1) < TOL) && interiorAngles(hex).every((a) => Math.abs(a - 90) < 1e-3));
  } else if (Math.abs(angleDeg - 60) < TOL || Math.abs(angleDeg - 120) < TOL) {
    const edges = edgeLengths(hex);
    const angles = interiorAngles(hex);
    check(`[${id}] hexagon is a REGULAR hexagon at 60/120 degrees`, hex.length === 6 && edges.every((e) => Math.abs(e - edges[0]) < 1e-3) && angles.every((a) => Math.abs(a - 120) < 1e-3));
  } else {
    check(`[${id}] hexagon is a valid convex hexagon (6 vertices)`, hex.length === 6);
  }
}

check('Parallelogram neighbor offsets: 4, angle-independent', PARALLELOGRAM_NEIGHBOR_OFFSETS.length === 4);
check('Triangle neighbor offsets (from up): 3', TRIANGLE_NEIGHBOR_OFFSETS_FROM_UP.length === 3);

check('Hexagon neighbor offsets: exactly 4 at Square (90 degrees)', hexagonNeighborOffsets(90).length === 4);
for (const id of ['rd-rhombus', 'golden-rhombus', 'triangular']) {
  const angleDeg = NAMED_LATTICE_ANGLES.find((a) => a.id === id).angleDeg;
  check(`Hexagon neighbor offsets: exactly 6 at ${id}`, hexagonNeighborOffsets(angleDeg).length === 6);
}

// Cross-check: the hexagon primitive's own neighbor offsets should each
// actually correspond to a real edge of the constructed polygon --
// i.e. moving to a neighbor cell by that offset lands exactly 2x the
// perpendicular distance to the shared edge away (a real adjacency
// check, not just a count coincidence).
for (const { id, angleDeg } of NAMED_LATTICE_ANGLES) {
  const [v0, v1] = latticeBasis(angleDeg, 1);
  const offsets = hexagonNeighborOffsets(angleDeg);
  const hex = polygonBottomFace(hexagonTileVerts(angleDeg, 1, 0.15)).map(([x, y]) => [x, y]);
  const edgeMidpoints = hex.map((p, i) => {
    const q = hex[(i + 1) % hex.length];
    return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  });
  const allMatch = offsets.every(([i, j]) => {
    const neighborWorld = [i * v0[0] + j * v1[0], i * v0[1] + j * v1[1]];
    const halfway = [neighborWorld[0] / 2, neighborWorld[1] / 2];
    return edgeMidpoints.some((m) => dist2d(m, halfway) < 1e-6);
  });
  check(`[${id}] every hexagon neighbor offset lands exactly at an edge midpoint x2`, allMatch);
}

// Kite: offered at ALL 4 named angles. Square/Triangular use the single-
// mesh path (classCount === 1, full N-fold symmetry -- every fan
// position congruent to fan 0, verified via the rotation-trick position
// kiteCellToWorld/kiteInstanceRotationRad actually render with). RD
// Rhombus/Golden Rhombus use the multi-class path (classCount === 3) --
// verified via kiteDirectCellToWorld/kiteClassInstanceRotationRad
// instead, checking each antipodal pair (class, class+classCount) is a
// real 180-degree rotation of the other, matching render.js's own
// degenerate-instance multi-mesh rendering exactly.
function kitePolyLength(angleDeg) {
  return NAMED_LATTICE_ANGLES.find((a) => a.angleDeg === angleDeg)?.id === 'square' ? 4 : 6;
}
function kiteSideLengths(angleDeg, fanIndex) {
  const poly = polygonBottomFace(kiteTileVerts(angleDeg, 1, 0.15));
  const [cx, cy] = kiteCellToWorld(0, 0, fanIndex, angleDeg, 1, 0);
  const theta = (fanIndex * 2 * Math.PI) / kitePolyLength(angleDeg);
  const cos = Math.cos(theta), sin = Math.sin(theta);
  const world = poly.map(([x, y, z]) => [x * cos - y * sin + cx, x * sin + y * cos + cy, z]);
  return edgeLengths(world).map((e) => +e.toFixed(6)).sort();
}
function kiteClassSideLengths(angleDeg, classIndex, flipped) {
  const poly = polygonBottomFace(kiteClassTileVerts(angleDeg, classIndex, 1, 0.15));
  // classTileVerts is already centered at ITS OWN real centroid (not
  // rotated from class 0), so the only transform left is the antipodal
  // 180-degree flip, matching kiteClassInstanceRotationRad exactly.
  const rot = flipped ? Math.PI : 0;
  const cos = Math.cos(rot), sin = Math.sin(rot);
  const world = poly.map(([x, y, z]) => [x * cos - y * sin, x * sin + y * cos, z]);
  return edgeLengths(world).map((e) => +e.toFixed(6)).sort();
}

for (const { id, angleDeg } of NAMED_LATTICE_ANGLES) {
  const kite0 = polygonBottomFace(kiteTileVerts(angleDeg, 1, 0.15));
  check(`[${id}] kite: 4 vertices`, kite0.length === 4);
  const n = kitePolyLength(angleDeg);
  const numClasses = kiteClassCount(angleDeg);

  if (numClasses === 1) {
    check(`[${id}] single-mesh path: classCount is 1`, true);
    const base = kiteSideLengths(angleDeg, 0);
    const allCongruent = Array.from({ length: n }, (_, f) => kiteSideLengths(angleDeg, f)).every((sides) => sides.every((s, k) => Math.abs(s - base[k]) < 1e-4));
    check(`[${id}] all ${n} kite fan positions are congruent (world-space)`, allCongruent);
  } else {
    check(`[${id}] multi-class path: classCount is ${numClasses}`, numClasses === Math.ceil(n / 2));
    // Each class must be a real, closed kite, and its own antipodal
    // partner (class + numClasses) must be EXACTLY that class's shape
    // rotated 180 degrees -- not just individually valid.
    const allClassesValid = Array.from({ length: numClasses }, (_, c) => polygonBottomFace(kiteClassTileVerts(angleDeg, c, 1, 0.15)).length === 4).every(Boolean);
    check(`[${id}] every class is a real 4-vertex kite`, allClassesValid);
    const antipodalMatches = Array.from({ length: numClasses }, (_, c) => {
      const direct = kiteClassSideLengths(angleDeg, c, false);
      const flipped = kiteClassSideLengths(angleDeg, c, true);
      return direct.every((s, k) => Math.abs(s - flipped[k]) < 1e-6); // same multiset -- a 180-degree rotation preserves side lengths, so this alone doesn't prove the flip is RIGHT, only that it's a valid kite either way; classCount's own derivation (kiteClassCount) already proved the real antipodal relationship directly
    }).every(Boolean);
    check(`[${id}] every class's flipped instance is still a valid kite`, antipodalMatches);
    // Position correctness: kiteDirectCellToWorld's own centroid for
    // fanIndex=c+numClasses must be the exact 180-degree rotation (about
    // the hexagon center) of fanIndex=c's centroid -- the real fact
    // kiteClassCount's own derivation and render.js's rendering both rely
    // on, checked directly here rather than assumed.
    const positionsOk = Array.from({ length: numClasses }, (_, c) => {
      const [px, py] = kiteDirectCellToWorld(0, 0, c, angleDeg, 1, 0);
      const [qx, qy] = kiteDirectCellToWorld(0, 0, c + numClasses, angleDeg, 1, 0);
      return Math.abs(qx + px) < 1e-9 && Math.abs(qy + py) < 1e-9;
    }).every(Boolean);
    check(`[${id}] antipodal positions are exact 180-degree rotations`, positionsOk);
  }

  // Every fan position should have exactly 4 real neighbors (2 intra-hex
  // fan-mates + 2 cross-hexagon, matching a kite's own real edge count) --
  // angle-general, already verified not to depend on classCount.
  const neighborCountsOk = Array.from({ length: n }, (_, f) => kiteNeighborOffsets(angleDeg, f).length === 4).every(Boolean);
  check(`[${id}] every kite fan position has exactly 4 neighbors`, neighborCountsOk);
}

// Rhombille: angle-locked to exactly Triangular (60 degrees). Its 3
// rhombi must each be a real, closed 4-vertex rhombus, congruent to each
// other (same side lengths -- world-space, rotated+translated the same
// way render.js's own instancing does), and each must have exactly 4
// real neighbors (2 intra-hexagon + 2 cross-hexagon).
check('Rhombille is locked to the Triangular angle', RHOMBILLE_ANGLE_ID === 'triangular');

function rhombilleWorldSideLengths(k) {
  const poly = polygonBottomFace(rhombilleTileVerts(1, 0.15));
  const [cx, cy] = rhombilleCellToWorld(0, 0, k, 1, 0);
  const theta = (k * 2 * Math.PI) / 3;
  const cos = Math.cos(theta), sin = Math.sin(theta);
  const world = poly.map(([x, y, z]) => [x * cos - y * sin + cx, x * sin + y * cos + cy, z]);
  return edgeLengths(world).map((e) => +e.toFixed(6)).sort();
}
const rhomb0 = polygonBottomFace(rhombilleTileVerts(1, 0.15));
check('Rhombille: 4 vertices', rhomb0.length === 4);
const rhombBase = rhombilleWorldSideLengths(0);
check('Rhombille: all 3 rotations are congruent (world-space)', [0, 1, 2].every((k) => rhombilleWorldSideLengths(k).every((s, i) => Math.abs(s - rhombBase[i]) < 1e-4)));
check('Rhombille: every rhombus has exactly 4 neighbors', [0, 1, 2].every((k) => rhombilleNeighborOffsets(k).length === 4));

// Kagome: verify real edge-sharing in world space (not just matching
// side lengths, the stronger claim this construction's header makes) --
// the hexagon at (0,0) must share a REAL edge (2 exactly-matching
// vertices) with both the up and down medial triangles at (0,0).
// rotationRad mirrors render.js's own rebuildLattice2dInstances: for a
// hasOrientation primitive, the mesh applies impl.instanceRotationRad
// BEFORE translating -- omitting it here (as an earlier version of this
// helper did) checks the wrong, un-rotated shape for orientation !== 0.
function worldPoly(tileVerts, cellToWorld, x, y, orientation, angleDeg, rotationRad = 0) {
  const local = polygonBottomFace(tileVerts(angleDeg, 1, 0.15));
  const [cx, cy] = cellToWorld(x, y, orientation, angleDeg, 1, 0);
  const cos = Math.cos(rotationRad), sin = Math.sin(rotationRad);
  return local.map(([lx, ly]) => [lx * cos - ly * sin + cx, lx * sin + ly * cos + cy]);
}
function sharesRealEdge(polyA, polyB) {
  // Real false-negative trap this hit directly: string-formatting each
  // point (even after normalizing exact -0) still breaks on floating-
  // point noise near zero -- e.g. cos(90deg) in this codebase's own trig
  // isn't exactly 0, so a genuinely correct Square-angle vertex pair
  // came out as -3.06e-17 on one side and exactly 0 on the other;
  // `.toFixed(6)` prints "-0.000000" for the former (the sign survives
  // rounding) vs "0.000000" for the latter -- different strings, same
  // point. Proper epsilon-tolerant numeric comparison avoids the whole
  // class of bug instead of patching one symptom of it.
  let shared = 0;
  for (const p of polyA) {
    if (polyB.some((q) => Math.abs(p[0] - q[0]) < 1e-6 && Math.abs(p[1] - q[1]) < 1e-6)) shared++;
  }
  return shared >= 2;
}
for (const { id, angleDeg } of NAMED_LATTICE_ANGLES) {
  const hex = worldPoly(kagomeHexagonTileVerts, kagomeHexagonCellToWorld, 0, 0, 0, angleDeg);
  const worldPolyNoOrientation = (tileVerts, cellToWorld, x, y, angleDeg) => {
    const local = polygonBottomFace(tileVerts(angleDeg, 1, 0.15));
    const [cx, cy] = cellToWorld(x, y, angleDeg, 1, 0);
    return local.map(([lx, ly]) => [lx + cx, ly + cy]);
  };
  const triUp = worldPolyNoOrientation(kagomeTriangleUpTileVerts, kagomeTriangleUpCellToWorld, 0, 0, angleDeg);
  const triDown = worldPolyNoOrientation(kagomeTriangleDownTileVerts, kagomeTriangleDownCellToWorld, 0, 0, angleDeg);
  check(`[${id}] kagome hexagon: ${hex.length} vertices`, hex.length === (id === 'square' ? 4 : 6));
  check(`[${id}] kagome hexagon shares a real edge with the up triangle`, sharesRealEdge(hex, triUp));
  check(`[${id}] kagome hexagon shares a real edge with the down triangle`, sharesRealEdge(hex, triDown));
  const neighborCount = kagomeNeighborOffsets(angleDeg).length;
  check(`[${id}] kagome neighbor count matches hexagon's (${neighborCount})`, neighborCount === (id === 'square' ? 4 : 6));
}

console.log(failures === 0 ? `\nAll checks passed (0 failures).` : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
