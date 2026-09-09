// Real vertex/edge/face counts for a CONVEX polyhedron, derived
// directly from its own point set -- no per-shape hand-typed face
// counts, for Almanac Stage 2 (docs/RHOMBIVERSE_SPEC_ALMANAC.md section
// 5). Method: brute-force supporting-plane test over every point
// triple (fine for the tiny point counts used here -- 24 at most, for a
// truncated octahedron): a triangle of 3 points is a real hull-face
// triangle iff every OTHER point lies on or behind its plane (the same
// side as the point set's own centroid, which is always strictly
// interior for a convex body). Passing triangles are grouped by their
// (outward normal, offset) plane signature -- one group per TRUE
// polygonal face (a square face, for instance, produces several passing
// triangles from different point triples, all sharing the same plane).
// F = number of distinct groups, V = number of unique input points,
// E = V + F - 2 (Euler's formula for any genus-0 convex polyhedron --
// not assumed blindly, cross-checked directly in
// tests/unit/polyhedron-stats.test.mjs).
//
// Verified there against this codebase's own pre-existing, independently
// derived face structure where one already exists: RD's 12 faces
// (core/lattice.js's facePieces()) and the tetragonal disphenoid's 4
// faces (geometry-extensions/interstitial-lattice.js's
// disphenoidFaces()) -- this module's own output matches both exactly.

function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function norm(a) { return Math.hypot(a[0], a[1], a[2]); }

function centroidOf(points) {
  const c = [0, 0, 0];
  for (const p of points) { c[0] += p[0]; c[1] += p[1]; c[2] += p[2]; }
  return [c[0] / points.length, c[1] / points.length, c[2] / points.length];
}

function dedupePoints(points, tol) {
  const unique = [];
  for (const p of points) {
    if (!unique.some((q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) < tol)) unique.push(p);
  }
  return unique;
}

/**
 * Real hull face groups for a point set -- each returned array is the
 * set of point-indices (into the deduped point list) belonging to one
 * true polygonal face. Exported directly (not just the count) so tests
 * can cross-check specific faces, not only face counts.
 */
export function convexFaceGroups(rawPoints, { hullTol = 1e-6, groupTol = 1e-4 } = {}) {
  const points = dedupePoints(rawPoints, hullTol);
  const centroid = centroidOf(points);
  const n = points.length;
  const groups = [];

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      for (let k = j + 1; k < n; k++) {
        const a = points[i], b = points[j], c = points[k];
        let normal = cross(sub(b, a), sub(c, a));
        const mag = norm(normal);
        if (mag < hullTol) continue; // degenerate/colinear triple, no real plane
        normal = normal.map((x) => x / mag);
        // Orient outward: an outward-facing normal points AWAY from the
        // point set's own centroid (always strictly interior for a
        // convex body), so this is a real geometric fact, not a guess.
        if (dot(normal, sub(a, centroid)) < 0) normal = normal.map((x) => -x);
        const offset = dot(normal, a);

        // Supporting-plane test: this triangle is part of the real hull
        // boundary iff every OTHER point sits on/behind this plane.
        let isHullFace = true;
        for (let m = 0; m < n; m++) {
          if (m === i || m === j || m === k) continue;
          if (dot(normal, points[m]) - offset > hullTol) { isHullFace = false; break; }
        }
        if (!isHullFace) continue;

        // Group by plane signature (a coarser tolerance than the hull
        // test itself, so float noise from different point triples on
        // the SAME true plane doesn't split it into false extra groups).
        const round = (x) => Math.round(x / groupTol) * groupTol;
        const sig = `${normal.map(round).join(',')}|${round(offset)}`;
        let group = groups.find((g) => g.sig === sig);
        if (!group) { group = { sig, pointIdx: new Set() }; groups.push(group); }
        group.pointIdx.add(i); group.pointIdx.add(j); group.pointIdx.add(k);
      }
    }
  }

  return groups.map((g) => [...g.pointIdx].map((idx) => points[idx]));
}

/** Real, derived {vertexCount, edgeCount, faceCount} for a convex point set. */
export function computeConvexStats(rawPoints, opts) {
  const points = dedupePoints(rawPoints, opts?.hullTol ?? 1e-6);
  const faceCount = convexFaceGroups(points, opts).length;
  const vertexCount = points.length;
  // Euler's formula (V - E + F = 2) for any genus-0 convex polyhedron.
  const edgeCount = vertexCount + faceCount - 2;
  return { vertexCount, edgeCount, faceCount };
}
