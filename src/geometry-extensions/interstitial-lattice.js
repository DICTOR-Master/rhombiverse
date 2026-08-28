// BCC interstitial-site tessellation: the real octahedral/tetrahedral
// "hole" geometry of a body-centered-cubic lattice (the same distorted
// sites carbon occupies in alpha-iron), NOT a subdivision of the
// truncated octahedron -- direct user instruction after a computed
// counter-example showed a TO-subpiece decomposition doesn't tile
// cleanly (see LESSONS/commit history for the full derivation). This is
// the genuine Delaunay tessellation of the BCC lattice points
// (dual-lattice.js's isBCC), verified numerically before being written
// here: a real Delaunay triangulation of a real BCC lattice patch (144
// interior simplices) came back with every single cell sharing the exact
// same edge-length signature (four edges at sqrt(3), two opposite edges
// at 2) -- a genuine tetragonal disphenoid, zero exceptions, volumes
// summing exactly to the patch's own convex-hull volume (zero gaps, a
// guarantee of Delaunay triangulation, not something that needed
// separate checking). Full design rationale: docs/code-notes/
// geometry-extensions/interstitial-lattice.md
//
// The "flattened octahedron" (the site materials-science actually names)
// is NOT a separate primitive: it is exactly 4 of these disphenoids
// merged around one shared BCC axis-edge (volume 2.667 = 4 x 0.667,
// confirmed by direct computation) -- so it's implemented here as a
// convenience BUNDLE over 4 canonically-chosen disphenoids, the same
// relationship core/lattice.js's Cube has to its own 6 Pyramid pieces,
// not a competing independent cell. Two candidate octahedra sharing an
// edge with a THIRD axis direction were found to silently claim the same
// underlying disphenoids if both were allowed to exist as independent
// shapes -- the bundle-over-disphenoids model sidesteps that entirely,
// since disphenoids (not octahedra) are the only thing ever actually
// stored.

const SQRT2 = Math.SQRT2;

// A disphenoid "cell" is 4 real BCC lattice points (each an [x,y,z]
// integer triple at the lattice's own subScale=1 index units -- same
// convention bcc-detail-lattice.js already uses for its own BCC points).
// Canonical storage key: sort the 4 points' own string forms so the same
// 4 points always produce the same key regardless of which order they
// were discovered in (bootstrap vs. reflected-across-a-face).
export function disphenoidKey(verts) {
  return verts.map((v) => v.join(',')).slice().sort().join('|');
}

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

// The real, verified growth rule: the neighboring disphenoid across a
// shared triangular face is the mirror-reflection of the excluded 4th
// vertex through that face's own plane -- confirmed against a real
// scipy Delaunay triangulation's own neighbor-index data (not assumed),
// see the module comment above. Always lands back on exact integer
// coordinates for this lattice (rounded defensively against float
// drift, never a real fractional lattice position).
export function reflectAcrossFace(excluded, faceVerts) {
  const [a, b, c] = faceVerts;
  const v1 = sub(b, a);
  const v2 = sub(c, a);
  let n = cross(v1, v2);
  const nLen = norm(n);
  n = [n[0] / nLen, n[1] / nLen, n[2] / nLen];
  const pq = sub(excluded, a);
  const d = dot(pq, n);
  return [
    Math.round(excluded[0] - 2 * d * n[0]),
    Math.round(excluded[1] - 2 * d * n[1]),
    Math.round(excluded[2] - 2 * d * n[2]),
  ];
}

// The 4 faces of a disphenoid, each named by which vertex it excludes --
// so the caller can reflect that excluded vertex through the other 3 to
// grow into the adjacent cell (mirrors resolvePyramidAxisForHit's own
// per-face addressing for the RD's Pyramid pieces).
export function disphenoidFaces(verts) {
  return [0, 1, 2, 3].map((excludeIdx) => ({
    excludeIdx,
    excluded: verts[excludeIdx],
    face: verts.filter((_, i) => i !== excludeIdx),
  }));
}

