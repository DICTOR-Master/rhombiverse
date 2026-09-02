// Icon System (RHOMBIVERSE_SPEC_ICON_SYSTEM.md): geometry-native marks
// for the Rhombic Wheel's faces, replacing plain text labels. Every mark
// is built from the hexagon/rhombus vocabulary already native to this
// project (RHOMBIVERSE_PRINCIPLES.md's "Grounded Simplicity"), computed
// from real trig, not hand-eyeballed pixel coordinates -- see the
// generator this file's marks were computed with, referenced in
// docs/code-notes/app/wheel-icons.md. Full design rationale there too.
//
// Frame (spec section 2): a circle with a regular hexagon's own 6
// vertices touching it from the inside -- real geometry (a hexagon's
// vertices legitimately sit on its circumscribed circle), not a
// decorative border. This SAME hexagon outline IS "the one hexagon" a
// single-hexagon mark (e.g. Rhombi-model's "+ inside one hexagon")
// refers to -- no redundant nested hexagon drawn for those. Multi-
// hexagon/multi-rhombus marks draw their own smaller shapes inside it.

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

// The frame itself: circle + the universal hexagon outline. `inner` is
// the concept-specific mark, drawn on top, sharing the same coordinate
// space (all marks below are authored in this same -50..50 space).
export function iconFrame(inner, { title } = {}) {
  return `<svg viewBox="-50 -50 100 100" width="1em" height="1em" role="img"${title ? ` aria-label="${title}"` : ''}>
  <circle cx="0" cy="0" r="${FRAME_R}" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.35"/>
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
  // Fill: "+" shown across three hexagons.
  fill: `
    <polygon points="${hexPts(16, -26, 0)}" ${THIN}/>
    <polygon points="${hexPts(16, 0, 0)}" ${THIN}/>
    <polygon points="${hexPts(16, 26, 0)}" ${THIN}/>
    <path d="M0,-9 V9 M-9,0 H9" ${STROKE}/>`,
  // Dig: "-" shown across three hexagons.
  dig: `
    <polygon points="${hexPts(16, -26, 0)}" ${THIN}/>
    <polygon points="${hexPts(16, 0, 0)}" ${THIN}/>
    <polygon points="${hexPts(16, 26, 0)}" ${THIN}/>
    <path d="M-9,0 H9" ${STROKE}/>`,
  // Smooth: hexagon with rounded corners instead of sharp points.
  smooth: `<path d="M0,-40 A10,10 0 0 1 8.66,-35 L34.5,-15 A10,10 0 0 1 34.5,-1 L34.5,15 A10,10 0 0 1 34.5,29 L8.66,35 A10,10 0 0 1 0,40 A10,10 0 0 1 -8.66,35 L-34.5,15 A10,10 0 0 1 -34.5,-1 L-34.5,-15 A10,10 0 0 1 -8.66,-35 Z" ${THIN}/>`,
  // Replace: two overlapping hexagons with a real double-headed arrow at the overlap.
  replace: `
    <polygon points="${hexPts(28, -14, 0)}" ${THIN}/>
    <polygon points="${hexPts(28, 14, 0)}" ${THIN}/>
    <path d="M-8,0 H8 M-8,0 l4,-4 M-8,0 l4,4 M8,0 l-4,-4 M8,0 l-4,4" ${STROKE}/>`,
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
  // Cultivate (mark key "rhombivate", unchanged internally): single
  // rhombus, creased down the center like a leaf/bean. Enlarged
  // 2026-09-02 -- a single-symbol mark like this one is effectively
  // 2-3x smaller than the "same" nominal size next to a mark sharing
  // its hexagon with 2-3 shapes, so it needs to actually dominate the
  // frame the way Add's bold "+" does, not just be "somewhat bigger."
  // 30x40 -> 46x62, outline bumped from the shared THIN (2px) to 2.5px
  // for real single-symbol boldness. Plant/Prune below share this exact
  // shape (documented as deliberately reusing it) so they're enlarged
  // to match, not left inconsistent.
  rhombivate: `
    <polygon points="${rhombusPts(46, 62)}" stroke="currentColor" stroke-width="2.5" fill="none"/>
    <path d="M0,-31 Q9,0 0,31" stroke="currentColor" stroke-width="2.5" fill="none"/>`,
  // Explore: hexagon split diagonally into an arrow shape, with a faint trailing echo of smaller hexagons.
  explore: `
    <polygon points="${hexPts(12, -30, 22)}" stroke="currentColor" stroke-width="1.5" opacity="0.3" fill="none"/>
    <polygon points="${hexPts(17, -14, 12)}" stroke="currentColor" stroke-width="1.5" opacity="0.55" fill="none"/>
    <path d="M-10,10 L28,-28 M28,-28 L28,-8 M28,-28 L8,-28" ${STROKE}/>`,
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
  // mark fills that gap; single-symbol sizing (see rhombivate/cyborg/
  // lab above for the same reasoning).
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

  // Material: three real material colors (garnet / glassite / ferrostone,
  // matching render.js's own MATERIAL_COLORS exactly, not arbitrary
  // swatch colors) as small hexagons in the same triangular 3-item
  // cluster layout as Rhombisis's own satellites. Was a same-color
  // hexagon split into 3 opacity-varied wedges before -- direct user
  // report 2026-08-29 that it was hard to identify/remember fixed by
  // deliberately breaking this file's otherwise-monochrome vocabulary
  // here specifically: "material" IS a color choice, so real color is
  // what makes this ONE icon memorable, more than any single-color
  // shape could -- every other mark in this file stays currentColor-only.
  material: `
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
  // Pattern: hexagon (the frame's own) with a small repeating dot-grid
  // inside -- a stamp.
  pattern: `
    <circle cx="-14" cy="-14" r="4" fill="currentColor"/><circle cx="0" cy="-14" r="4" fill="currentColor"/><circle cx="14" cy="-14" r="4" fill="currentColor"/>
    <circle cx="-14" cy="0" r="4" fill="currentColor"/><circle cx="0" cy="0" r="4" fill="currentColor"/><circle cx="14" cy="0" r="4" fill="currentColor"/>
    <circle cx="-14" cy="14" r="4" fill="currentColor"/><circle cx="0" cy="14" r="4" fill="currentColor"/><circle cx="14" cy="14" r="4" fill="currentColor"/>`,
  // Generate a Body: a filled circle (a body/orb) centered in the frame
  // hexagon -- as literal as this vocabulary allows for "spawn a
  // celestial body."
  generateBody: `<circle cx="0" cy="0" r="20" fill="currentColor"/>`,
  // Plant: Cultivate's own creased-rhombus, plus a small filled seed
  // dot at its base -- related to Cultivate (same department, same
  // "growing thing" language) but a distinct, more specific mark, not a
  // duplicate of the department's own icon.
  plant: `
    <polygon points="${rhombusPts(46, 62)}" stroke="currentColor" stroke-width="2.5" fill="none"/>
    <path d="M0,-31 Q9,0 0,31" stroke="currentColor" stroke-width="2.5" fill="none"/>
    <circle cx="0" cy="31" r="7" fill="currentColor"/>`,
  // Growth Params: three vertical bars of different heights (adjustable
  // parameters) -- deliberately not a dial/slider (outside this
  // project's hex/rhombus vocabulary), a bar-height comparison is real
  // grounded geometry instead.
  growthParams: `<path d="M-18,14 V-6 M0,14 V-18 M18,14 V2" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>`,
  // Prune: the same creased rhombus as Plant/Cultivate, with a cut mark
  // (a short crossing line) at one point -- trimming.
  prune: `
    <polygon points="${rhombusPts(46, 62)}" stroke="currentColor" stroke-width="2.5" fill="none"/>
    <path d="M0,-31 Q9,0 0,31" stroke="currentColor" stroke-width="2.5" fill="none"/>
    <path d="M-11,6 L11,-6" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>`,
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
  // BCC Build: the SAME real geometry as the HUD wheel's own icon
  // (hud-wheel-3d.js) -- the truncated octahedron's silhouette down a
  // square-face axis, scaled into this mark's coordinate space. One
  // symbol, one purpose, same shape everywhere it appears.
  bccBuild: `
    <polygon points="-30,-15 -15,-30 15,-30 30,-15 30,15 15,30 -15,30 -30,15" ${THIN}/>
    <polygon points="0,-15 15,0 0,15 -15,0" ${THIN}/>`,
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
};

// One filled hexagon in a given real color -- for the bottom-left
// quick-select HUD (render.js), which shows the CURRENTLY active
// material as a live swatch (not MARKS.material's own 3-color "pick
// one" glyph, a different job: an indicator, not an action icon).
// Exported rather than duplicating hexPts()'s geometry at the call
// site, keeping all icon-geometry logic colocated in this one file.
export function swatchMark(hexColor) {
  return `<polygon points="${hexPts(28)}" fill="${hexColor}" stroke="currentColor" stroke-width="1.5" stroke-opacity="0.5"/>`;
}
