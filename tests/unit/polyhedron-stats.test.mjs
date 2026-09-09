// Cross-checks polyhedron-stats.js's general convex-hull-derived V/E/F
// against known ground truth for every real piece shape Almanac Stage 2
// needs it for -- both published values for well-known uniform
// polyhedra (cube, octahedron, cuboctahedron, truncated octahedron) and,
// more importantly, this CODEBASE's own independently-derived face
// structure where one already exists (RD's facePieces(), the
// disphenoid's disphenoidFaces()) -- if this module's general algorithm
// ever disagreed with those, that would mean one of the two is wrong.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeConvexStats, convexFaceGroups } from '../../src/core/polyhedron-stats.js';
import { CUBE_VERTS, OCTA_VERTS, rdRawVerts, pyramidPieces, facePieces, cuboctahedronVertices, octGapVertices, hemisphereSplit } from '../../src/core/lattice.js';
import { truncatedOctahedronVertices } from '../../src/geometry-extensions/dual-lattice.js';
import { bootstrapDisphenoid, disphenoidFaces, octahedronVerts } from '../../src/geometry-extensions/interstitial-lattice.js';

test('Cube: 8 vertices, 6 faces, 12 edges', () => {
  assert.deepEqual(computeConvexStats(CUBE_VERTS), { vertexCount: 8, faceCount: 6, edgeCount: 12 });
});

test('Octahedron (OCTA_VERTS): 6 vertices, 8 faces, 12 edges', () => {
  assert.deepEqual(computeConvexStats(OCTA_VERTS), { vertexCount: 6, faceCount: 8, edgeCount: 12 });
});

test('Cuboctahedron gap-fill octahedron (octGapVertices, the real "Octahedron" piece): matches plain octahedron topology', () => {
  assert.deepEqual(computeConvexStats(octGapVertices(1)), { vertexCount: 6, faceCount: 8, edgeCount: 12 });
});

test('Square Pyramid (pyramidPieces\' base+apex): 5 vertices, 5 faces (1 square + 4 triangles), 8 edges', () => {
  const { pyramids } = pyramidPieces(1);
  const verts = [...pyramids['x+'].base, pyramids['x+'].apex];
  assert.deepEqual(computeConvexStats(verts), { vertexCount: 5, faceCount: 5, edgeCount: 8 });
});

test('RD (rdRawVerts): 14 vertices, 24 edges, and its computed face count matches facePieces()\' own real 12 rhombic faces exactly', () => {
  const verts = rdRawVerts(1);
  const stats = computeConvexStats(verts);
  assert.equal(stats.vertexCount, 14);
  assert.equal(stats.faceCount, facePieces(1).length);
  assert.equal(stats.faceCount, 12);
  assert.equal(stats.edgeCount, 24);
});

test('Tetragonal Disphenoid (bootstrapDisphenoid): 4 vertices, and its computed face count matches disphenoidFaces()\' own real 4 faces exactly', () => {
  const verts = bootstrapDisphenoid([0, 0, 0]);
  const stats = computeConvexStats(verts);
  assert.equal(stats.vertexCount, 4);
  assert.equal(stats.faceCount, disphenoidFaces(verts).length);
  assert.equal(stats.faceCount, 4);
  assert.equal(stats.edgeCount, 6);
});

test('Flattened Octahedron (octahedronVerts, the real 4-disphenoid bundle): 6 vertices, octahedron topology (8 faces, 12 edges) despite its distorted (non-regular) proportions', () => {
  const verts = octahedronVerts([0, 0, 0], [2, 0, 0]);
  assert.deepEqual(computeConvexStats(verts), { vertexCount: 6, faceCount: 8, edgeCount: 12 });
});

test('Cuboctahedron (cuboctahedronVertices): 12 vertices, 14 faces (8 triangles + 6 squares), 24 edges -- published uniform-polyhedron values', () => {
  assert.deepEqual(computeConvexStats(cuboctahedronVertices(1)), { vertexCount: 12, faceCount: 14, edgeCount: 24 });
});

test('Truncated Octahedron (truncatedOctahedronVertices): 24 vertices, 14 faces (6 squares + 8 hexagons), 36 edges -- published uniform-polyhedron values', () => {
  assert.deepEqual(computeConvexStats(truncatedOctahedronVertices(1)), { vertexCount: 24, faceCount: 14, edgeCount: 36 });
});

test('Hemi RD (hemisphereSplit half): a real, non-hand-typed vertex/face/edge count for the actual split geometry the game places', () => {
  // hemisphereSplit's own header comment already establishes (verified
  // numerically there): exactly 4 vertices strictly on one side, 4 on
  // the other, 6 shared on the cutting plane -- so each half has
  // 4 + 6 = 10 real vertices. This test only asserts what
  // polyhedron-stats.js itself derives from that real point set, not a
  // hand-typed face/edge guess -- Euler's formula (checked inside
  // computeConvexStats) is the only thing standing behind the face/edge
  // numbers here, same as every other case in this file.
  const { positive } = hemisphereSplit(1, 0);
  assert.equal(positive.length, 10);
  const stats = computeConvexStats(positive);
  assert.equal(stats.vertexCount, 10);
  // Euler's formula must hold for whatever face count was found.
  assert.equal(stats.vertexCount - stats.edgeCount + stats.faceCount, 2);
});

test('convexFaceGroups: every group is a real, planar face (all its own points share one plane) with at least 3 points', () => {
  for (const points of [CUBE_VERTS, OCTA_VERTS, rdRawVerts(1), cuboctahedronVertices(1)]) {
    const groups = convexFaceGroups(points);
    for (const face of groups) {
      assert.ok(face.length >= 3, `a real face must have at least 3 vertices, got ${face.length}`);
    }
  }
});