// Which of a disphenoid's 4 faces a raycast hit landed on, resolved from
// the hit's own outward face normal -- mirrors core/build.js's own
// matchNeighborOffset/matchBCCNeighborOffset (closest-direction match),
// needed here because each disphenoid mesh is built directly from its
// own absolute world vertices (no shared instanced template, no fixed
// per-axis face table the way RD/TO have -- see interstitial-build.js
// for why: unlike RD/TO, adjacent disphenoids are related by rotation/
// reflection, not just translation, so there is no single fixed local
// face-normal set to look up against).
export function resolveFaceForHit(verts, worldNormal) {
  let bestIdx = 0;
  let bestDot = -Infinity;
  for (let excludeIdx = 0; excludeIdx < 4; excludeIdx++) {
    const excluded = verts[excludeIdx];
    const face = verts.filter((_, i) => i !== excludeIdx);
    const [a, b, c] = face;
    let n = cross(sub(b, a), sub(c, a));
    const nLen = norm(n);
    n = [n[0] / nLen, n[1] / nLen, n[2] / nLen];
    // orient outward: away from the excluded vertex
    if (dot(n, sub(excluded, a)) > 0) n = n.map((v) => -v);
    const d = dot(n, worldNormal);
    if (d > bestDot) { bestDot = d; bestIdx = excludeIdx; }
  }
  return bestIdx;
}

// Every disphenoid face contains exactly ONE of the disphenoid's own 2
// length-2 ("axis") edges (proved by construction: the 2 length-2 edges
// are vertex-disjoint opposite edges of the tetrahedron, so excluding
// any single vertex removes one of them entirely and leaves the other
// intact within that face) -- so a clicked FACE unambiguously identifies
// which octahedron bundle (octahedronDisphenoids' own anchor+axisOffset)
// it belongs to, with no competing-axis ambiguity.
export function axisEdgeOfFace(verts, excludeIdx) {
  const face = verts.filter((_, i) => i !== excludeIdx);
  for (let i = 0; i < 3; i++) {
    for (let j = i + 1; j < 3; j++) {
      if (Math.abs(norm(sub(face[i], face[j])) - 2) < 1e-6) {
        const [p, q] = face[i].join(',') < face[j].join(',') ? [face[i], face[j]] : [face[j], face[i]];
        return { anchor: p.slice(), axisOffset: sub(q, p) };
      }
    }
  }
  return null;
}

export function disphenoidNeighborAcrossFace(verts, excludeIdx) {
  const excluded = verts[excludeIdx];
  const face = verts.filter((_, i) => i !== excludeIdx);
  const reflected = reflectAcrossFace(excluded, face);
  return [reflected, ...face];
}

// Bootstrap: seed the first disphenoid near an arbitrary world position,
// anchored to a real BCC lattice point (reusing dual-lattice.js's own
// nearestBCCCell rather than re-deriving that snap) plus a fixed
// canonical axis-edge (+x) and canonical adjacent equatorial pair --
// deterministic, not random, so repeated bootstraps from nearby seeds
// land on compatible/connectable geometry the same way generateBCCLatticePatch
// already does for TOs.
export function bootstrapDisphenoid(anchor) {
  const [x, y, z] = anchor;
  return [
    [x, y, z],
    [x + 2, y, z],
    [x + 1, y + 1, z + 1],
    [x + 1, y + 1, z - 1],
  ];
}

export function disphenoidVertsToWorld(verts, subScale = 1) {
  return verts.map(([x, y, z]) => [x * subScale, y * subScale, z * subScale]);
}

export function disphenoidVolume(verts) {
  const [a, b, c, d] = verts;
  const v1 = sub(b, a);
  const v2 = sub(c, a);
  const v3 = sub(d, a);
  return Math.abs(dot(v1, cross(v2, v3))) / 6;
}

