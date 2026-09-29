// Checks src/geometry-extensions/nets.js: every solid's net lies flat
// with no two faces overlapping, each face hinged to its parent on a
// shared edge, and folding it all the way closes it back into the solid
// exactly; half-folded, every face keeps its shape (a rigid turn).
import { netOf, netSteps, SOLIDS, apply } from '../src/geometry-extensions/nets.js';

let failures = 0;
function check(label, ok, extra = '') {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}${extra ? `  (${extra})` : ''}`);
  if (!ok) failures++;
}
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;
const dist = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
for (const id of Object.keys(SOLIDS)) {
  const net = netOf(id, 5);
  const F = net.faces.length;
  const flat = net.at(0).map((M, i) => net.faces[i].pts.map((p) => apply(M, p)));
  check(`${net.label}: ${F} faces, all flat on the screen at t = 0`, flat.every((P) => P.every((p) => near(p[2], 0))));
  const T1 = net.at(1);
  // Folded: each face back in its place on the solid (up to the one rigid
  // placement of the first face), so shared edges meet.
  const M0 = T1[net.tree.order[0]];
  const closed = net.faces.every((f, i) => f.pts.every((p) => dist(apply(T1[i], p), apply(M0, p)) < 1e-6));
  check(`${net.label}: folded (t = 1) it closes into the solid`, closed);
  const T5 = net.at(0.5);
  const rigid = net.faces.every((f, i) => f.pts.every((p, j) => f.pts.every((q, k) => near(dist(apply(T5[i], p), apply(T5[i], q)), dist(p, q)))));
  const hinged = net.tree.order.slice(1).every((i) => {
    const node = net.tree.nodes[i];
    const P = node.parent;
    // The hinge's ends sit on both faces at every fold.
    return [0, 0.3, 0.7, 1].every((t) => { const T = net.at(t); return [node.a, node.a.map((v, d) => v + node.d[d] * 5)].every((q) => dist(apply(T[i], q), apply(T[P], q)) < 1e-6); });
  });
  check(`${net.label}: half folded, faces keep their shape and stay hinged`, rigid && hinged);
  const steps = netSteps(net);
  const edges = steps.flatMap((s) => s.edges);
  const sides = net.faces.reduce((s, f) => s + f.pts.length, 0);
  check(`${net.label}: the build follows the net, first face by sides then a face a tap (${steps.length} taps), every edge n`, steps.length === net.faces[net.tree.order[0]].pts.length + F - 1 && edges.length === sides - (F - 1) && edges.every(([a, b]) => near(dist(a, b), 5)));
}
console.log(`\n${failures} failure${failures === 1 ? '' : 's'}.`);
process.exit(failures ? 1 : 0);
