// Icon System (RHOMBIVERSE_SPEC_ICON_SYSTEM.md): geometry-native marks
// for the Rhombic Wheel's faces, replacing plain text labels. Every mark
// is built from the hexagon/rhombus vocabulary already native to this
// project (RHOMBIVERSE_PRINCIPLES.md's "Grounded Simplicity"), computed
// from real trig, not hand-eyeballed pixel coordinates -- see the
// generator this file's marks were computed with, referenced in
// docs/code-notes/app/wheel-icons.md. Full design rationale there too.
//
// Frame (spec section 2): a regular hexagon -- this SAME outline IS
// "the one hexagon" a single-hexagon mark (e.g. Rhombi-model's "+
// inside one hexagon") refers to, no redundant nested hexagon drawn for
// those. Multi-hexagon/multi-rhombus marks draw their own smaller
// shapes inside it. Originally paired with a circumscribing circle
// (the hexagon's vertices legitimately sit on its circumscribed
// circle, real geometry not a decorative border) -- dropped 2026-09-02,
// direct report ("makes it messy like construction lines") once Smooth
// (a real hexagon-in-circle mark, see below) made the frame's own
// circle read as a redundant echo on every single icon, not just that
// one.

const D2R = Math.PI / 180;
function hexPts(R, cx = 0, cy = 0, startDeg = -90) {
  return [0, 1, 2, 3, 4, 5]
    .map((i) => {
      const a = (startDeg + 60 * i) * D2R;
      return `${(cx + R * Math.cos(a)).toFixed(2)},${(cy + R * Math.sin(a)).toFixed(2)}`;
    })
    .join(' ');
}
function rhombusPts(w, h, cx = 0, cy = 0) {
  return [[0, -h / 2], [w / 2, 0], [0, h / 2], [-w / 2, 0]]
    .map(([x, y]) => `${(cx + x).toFixed(2)},${(cy + y).toFixed(2)}`)
    .join(' ');
}
function octPts(R, cx = 0, cy = 0, startDeg = -90) {
  return [0, 1, 2, 3, 4, 5, 6, 7]
    .map((i) => {
      const a = (startDeg + 45 * i) * D2R;
      return `${(cx + R * Math.cos(a)).toFixed(2)},${(cy + R * Math.sin(a)).toFixed(2)}`;
    })
    .join(' ');
}

// Mini shape generators, each a small (radius R, centered at cx,cy)
// version of a piece tier's own real full-size mark (pieceRD/pieceCube/
// piecePyramid/pieceTO/pieceOctaSite/pieceDisphenoid below) -- used by
// clusterIcon() to build a "N small real shapes around a shared center"
// glyph. Kept separate from the full-size marks (not literally the same
// function called at 2 radii) since a couple of the full-size marks
// have their own bespoke proportions (e.g. pieceRD is filled, not
// outlined) that don't miniaturize cleanly as a pure scale-down.
const THIN_1 = 'stroke="currentColor" stroke-width="1.4" fill="none"';
function miniHex(R, cx, cy) { return `<polygon points="${hexPts(R, cx, cy)}" fill="currentColor"/>`; }
function miniSquare(R, cx, cy) {
  return `<polygon points="${cx - R},${cy - R} ${cx + R},${cy - R} ${cx + R},${cy + R} ${cx - R},${cy + R}" ${THIN_1}/>`;
}
function miniTriangle(R, cx, cy) {
  return `<polygon points="${cx},${cy - R} ${cx + R},${cy + R * 0.55} ${cx - R},${cy + R * 0.55}" ${THIN_1}/>`;
}
function miniOct(R, cx, cy) { return `<polygon points="${octPts(R, cx, cy)}" ${THIN_1}/>`; }
function miniKite(R, cx, cy) {
  return `<polygon points="${cx},${cy - R} ${cx + R * 0.6},${cy} ${cx},${cy + R} ${cx - R * 0.6},${cy}" ${THIN_1}/>`;
}
function miniTet(R, cx, cy) {
  const top = `${cx},${cy - R}`, bl = `${cx - R * 0.87},${cy + R * 0.6}`, br = `${cx + R * 0.87},${cy + R * 0.6}`;
  const inner = `${cx},${cy + R * 0.15}`;
  return `<polygon points="${top} ${br} ${bl}" ${THIN_1}/><path d="M${top} L${inner} M${bl} L${inner} M${br} L${inner}" stroke="currentColor" stroke-width="1" opacity="0.7"/>`;
}

// Arranges any number of mini shapes evenly around a shared center --
// the "hexagons (well, clusters) can grow" helper: adding a 7th piece
// tier later means adding one more shapeFn to the array passed in, not
// hand-picking new coordinates. Used for pieceType below; general
// enough to reuse for any future N-item cluster glyph.
function clusterIcon(shapeFns, { R = 24, shapeR = 9, startDeg = -90 } = {}) {
  const n = shapeFns.length;
  return shapeFns.map((fn, i) => {
    const a = (startDeg + (360 / n) * i) * D2R;
    return fn(shapeR, R * Math.cos(a), R * Math.sin(a));
  }).join('\n    ');
}

const FRAME_R = 46; // frame circle/hexagon radius; viewBox is -50..50

// Home mark's own hexagon (see MARKS.home below). First attempt reused
// the hexagon's own two vertical side edges as the H's uprights
// directly (they exist for free at x = ±R*cos(30deg)) -- rendered and
// rejected live: at a regular hexagon's own proportions those edges are
// short and far apart (the hexagon's widest point), so a crossbar
// between them read as a hexagon sliced in half, not a letter. A real,
// separately-proportioned H (narrower, taller) sized to sit inside the
// hexagon reads correctly instead.
const HOME_HEX_R = 28;
const HOME_H_HALF_W = 14;
const HOME_H_HALF_H = 16;