// Octahedron bundle: given an anchor lattice point and one of the 6 BCC
// axis offsets (dual-lattice.js's BCC_NEIGHBOR_OFFSETS axis family,
// magnitude 2 along exactly one coordinate), the 4 canonical disphenoids
// that together reconstruct the real flattened-octahedron interstitial
// site around that shared edge -- general across all 3 axes via the
// same "half the axis offset, +-1 on the other two" rule that produces
// the 4 real equatorial BCC neighbors, not hand-listed per axis.
export function octahedronDisphenoids(anchor, axisOffset) {
  const axis = axisOffset.findIndex((v) => v !== 0);
  const sign = Math.sign(axisOffset[axis]);
  const others = [0, 1, 2].filter((i) => i !== axis);
  const mid = anchor.slice();
  mid[axis] += sign;
  const quad = (s1, s2) => {
    const p = mid.slice();
    p[others[0]] += s1;
    p[others[1]] += s2;
    return p;
  };
  // Cyclic order around the square so consecutive pairs are the 4
  // ADJACENT (not diagonal) quadrant pairs -- diagonal pairs are not
  // real disphenoids of this lattice (verified: only adjacent-corner
  // pairs reproduce the sqrt(3)/sqrt(3)/sqrt(3)/sqrt(3)/2/2 edge pattern).
  const ring = [quad(1, 1), quad(1, -1), quad(-1, -1), quad(-1, 1)];
  const far = anchor.slice();
  far[axis] += 2 * sign;
  const disphenoids = [];
  for (let i = 0; i < 4; i++) {
    disphenoids.push([anchor.slice(), far.slice(), ring[i], ring[(i + 1) % 4]]);
  }
  return disphenoids;
}

export function octahedronVerts(anchor, axisOffset) {
  const axis = axisOffset.findIndex((v) => v !== 0);
  const sign = Math.sign(axisOffset[axis]);
  const others = [0, 1, 2].filter((i) => i !== axis);
  const mid = anchor.slice();
  mid[axis] += sign;
  const quad = (s1, s2) => {
    const p = mid.slice();
    p[others[0]] += s1;
    p[others[1]] += s2;
    return p;
  };
  const far = anchor.slice();
  far[axis] += 2 * sign;
  return [anchor.slice(), far, quad(1, 1), quad(1, -1), quad(-1, -1), quad(-1, 1)];
}

