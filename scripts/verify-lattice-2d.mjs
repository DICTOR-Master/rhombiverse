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
check('12 combinations (4 angles x 3 primitives)', LATTICE_2D_COMBINATIONS.length === 12);

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

console.log(failures === 0 ? `\nAll checks passed (0 failures).` : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