// The frame itself: the universal hexagon outline. `inner` is the
// concept-specific mark, drawn on top, sharing the same coordinate
// space (all marks below are authored in this same -50..50 space).
export function iconFrame(inner, { title } = {}) {
  return `<svg viewBox="-50 -50 100 100" width="1em" height="1em" role="img"${title ? ` aria-label="${title}"` : ''}>
  <polygon points="${hexPts(FRAME_R)}" fill="none" stroke="currentColor" stroke-width="2"/>
  ${inner}
</svg>`;
}

const STROKE = 'stroke="currentColor" stroke-width="3" stroke-linecap="round" fill="none"';
const THIN = 'stroke="currentColor" stroke-width="2" fill="none"';

// --- Marks, one per resolved concept in the spec's section 4 table ---
export const MARKS = {
  // Add / Remove (universal, direct instruction 2026-08-26 -- retired the
  // separate Rhombi-/Pyramid-/Cube- model/sculpt buttons in favor of ONE
  // pair, piece-tier-aware via the new `pieceType` picker below). "+"/"-"
  // inside one hexagon (the frame's own) -- generic enough already that
  // no new icon was needed, just a new meaning attached to the same mark.
  add: `<path d="M0,-18 V18 M-18,0 H18" ${STROKE}/>`,
  remove: `<path d="M-18,0 H18" ${STROKE}/>`,
  // Piece picker (RD / Cube / Pyramid / TO / Octahedron Site /
  // Disphenoid): a small version of each tier's own real shape --
  // literal, matching this file's own vocabulary, not a new abstract
  // symbol for "pick a tier." Direct instruction 2026-08-26: clustered
  // around a shared center (same layout `almanac` below already uses
  // for its own four diamonds) rather than spread out, so switching
  // between tiers reads as moving between neighbors, not hopping across
  // the icon. Grew from 4 to 6 shapes 2026-08-28 when the BCC
  // interstitial-lattice tiers were added -- via clusterIcon() (see its
  // own comment above), not by hand-placing 2 more coordinates, so the
  // NEXT tier this grows to won't need hand-placing either.
  pieceType: clusterIcon([miniHex, miniSquare, miniTriangle, miniOct, miniKite, miniTet]),
  // Same 4 shapes as pieceType above, each on its own -- for the Piece
  // picker's own strip items (direct instruction 2026-08-26: reskin the
  // picker to read as part of the wheel's own visual language, not a
  // flat, disconnected 2D popup). Centered/full-size rather than
  // clustered small, since each stands alone in its own frame here.
  // A same-orientation outline hexagon here would violate this file's
  // own documented rule (see header): it'd be nearly indistinguishable
  // from the frame's own hexagon (R=46 vs R=30, both outline-only, same
  // rotation), reading as "no mark at all" in a picker where RD needs
  // to stand out next to Cube/Pyramid/TO's own clearly-different
  // shapes. Real bug found live (2026-08-28): that's exactly what the
  // old `hexPts(30)` outline did. Fixed the same way `home`'s own
  // single-hexagon mark already solves this (filled, not outlined).
  pieceRD: `<polygon points="${hexPts(22)}" fill="currentColor"/>`,
  pieceCube: `<polygon points="-24,-24 24,-24 24,24 -24,24" ${THIN}/>`,
  piecePyramid: `<polygon points="0,-28 27,14 -27,14" ${THIN}/>`,
  pieceTO: `<polygon points="${octPts(28)}" ${THIN}/>`,
  // Octahedron Site / Disphenoid (BCC interstitial-site tessellation,
  // added 2026-08-28): literal shapes again, matching this file's own
  // rule -- a tall kite/diamond with a horizontal midline for the
  // flattened octahedron (2 close apexes top/bottom, 4-point equatorial
  // "ring" the midline stands in for -- distinct from Cube's square and
  // TO's regular octagon), and a wireframe (not flat-outline) triangle
  // for the disphenoid -- an interior vertex with 3 lines to the outer
  // triangle's own corners, the standard way to draw a tetrahedron in
  // 2D, deliberately different from Pyramid's plain flat-outline triangle.
  pieceOctaSite: `<polygon points="0,-32 20,0 0,32 -20,0" ${THIN}/><path d="M-20,0 H20" stroke="currentColor" stroke-width="1.5" opacity="0.6"/>`,
  pieceDisphenoid: `<polygon points="0,-30 26,20 -26,20" ${THIN}/><path d="M0,-30 L0,4 M-26,20 L0,4 M26,20 L0,4" stroke="currentColor" stroke-width="1.5"/>`,
  // Octahedron (Cuboctahedron gap-fill piece, added 2026-08-31): direct
  // user request -- a plain square (same outline as pieceCube, since the
  // shape's own silhouette is axis-aligned and square-like from most
  // angles) with a cross through it, to read as clearly distinct from
  // bare Cube at a glance.
  pieceOctahedron: `<polygon points="-24,-24 24,-24 24,24 -24,24" ${THIN}/><path d="M-24,0 H24 M0,-24 V24" stroke="currentColor" stroke-width="1.5"/>`,
  // Real bug fixed 2026-09-23, direct report ("it keeps saying RD
  // however many times i select elongated"): every piece added this
  // session (Elongated Dodecahedron, Hex Prism, RD Quarter, Square/
  // Hexagon/Triangle 2D, Rhombohedra) was missing from PIECE_MARK_KEY
  // below, so the bottom-left "current shape" quick-select icon always
  // fell back to pieceRD's own mark regardless of which of these was
  // actually selected -- the REAL placement was always correct (own
  // store, own geometry, verified independently), only this always-
  // visible indicator was silently lying about what was selected.
  //
  // Elongated Dodecahedron: an elongated (taller than wide) hexagon
  // outline -- the real distinguishing feature (4 real hexagonal
  // faces, see that piece's own geometry header) stretched to hint at
  // the actual elongation, unlike pieceRD's own plain filled hexagon.
  pieceElongDodeca: `<polygon points="${hexPts(20, 0, 0, -90).split(' ').map((p) => { const [x, y] = p.split(',').map(Number); return `${x.toFixed(2)},${(y * 1.45).toFixed(2)}`; }).join(' ')}" ${THIN}/>`,
  // Hex Prism: a plain hexagon outline plus 2 vertical side lines,
  // reading as "hexagon extruded into a prism" -- distinct from both
  // pieceRD's filled hexagon and Elongated Dodecahedron's stretched one.
  pieceHexPrism: `<polygon points="${hexPts(20)}" ${THIN}/><path d="M-17,-10 V10 M17,-10 V10" stroke="currentColor" stroke-width="1.5" opacity="0.6"/>`,
  // Rhombohedra: a real skewed parallelogram (not the symmetric kite
  // rhombusPts() draws elsewhere), matching a rhombohedron's own
  // non-orthogonal silhouette.
  pieceRhombohedron: `<polygon points="-22,10 -6,-22 22,-10 6,22" ${THIN}/>`,
  // RD Quarter: shared pieceRhombohedron's mark until 2026-09-24, direct
  // request for its own -- a hexagon outline with a "Mercedes" Y whose
  // 3 spokes run to 3 alternate corners.
  // 4D cells (2026-09-24, provisional marks pending the user's own
  // sign-off): 24-cell = hexagon (its RD-outline shadow) with a filled
  // inner triangle; 16-cell = the cross-polytope's square-with-cross.
  piece24Cell: `<polygon points="${hexPts(20)}" ${THIN}/><polygon points="0,-10 8.66,5 -8.66,5" fill="currentColor" opacity="0.5"/>`,
  // Tesseract: the classic cube-in-a-cube shadow.
  pieceTesseract: `<polygon points="-22,-22 22,-22 22,22 -22,22" ${THIN}/><polygon points="-10,-10 10,-10 10,10 -10,10" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M-22,-22 L-10,-10 M22,-22 L10,-10 M22,22 L10,10 M-22,22 L-10,10" stroke="currentColor" stroke-width="1.5" opacity="0.6"/>`,
  // Hyper-pyrochlore (A4): the 5-cell's own shadow is a pentagon with its
  // pentagram (every corner joined to every other); truncated = the
  // pentagon with its corners cut; bitruncated = cut pentagon inside a
  // cut pentagon.
  piece5Cell: `<polygon points="0,-22 20.9,-6.8 12.9,17.8 -12.9,17.8 -20.9,-6.8" ${THIN}/><path d="M0,-22 L12.9,17.8 L-20.9,-6.8 L20.9,-6.8 L-12.9,17.8 Z" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.6"/>`,
  pieceTrunc5Cell: `<polygon points="-6.5,-17.3 6.5,-17.3 16.9,-9.8 20.9,2.5 16.9,14.7 6.5,17.8 -6.5,17.8 -16.9,14.7 -20.9,2.5 -16.9,-9.8" ${THIN}/><polygon points="0,-8 7.6,5 -7.6,5" fill="currentColor" opacity="0.45"/>`,
  pieceBitrunc5Cell: `<polygon points="-6.5,-17.3 6.5,-17.3 16.9,-9.8 20.9,2.5 16.9,14.7 6.5,17.8 -6.5,17.8 -16.9,14.7 -20.9,2.5 -16.9,-9.8" ${THIN}/><polygon points="-3.2,-8.6 3.2,-8.6 8.4,-4.9 10.4,1.2 8.4,7.3 3.2,8.9 -3.2,8.9 -8.4,7.3 -10.4,1.2 -8.4,-4.9" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.7"/>`,
  piece16Cell: `<polygon points="0,-22 22,0 0,22 -22,0" ${THIN}/><path d="M0,-22 V22 M-22,0 H22" stroke="currentColor" stroke-width="1.5" opacity="0.6"/>`,
  pieceRDQuarter: `<polygon points="${hexPts(20)}" ${THIN}/><path d="M0,0 V-20 M0,0 L17.32,10 M0,0 L-17.32,10" stroke="currentColor" stroke-width="1.5"/>`,
  // Pyrochlore (3D Kagome): the truncated tetrahedron's own silhouette --
  // a tetrahedron (faint outer triangle) with its corners cut off at the
  // real 1/3 points, leaving the hexagon face that makes it Kagome-like.
  piecePyrochlore: `<polygon points="0,-24 20.78,12 -20.78,12" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.4"/><polygon points="-6.93,-12 6.93,-12 13.86,0 6.93,12 -6.93,12 -13.86,0" ${THIN}/>`,
  // 2D lattice tier (Phase 3): one icon PER PRIMITIVE, shared across
  // every named angle that primitive can appear at (this glyph shows
  // which primitive construction is active, not the exact angle -- a
  // full per-angle icon set for all combinations wasn't asked for and
  // would mostly just be minor skew variations of these same shapes;
  // every LATTICE_PRIMITIVES entry reaches every named angle now --
  // Rhombille, the one exception, isn't a primitive of its own at all,
  // just a contextual arrangement toggle under Parallelogram, so it
  // never needed its own icon here; see lattice-2d.js's own
  // RHOMBILLE_ANGLE_ID). Replaces the old pieceSquare2D/pieceHexagon2D/
  // pieceTriangle2D keys (formerly hardcoded to exactly 90/some-hex/60
  // degrees) with primitive-named ones matching lattice-2d.js's own
  // LATTICE_PRIMITIVES ids.
  //
  // Parallelogram: a plain square outline, PLUS a horizontal midline --
  // reads as "a flat tile," distinct from pieceCube's own bare square
  // (a real 3D solid) and pieceOctahedron's crossed square.
  piece2dParallelogram: `<polygon points="-22,-22 22,-22 22,22 -22,22" ${THIN}/><path d="M-22,0 H22" stroke="currentColor" stroke-width="1.5" opacity="0.6"/>`,
  // Hexagon (the lattice's own Voronoi cell): a flatter (wider than
  // tall) hexagon outline -- deliberately the opposite proportion from
  // Elongated Dodecahedron's own stretched-tall one, and undecorated
  // unlike Hex Prism's.
  piece2dHexagon: `<polygon points="${hexPts(20, 0, 0, 0).split(' ').map((p) => { const [x, y] = p.split(',').map(Number); return `${x.toFixed(2)},${(y * 0.8).toFixed(2)}`; }).join(' ')}" ${THIN}/>`,
  // Triangle: a plain flat equilateral triangle outline -- deliberately
  // undecorated/symmetric, distinct from piecePyramid's own taller
  // "peaked" triangle (a real 3D apex, not a flat 2D tile).
  piece2dTriangle: `<polygon points="0,-24 21,12 -21,12" ${THIN}/>`,
  // Kite: a classic 4-point kite silhouette (short top, wide middle, long
  // bottom "tail") -- readable at a glance, not a literal render of the
  // actual construction (center/edge-midpoint/vertex/edge-midpoint --
  // same simplification piece2dHexagon's own "flatter than the real
  // Voronoi cell" already takes).
  piece2dKite: `<polygon points="0,-24 14,-2 0,24 -14,-2" ${THIN}/>`,
  // Kagome: the Star of David -- a hexagon with all 6 of its triangles,
  // exactly what one placed Kagome hexagon renders as since the 2026-09-24
  // fix (the old icon, a hexagon with 2 flanking triangles, drew the
  // broken model that fused into a plain rhombus). Two overlapping
  // triangles, with the central hexagon they share lightly filled.
  piece2dKagome: `<polygon points="-6.93,-12 6.93,-12 13.86,0 6.93,12 -6.93,12 -13.86,0" fill="currentColor" opacity="0.25"/><polygon points="0,-24 20.78,12 -20.78,12" ${THIN}/><polygon points="0,24 20.78,-12 -20.78,-12" ${THIN}/>`,
  // Fill: "+" shown across three hexagons.
  fill: `
    <polygon points="${hexPts(16, -26, 0)}" ${THIN}/>
    <polygon points="${hexPts(16, 0, 0)}" ${THIN}/>
    <polygon points="${hexPts(16, 26, 0)}" ${THIN}/>
    <path d="M0,-9 V9 M-9,0 H9" ${STROKE}/>`,
  // Dig: direct report 2026-09-02 -- "the symbol it replaced [Alter's
  // old borrowed icon] seems to be doing double duty as dig." Confirmed
  // live: the old mark (three hexagons, a bare "-" at center) was
  // nearly identical to Fill's own mark (same three hexagons, a "+" at
  // center) -- the only difference was a barely-visible center glyph,
  // not two distinct symbols for two different tools. Redrawn as
  // concentric shells -- same radii as MARKS.shellBrush below (14/24/34,
  // a real shared scale, not arbitrary), outer two solid (real, kept
  // material), innermost dashed (excavated/absent) -- directly depicts
  // what Dig actually does (hollow a shell-built structure down to a
  // chosen radius), distinct from Fill's own "add material" cross at a
  // glance.
  dig: `
    <polygon points="${hexPts(34)}" ${THIN}/>
    <polygon points="${hexPts(24)}" ${THIN}/>
    <polygon points="${hexPts(14)}" stroke="currentColor" stroke-width="1.6" stroke-dasharray="3 3" fill="none"/>`,
  // Alter (wheel-doorway face, "navigateTo:alter"): direct request
  // 2026-09-02, "should change to be like six segment recycling
  // symbol" -- was reusing Dig's own mark (its first of 4 tools),
  // reasonable at the time but not a real symbol of its own. 6 chevron
  // arrows at true 60-degree rotational symmetry (computed from trig,
  // not eyeballed), each a 2-segment bent line ending in a solid
  // arrowhead -- reshaping/reclaiming existing structure, the same
  // idea a recycling symbol stands for. Went through 4 live-reviewed
  // rounds against a real proof-sheet artifact: 3 arrows read "too
  // thin," 6 arrows at stroke-width 9 "too chunky, crowds the frame,"
  // scaled in to fit with real margin, then thinned again ("slightly
  // more delicate") to the final stroke-width 3.2 below.
  alter: `
    <g stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" fill="currentColor">
      <path d="M1.15,-10.94 L10.8,-20.31 L17.09,-15.39" fill="none"/>
      <polygon points="13.14,-12.77 21.82,-11.7 18.68,-19.86"/>
      <path d="M10.05,-4.47 L22.99,-0.8 L21.87,7.11" fill="none"/>
      <polygon points="17.63,5 21.04,13.05 26.54,6.25"/>
      <path d="M8.9,6.47 L12.19,19.51 L4.78,22.5" fill="none"/>
      <polygon points="4.49,17.76 -0.78,24.75 7.86,26.11"/>
      <path d="M-1.15,10.94 L-10.8,20.31 L-17.09,15.39" fill="none"/>
      <polygon points="-13.14,12.77 -21.82,11.7 -18.68,19.86"/>
      <path d="M-10.05,4.47 L-22.99,0.8 L-21.87,-7.11" fill="none"/>
      <polygon points="-17.63,-5 -21.04,-13.05 -26.54,-6.25"/>
      <path d="M-8.9,-6.47 L-12.19,-19.51 L-4.78,-22.5" fill="none"/>
      <polygon points="-4.49,-17.76 0.78,-24.75 -7.86,-26.11"/>
    </g>`,
  // Smooth: direct report 2026-09-02, "has never been right" -- the old
  // mark (a hexagon with every corner rounded by a small radius) reads
  // almost identically to the frame hexagon drawn behind every icon
  // (same shape family, same silhouette), barely visible as its own
  // symbol. Went through a few rounds of live review before landing
  // here (a filled-band nested pair, then a single filleted-hexagon
  // path, both real attempts but not quite right) -- final direction:
  // "a hex inside a perfect circle outside, [with] the separating lines
  // blended into a thick but as fine as possible boundary." Built as
  // ONE filled shape: evenodd fill between a circle and a hexagon
  // inscribed in it at the exact same circumradius (32, both touching
  // at all 6 vertices) -- the two boundaries merge into a single solid
  // band, hexagonal on the inner edge, circular on the outer edge,
  // tapering to true zero width exactly at the 6 touch points. That
  // taper is the thinnest the band can possibly be while still
  // connecting a hexagon to its own circumscribed circle -- a real
  // geometric consequence of touching at the same radius, not a
  // stroke-width guess. Confirmed "you got it."
  smooth: `<path d="M32,0 A32,32 0 1,0 -32,0 A32,32 0 1,0 32,0 Z M0,-32 L27.71,-16 L27.71,16 L0,32 L-27.71,16 L-27.71,-16 Z" fill="currentColor" fill-rule="evenodd"/>`,
  // Trade: one black rhombus, one white rhombus, "=" between them.
  trade: `
    <polygon points="${rhombusPts(28, 36, -22, 0)}" fill="currentColor"/>
    <polygon points="${rhombusPts(28, 36, 22, 0)}" fill="none" stroke="currentColor" stroke-width="2"/>
    <path d="M-4,-4 H4 M-4,4 H4" ${STROKE}/>`,
  // Blueprint (wheel id "rhombitect", unchanged internally): a pair of
  // dividing compasses -- the precise-coordinate-building theme this
  // wheel is actually about (Dome/Spiral Column/Templates/Generate a
  // Body), drawn as a real drafting tool rather than an abstraction.
  // Replaces a ruled vertical line with 3 ticks, direct report
  // 2026-09-02 ("really dont get what the E even means" -- the 3
  // right-pointing ticks off a vertical spine read exactly as a
  // capital E, not a ruled edge). Pivot joint (filled dot) at top, two
  // straight legs splaying to sharp points, a small curved crossbar
  // partway down suggesting the adjustable hinge real dividers have.
  rhombitect: `
    <circle cx="0" cy="-32" r="4" fill="currentColor"/>
    <path d="M0,-32 L-23,32 M0,-32 L23,32" ${STROKE}/>
    <path d="M-14,0 Q0,8 14,0" stroke="currentColor" stroke-width="2" fill="none"/>`,
  // Cultivate/rhombivate and Explore marks removed 2026-09-22 (second
  // world-building removal pass) along with growth/evolution/cultivation
  // and walking/exploring -- neither action resolves to a mark anymore
  // (see ACTION_TO_MARK, rhombic-wheel-3d-core.js).
  // Lenses: three overlapping upright diamonds.
  lenses: `
    <polygon points="${rhombusPts(24, 31, 0, -12)}" ${THIN}/>
    <polygon points="${rhombusPts(24, 31, -14, 10)}" ${THIN}/>
    <polygon points="${rhombusPts(24, 31, 14, 10)}" ${THIN}/>`,
  // Lattice View: Off -- a plain bold hexagon, real content instead of
  // a blank frame. Direct report 2026-09-02 ("lattice view symbols are
  // still feint on HUD"): the corner HUD wheel's own BCC Lattice face
  // gets its innerHTML overwritten live by render.js's
  // updateLatticeQuickViewIcon() (a real state-sync mechanism, not a
  // bug) -- LATTICE_QUICK_VIEW_MARK_KEY had no 'off' entry, so the
  // default/most-common state rendered an EMPTY iconFrame (just the
  // outline, zero ink) rather than anything faint-but-present. This
  // mark fills that gap; single-symbol sizing (see cyborg/lab above for
  // the same reasoning).
  latticeOff: `<polygon points="${hexPts(32)}" stroke="currentColor" stroke-width="2.5" fill="none"/>`,
  // Almanac: four diamonds arranged around a center point. Enlarged
  // 2026-09-02 (direct report: "almanac ... too small") -- each
  // diamond's own bounding box was small even though the 4-diamond
  // group's overall spread wasn't, reading as sparse/thin rather than
  // bold; 16x16 -> 22x22 per diamond, same 24-unit offset (verified no
  // overlap: each diamond's own half-width/height is 11, well under the
  // 24-unit gap to its neighbors).
  almanac: `
    <polygon points="${rhombusPts(22, 22, 24, 0)}" ${THIN}/>
    <polygon points="${rhombusPts(22, 22, 0, 24)}" ${THIN}/>
    <polygon points="${rhombusPts(22, 22, -24, 0)}" ${THIN}/>
    <polygon points="${rhombusPts(22, 22, 0, -24)}" ${THIN}/>`,
  // Duality: a black diamond nested inside a white diamond, and a white diamond
  // nested inside a black diamond, diagonally opposite.
  duality: `
    <polygon points="${rhombusPts(30, 30, -12, -12)}" fill="none" stroke="currentColor" stroke-width="2"/>
    <polygon points="${rhombusPts(14, 14, -12, -12)}" fill="currentColor"/>
    <polygon points="${rhombusPts(30, 30, 12, 12)}" fill="currentColor"/>
    <polygon points="${rhombusPts(14, 14, 12, 12)}" fill="none" stroke="currentColor" stroke-width="2"/>`,
  // Shell Brush (modifier): concentric hexagon rings.
  shellBrush: `
    <polygon points="${hexPts(14)}" ${THIN}/>
    <polygon points="${hexPts(24)}" ${THIN}/>
    <polygon points="${hexPts(34)}" ${THIN}/>`,
  // Symmetry Mirror (modifier): hexagon (the frame's own) bisected by a
  // mirror line, faint reflected half showing through -- a real
  // translucent fill over the right half (the frame hexagon's own
  // vertices at x>=0: top, upper-right, lower-right, bottom), not
  // low-opacity lines retracing the frame's own edges (invisible against
  // them).
  symmetryMirror: `
    <polygon points="0,-46 39.84,-23 39.84,23 0,46" fill="currentColor" opacity="0.22"/>
    <path d="M0,-46 V46" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 3"/>`,
  // Cyborg: direct request 2026-09-02 -- "a symbolic robot head like
  // from metropolis would suit Cyborg much better" than the plain ◈
  // glyph, "with step pyramid type ears." Researched, not guessed: the
  // Maschinenmensch ("Maria") from Fritz Lang's Metropolis (1927),
  // designed by Walter Schulze-Mittendorff -- Art Deco, a smooth
  // mask-like head (its own look explicitly evokes Tutankhamun's golden
  // funerary mask) over banded/ribbed segmented plating. Sources:
  // reactormag.com/metropolis-a-fever-dream-of-mankind-our-machines-and-
  // maria, mikekalil.com/blog/robot-maria-metropolis,
  // en.wikipedia.org/wiki/Walter_Schulze-Mittendorff.
  //
  // Went through 5 rounds of direct visual review (a proof-sheet
  // artifact, not blind pushes -- ears/head/eyes/neck each got real
  // live feedback before landing here):
  //  v1 (rounded rect + 2 dot eyes + 3 flat collar lines): "not
  //     immediately recognizable as robot, too much neck," and its
  //     head (y=-38..4) sat crowded against the frame's own y=-46 edge.
  //  v2 ("headphone-cup" ears, single gradual taper): "looks like long
  //     corks, not a stepped pyramid" -- the step-width jump (3->9
  //     units) was too gentle against a 16-unit ear to read as blocks.
  //  v3 (2-level jump -- tiny tabs + one huge spike): "worse" -- only 2
  //     real sizes isn't a staircase, just a spike with flat flanges.
  //  v4 (this one): 4 real tiers per half (2/5/8/11 units of
  //     protrusion), each a distinct step, graduating up to the widest
  //     point at the vertical center, mirrored top/bottom -- confirmed
  //     "perfect."
  // Head is a true ellipse (not a rounded rect -- "wanted a bit more
  // beautiful than square"), nudged up slightly off dead-center
  // (cy=-5) per "a little bit more towards top" without repeating v1's
  // crowded extreme. Eyes sized down from the first oval-head pass.
  // Neck: two open rings (not v1's 3 solid bars) -- narrower one next
  // to the head, wider one below, reading as a neck that flares
  // outward going down.
  // Applies everywhere Cyborg appears -- see the matching (simplified
  // for its much smaller render size) SVG in hud-wheel-3d.js's
  // HUD_FACES, replacing that file's own bare ◈ glyph.
  cyborg: `
    <path d="M19,-13 L21,-13 L21,-11 L24,-11 L24,-9 L27,-9 L27,-7 L30,-7 L30,-3 L27,-3 L27,-1 L24,-1 L24,1 L21,1 L21,3 L19,3 Z M-19,-13 L-21,-13 L-21,-11 L-24,-11 L-24,-9 L-27,-9 L-27,-7 L-30,-7 L-30,-3 L-27,-3 L-27,-1 L-24,-1 L-24,1 L-21,1 L-21,3 L-19,3 Z" fill="currentColor"/>
    <ellipse cx="0" cy="-5" rx="20" ry="24" fill="none" stroke="currentColor" stroke-width="3"/>
    <circle cx="-8" cy="-9" r="5.5" fill="currentColor"/>
    <circle cx="8" cy="-9" r="5.5" fill="currentColor"/>
    <ellipse cx="0" cy="22" rx="8" ry="3" fill="none" stroke="currentColor" stroke-width="2.2"/>
    <ellipse cx="0" cy="28" rx="10" ry="3" fill="none" stroke="currentColor" stroke-width="2.2"/>`,

  // --- 2026-08-26 second pass: the actions the spec's own table never
  // resolved. Not in RHOMBIVERSE_SPEC_ICON_SYSTEM.md itself -- designed
  // here, grounded in what each action actually does, same hexagon/
  // rhombus vocabulary, same inset-not-retraced-edges lesson from the
  // rhombitect/symmetryMirror fixes above. See wheel-icons.md.

  // Color (key renamed from `material` 2026-09-23, direct instruction:
  // "it should be color picker/color... etc" -- the wheel face itself
  // is relabeled "Color" now too, see rhombic-wheel-3d-core.js): three
  // real material colors (garnet / glassite / ferrostone, matching
  // render.js's own MATERIAL_COLORS exactly, not arbitrary swatch
  // colors) as small hexagons in the same triangular 3-item cluster
  // layout as Rhombisis's own satellites. Was a same-color hexagon
  // split into 3 opacity-varied wedges before -- direct user report
  // 2026-08-29 that it was hard to identify/remember fixed by
  // deliberately breaking this file's otherwise-monochrome vocabulary
  // here specifically: a color choice is what this icon represents, so
  // real color is what makes this ONE icon memorable, more than any
  // single-color shape could -- every other mark in this file stays
  // currentColor-only.
  color: `
    <polygon points="${hexPts(16, 0, -22)}" fill="#8b2e2e" stroke="currentColor" stroke-width="1" stroke-opacity="0.4"/>
    <polygon points="${hexPts(16, 19.05, 11)}" fill="#bfe3f0" stroke="currentColor" stroke-width="1" stroke-opacity="0.4"/>
    <polygon points="${hexPts(16, -19.05, 11)}" fill="#5a5a5a" stroke="currentColor" stroke-width="1" stroke-opacity="0.4"/>`,
  // Repeat: three small hexagons (same layout as Fill) with a
  // directional arrow instead of Fill's "+" -- shares Fill's "acts
  // across three cells" language, distinguishes the drag GESTURE from
  // Fill's result.
  repeat: `
    <polygon points="${hexPts(16, -26, 0)}" ${THIN}/>
    <polygon points="${hexPts(16, 0, 0)}" ${THIN}/>
    <polygon points="${hexPts(16, 26, 0)}" ${THIN}/>
    <path d="M-30,0 H26 M18,-8 L26,0 L18,8" ${STROKE}/>`,
  // Generate a Body/Plant/Growth Params/Prune marks removed 2026-09-22
  // (second world-building removal pass) along with planetoidgen.js and
  // growth/evolution/cultivation -- none of these actions resolve to a
  // mark anymore (see ACTION_TO_MARK, rhombic-wheel-3d-core.js).
  // Offer: single rhombus with an outward arrow -- giving something away.
  offer: `
    <polygon points="${rhombusPts(26, 34)}" ${THIN}/>
    <path d="M8,0 H30 M22,-7 L30,0 L22,7" ${STROKE}/>`,
  // Accept: single rhombus with an inward arrow -- taking something in.
  accept: `
    <polygon points="${rhombusPts(26, 34)}" ${THIN}/>
    <path d="M30,0 H8 M16,-7 L8,0 L16,7" ${STROKE}/>`,
  // Inventory: hexagon (the frame's own) with a small 2x2 grid of filled
  // squares -- stored items.
  inventory: `
    <rect x="-16" y="-16" width="12" height="12" fill="currentColor"/>
    <rect x="4" y="-16" width="12" height="12" fill="currentColor"/>
    <rect x="-16" y="4" width="12" height="12" fill="currentColor"/>
    <rect x="4" y="4" width="12" height="12" fill="currentColor"/>`,
  // --- Universal-ring gaps (appear on every wheel, not spec-resolved) ---
  // Settings (mark key "lab", unchanged internally): real SVG gear, not
  // the bare ⚙ Unicode glyph. Direct report chain, 2026-09-02: first
  // "too small" (font-size 40, fixed to 64), then "off center"
  // (measured live -- the glyph's own rendered bbox center sat at
  // cy=-5.6, not 0, a real font-metrics quirk, not eyeballing error),
  // then "still a bit small" even at font-size 64/h=71 (same root cause
  // as BCC Lattice's hexagon, c731054: a Unicode glyph can stay
  // visually thin no matter the font-size) -- fixed with a first-pass
  // hand-built SVG (rOuter=40, 8 sharp-pointed teeth), then a direct
  // follow-up: "too big and too simplistic." Redrawn with more care --
  // rOuter 40->30 (smaller), and real trapezoidal teeth (flat tips,
  // flat valleys, computed from real trig, not pointed sawtooth) for an
  // actual cog profile instead of a spiky one. Solid fill, evenodd
  // center hole (r=10), perfectly centered on (0,0) by construction.
  lab: `<path d="M20.33,-8.42 L29.54,-5.21 L29.54,5.21 L20.33,8.42 L24.57,17.21 L17.21,24.57 L8.42,20.33 L5.21,29.54 L-5.21,29.54 L-8.42,20.33 L-17.21,24.57 L-24.57,17.21 L-20.33,8.42 L-29.54,5.21 L-29.54,-5.21 L-20.33,-8.42 L-24.57,-17.21 L-17.21,-24.57 L-8.42,-20.33 L-5.21,-29.54 L5.21,-29.54 L8.42,-20.33 L17.21,-24.57 L24.57,-17.21 Z M10,0 A10,10 0 1,0 -10,0 A10,10 0 1,0 10,0 Z" fill="currentColor" fill-rule="evenodd"/>`,
  // Home: a literal "H" (two uprights + a crossbar, see HOME_HEX_R/
  // HOME_H_HALF_W/HOME_H_HALF_H above) centered inside an outline
  // hexagon -- "H" for Home. Was a plain solid hexagon before; direct
  // user report 2026-08-29 that it read as near-identical to Piece/RD's
  // own solid hexagon (MARKS.pieceRD) fixed by giving Home a real,
  // literal distinguishing mark instead of just varying size/fill.
  // Unlike pieceRD's solid hexagon, Home's is outline (not filled) --
  // the anchor itself rather than a piece sample.
  home: `<polygon points="${hexPts(HOME_HEX_R)}" ${THIN}/><path d="M-${HOME_H_HALF_W},-${HOME_H_HALF_H} V${HOME_H_HALF_H} M${HOME_H_HALF_W},-${HOME_H_HALF_H} V${HOME_H_HALF_H} M-${HOME_H_HALF_W},0 H${HOME_H_HALF_W}" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>`,
  // Cuboctahedron (Lattice Quick-View, added 2026-08-29): a real
  // silhouette, not an arbitrary glyph -- viewed down one of its own
  // 3-fold axes, a cuboctahedron's outline IS a regular hexagon (same
  // hexPts(32) shape pieceRD's own solid hexagon uses, but that one is
  // fully filled with no internal division -- here 3 alternating
  // "slices" are filled and 3 left empty, a real nod to the shape's
  // own 3.4.3.4 vertex figure: alternating triangular and square
  // facets around every vertex). Deliberately distinct from both
  // pieceRD (solid, no pinwheel) and pieceTO (octPts(28), a different
  // vertex count/silhouette entirely).
  cuboctahedron: `
    <polygon points="0,-32 27.71,-16 27.71,16 0,32 -27.71,16 -27.71,-16" ${THIN}/>
    <polygon points="0,0 0,-32 27.71,-16" fill="currentColor" opacity="0.55"/>
    <polygon points="0,0 27.71,16 0,32" fill="currentColor" opacity="0.55"/>
    <polygon points="0,0 -27.71,16 -27.71,-16" fill="currentColor" opacity="0.55"/>`,
  // Hemi RD family (Hemi RD / Hourglass / Corner Cluster / Band Cluster,
  // core/hemisphere-build.js): direct instruction 2026-09-06 ("use the
  // real 3D artifact profiles rendered in 2D and shrunk") -- unlike every
  // other mark in this file, these 4 are not hand-drawn: each is the
  // REAL orthographic silhouette of the actual placed geometry (raw
  // hemisphereSplit() points, no ConvexGeometry/3D-hull step needed --
  // the projected 2D convex hull of a convex solid's own input points IS
  // its true silhouette from any view, a standard property, verified via
  // a real Playwright-rendered comparison sheet before landing here), one
  // real polygon per sub-piece (2 for Hourglass, 3/4 for the clusters),
  // each stroked in the app's own real dark overlay tone (#020206, same
  // literal value rhombic-wheel-3d.js's own overlay background uses) so
  // the individual real facets read as distinct lobes, not one fused
  // blob -- this project's own "edges lined" convention, same reasoning
  // as pieceOctaSite/pieceDisphenoid's internal lines above.
  //
  // Camera choices, all real/verified via the same comparison sheet, not
  // eyeballed: Hemi RD views near-edge-on to its own real split plane
  // (viewDir [1,-1,0.4], up [-1,-1,0] -- the KEPT material's own
  // direction pointed screen-up) so the flat cut face reads as a real
  // flat base with the solid bulk rising above it, direct instruction
  // ("half a grapefruit, sliced plane at bottom" as a VIEW, not a fruit
  // illustration). Hourglass aligns its own bridging axis with screen-up
  // (up [1,1,0], viewDir perpendicular) for a genuinely upright silhouette,
  // direct instruction ("hourglass silhouette, upright"). Corner/Band
  // Cluster share one camera ([1,1,1], up [0,1,0]) deliberately, for
  // family consistency -- lobe COUNT (3 vs 4) is what tells them apart,
  // not a different angle.
  pieceHalfRD: `<polygon points="-32.00,11.76 32.00,11.76 16.00,-11.76 -16.00,-11.76" fill="currentColor" stroke="#020206" stroke-width="1"/>`,
  pieceHourglass: `<polygon points="-32.00,23.13 32.00,23.13 16.00,0.00 -16.00,0.00" fill="currentColor" stroke="#020206" stroke-width="1"/><polygon points="-32.00,-23.13 -16.00,0.00 16.00,0.00 32.00,-23.13" fill="currentColor" stroke="#020206" stroke-width="1"/>`,
  pieceHemi3: `<polygon points="0.00,-4.57 15.84,4.57 31.67,-4.57 31.67,-22.86 15.84,-32.00 0.00,-22.86" fill="currentColor" stroke="#020206" stroke-width="1"/><polygon points="-15.84,22.86 0.00,32.00 15.84,22.86 15.84,4.57 0.00,-4.57 -15.84,4.57" fill="currentColor" stroke="#020206" stroke-width="1"/><polygon points="-31.67,-4.57 -15.84,4.57 0.00,-4.57 0.00,-22.86 -15.84,-32.00 -31.67,-22.86" fill="currentColor" stroke="#020206" stroke-width="1"/>`,
  pieceHemi4: `<polygon points="0.00,0.00 13.86,8.00 27.71,-0.00 27.71,-16.00 13.86,-24.00 0.00,-16.00" fill="currentColor" stroke="#020206" stroke-width="1"/><polygon points="0.00,32.00 13.86,24.00 27.71,16.00 13.86,8.00 0.00,16.00" fill="currentColor" stroke="#020206" stroke-width="1"/><polygon points="-27.71,-16.00 -13.86,-8.00 0.00,-16.00 0.00,-32.00" fill="currentColor" stroke="#020206" stroke-width="1"/><polygon points="-27.71,16.00 -13.86,24.00 0.00,16.00 0.00,0.00 -13.86,-8.00 -27.71,0.00" fill="currentColor" stroke="#020206" stroke-width="1"/>`,
  // Triangle Cluster (hemiTri), added same session: viewed straight down
  // the triangle's OWN plane normal (one of the 4 real body-diagonal
  // axes, [1,1,1] here) -- the canonical face-on view for a flat ring,
  // not just the best-looking of the candidates tried (see this file's
  // own real-projection header above hemi3/hemi4 for the shared method).
  pieceHemiTri: `<polygon points="8.00,13.86 16.00,27.71 32.00,0.00 16.00,0.00" fill="currentColor" stroke="#020206" stroke-width="1"/><polygon points="-16.00,-27.71 -8.00,-13.86 8.00,-13.86 16.00,-27.71" fill="currentColor" stroke="#020206" stroke-width="1"/><polygon points="-32.00,0.00 -16.00,27.71 -8.00,13.86 -16.00,0.00" fill="currentColor" stroke="#020206" stroke-width="1"/>`,
  // Triangle Ring (hemiRing), added same session: same viewing convention
  // as pieceHemiTri (straight down the shared corner axis), but the 3
  // real wedges are mutually touching (a 'wedge2' 2-axis intersection
  // each, see core/hemisphere-build.js's own header) rather than each
  // independently facing a shared anchor -- the real, deliberate visual
  // difference is a SOLID gap-free hexagon here vs. pieceHemi3's 3
  // separated lobes, since that IS the real geometric difference between
  // these two pieces (no anchor cell needed vs. one required).
  pieceHemiRing: `<polygon points="-32.00,0.00 -16.00,27.71 -0.00,0.00 -16.00,-27.71" fill="currentColor" stroke="#020206" stroke-width="1"/><polygon points="-16.00,-27.71 -0.00,0.00 32.00,0.00 16.00,-27.71" fill="currentColor" stroke="#020206" stroke-width="1"/><polygon points="-16.00,27.71 16.00,27.71 32.00,0.00 -0.00,0.00" fill="currentColor" stroke="#020206" stroke-width="1"/>`,
  // World View toggle (Color / Translucent / Skeleton, render.js's
  // #world-view-toggle), direct request: "three rings overlapping."
  // Three equal circles at 120-degree symmetry around center, stroke
  // only -- one ring per mode, the overlap reading as "one control,
  // several ways to look at the same thing" rather than three separate
  // switches.
  worldView: `
    <circle cx="0" cy="-14" r="22" stroke="currentColor" stroke-width="3" fill="none"/>
    <circle cx="12.1" cy="7" r="22" stroke="currentColor" stroke-width="3" fill="none"/>
    <circle cx="-12.1" cy="7" r="22" stroke="currentColor" stroke-width="3" fill="none"/>`,
};

// One filled hexagon in a given real color -- for the bottom-left
// quick-select HUD (render.js), which shows the CURRENTLY active
// color as a live swatch (not MARKS.color's own 3-color "pick
// one" glyph, a different job: an indicator, not an action icon).
// Exported rather than duplicating hexPts()'s geometry at the call
// site, keeping all icon-geometry logic colocated in this one file.
export function swatchMark(hexColor) {
  return `<polygon points="${hexPts(28)}" fill="${hexColor}" stroke="currentColor" stroke-width="1.5" stroke-opacity="0.5"/>`;
}