// Standalone sanity gate: `node src/geometry-extensions/interstitial-lattice.js`
if (typeof process !== 'undefined' && process.argv[1] && process.argv[1].endsWith('interstitial-lattice.js')) {
  const bootstrap = bootstrapDisphenoid([0, 0, 0]);
  console.log('bootstrap disphenoid:', bootstrap);
  const vol = disphenoidVolume(bootstrap);
  console.log('volume (expect 0.6667):', vol);
  if (Math.abs(vol - 2 / 3) > 1e-9) throw new Error(`expected volume 2/3, got ${vol}`);

  const edgeLens = [];
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
    edgeLens.push(Math.round(norm(sub(bootstrap[i], bootstrap[j])) * 1e4) / 1e4);
  }
  edgeLens.sort();
  console.log('edge lengths (expect [sqrt3,sqrt3,sqrt3,sqrt3,2,2]):', edgeLens);
  const expected = [Math.sqrt(3), Math.sqrt(3), Math.sqrt(3), Math.sqrt(3), 2, 2].map((v) => Math.round(v * 1e4) / 1e4).sort();
  if (JSON.stringify(edgeLens) !== JSON.stringify(expected)) {
    throw new Error(`edge pattern mismatch: got ${edgeLens}, expected ${expected}`);
  }

  // Growth: reflecting across each face and back should always return to
  // a disphenoid with the SAME canonical key as the original (round trip).
  for (const { excludeIdx } of disphenoidFaces(bootstrap)) {
    const neighbor = disphenoidNeighborAcrossFace(bootstrap, excludeIdx);
    const nVol = disphenoidVolume(neighbor);
    if (Math.abs(nVol - 2 / 3) > 1e-9) throw new Error(`neighbor across face ${excludeIdx} has wrong volume ${nVol}`);
    // reflect back: neighbor's own face (the 3 shared verts) should
    // return the ORIGINAL excluded vertex when re-reflected.
    const shared = neighbor.slice(1);
    const back = reflectAcrossFace(neighbor[0], shared);
    if (JSON.stringify(back) !== JSON.stringify(bootstrap[excludeIdx])) {
      throw new Error(`round-trip reflection failed for face ${excludeIdx}`);
    }
  }
  console.log('growth (face-reflection) round-trip: OK for all 4 faces');

  // Octahedron bundle: 4 disphenoids around the +x axis edge should sum
  // to exactly 4x the single-disphenoid volume, and their union's convex
  // hull should match octahedronVerts' own 6 points.
  const octDisph = octahedronDisphenoids([0, 0, 0], [2, 0, 0]);
  const totalVol = octDisph.reduce((s, d) => s + disphenoidVolume(d), 0);
  console.log('octahedron bundle: 4 disphenoids, total volume (expect 2.6667):', totalVol);
  if (Math.abs(totalVol - 4 * (2 / 3)) > 1e-9) throw new Error(`octahedron bundle volume mismatch: ${totalVol}`);

  const octV = octahedronVerts([0, 0, 0], [2, 0, 0]);
  console.log('octahedron verts:', octV);
  const bundlePts = new Set();
  for (const d of octDisph) for (const p of d) bundlePts.add(p.join(','));
  const octPts = new Set(octV.map((p) => p.join(',')));
  if (bundlePts.size !== octPts.size || [...bundlePts].some((p) => !octPts.has(p))) {
    throw new Error('octahedron bundle vertex set does not match octahedronVerts');
  }
  console.log('octahedron bundle vertex set matches octahedronVerts exactly: OK');

  // resolveFaceForHit: for every face, its own true outward normal must
  // resolve back to that exact face (a hit dead-center on a face should
  // never be attributed to a different one).
  for (const { excludeIdx, excluded } of disphenoidFaces(bootstrap)) {
    const face = bootstrap.filter((_, i) => i !== excludeIdx);
    const [a, b, c] = face;
    let n = cross(sub(b, a), sub(c, a));
    const nLen = norm(n);
    n = [n[0] / nLen, n[1] / nLen, n[2] / nLen];
    if (dot(n, sub(excluded, a)) > 0) n = n.map((v) => -v);
    const resolved = resolveFaceForHit(bootstrap, n);
    if (resolved !== excludeIdx) throw new Error(`resolveFaceForHit mismatch: face ${excludeIdx} resolved as ${resolved}`);
  }
  console.log('resolveFaceForHit: OK for all 4 faces');

  // axisEdgeOfFace: for every face, must find a real length-2 edge, and
  // feeding its {anchor, axisOffset} into octahedronDisphenoids must
  // produce a bundle that actually CONTAINS this exact disphenoid.
  for (const { excludeIdx } of disphenoidFaces(bootstrap)) {
    const edge = axisEdgeOfFace(bootstrap, excludeIdx);
    if (!edge) throw new Error(`axisEdgeOfFace found no axis edge for face ${excludeIdx}`);
    const bundle = octahedronDisphenoids(edge.anchor, edge.axisOffset);
    const bootstrapKey = disphenoidKey(bootstrap);
    const found = bundle.some((d) => disphenoidKey(d) === bootstrapKey);
    if (!found) throw new Error(`octahedron bundle from face ${excludeIdx}'s axis edge does not contain the original disphenoid`);
  }
  console.log('axisEdgeOfFace -> octahedronDisphenoids round-trip: OK for all 4 faces');
  console.log('OK');
}
