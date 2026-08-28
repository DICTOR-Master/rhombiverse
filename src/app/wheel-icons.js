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

const FRAME_R = 46; // frame circle/hexagon radius; viewBox is -50..50

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
  // Piece picker (RD / Cube / Pyramid / TO): a small version of each
  // tier's own real shape -- a hexagon (RD), a square (Cube), a triangle
  // (Pyramid), an octagon (TO) -- literal, matching this file's own
  // vocabulary, not a new abstract symbol for "pick a tier." Direct
  // instruction 2026-08-26: clustered in four around a shared center
  // (same layout `almanac` below already uses for its own four diamonds)
  // rather than spread out, so switching between tiers reads as moving
  // between neighbors, not hopping across the icon.
  pieceType: `
    <polygon points="${hexPts(9, 0, -24)}" ${THIN}/>
    <polygon points="16,-8 32,-8 32,8 16,8" ${THIN}/>
    <polygon points="0,15 8,31 -8,31" ${THIN}/>
    <polygon points="${octPts(9, -24, 0)}" ${THIN}/>`,
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
  // Rhombitect: hexagon (the frame's own) with one edge shown as a
  // measured/ruled line -- drawn INSET from the frame's own edge (not
  // retracing it) so the ruled ticks are actually visible against the
  // hexagon interior, not lost on top of the frame outline itself.
  rhombitect: `<path d="M-28,-16 V16 M-28,-16 h6 M-28,0 h6 M-28,16 h6" ${STROKE}/>`,
  // Rhombivate (Cultivate): single rhombus, creased down the center like a leaf/bean.
  rhombivate: `
    <polygon points="${rhombusPts(30, 40)}" ${THIN}/>
    <path d="M0,-20 Q6,0 0,20" ${THIN}/>`,
  // Rhombisis: central hexagon with three faint rays to three smaller hexagons.
  rhombisis: `
    <path d="M0,0 L0,-32 M0,0 L27.71,16 M0,0 L-27.71,16" stroke="currentColor" stroke-width="1.5" opacity="0.5"/>
    <polygon points="${hexPts(9, 0, -41)}" ${THIN}/>
    <polygon points="${hexPts(9, 27.71, 7)}" ${THIN}/>
    <polygon points="${hexPts(9, -27.71, 7)}" ${THIN}/>
    <polygon points="${hexPts(14, 0, 0)}" fill="currentColor"/>`,
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
  // Almanac: four small diamonds arranged around a center point.
  almanac: `
    <polygon points="${rhombusPts(16, 16, 24, 0)}" ${THIN}/>
    <polygon points="${rhombusPts(16, 16, 0, 24)}" ${THIN}/>
    <polygon points="${rhombusPts(16, 16, -24, 0)}" ${THIN}/>
    <polygon points="${rhombusPts(16, 16, 0, -24)}" ${THIN}/>`,
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
  // Cyborg: resolved by the live cross-walk, not a new mark -- reuses the
  // HUD wheel's own existing glyph (◈) verbatim, one symbol/one purpose,
  // rather than either of the spec's original two candidate directions.
  cyborg: `<text x="0" y="11" font-size="44" text-anchor="middle" fill="currentColor">◈</text>`,

  // --- 2026-08-26 second pass: the actions the spec's own table never
  // resolved. Not in RHOMBIVERSE_SPEC_ICON_SYSTEM.md itself -- designed
  // here, grounded in what each action actually does, same hexagon/
  // rhombus vocabulary, same inset-not-retraced-edges lesson from the
  // rhombitect/symmetryMirror fixes above. See wheel-icons.md.

  // Material: the frame hexagon split into 3 filled wedges (a swatch /
  // choice-of-fill), inset from the frame's own outline so the wedge
  // boundaries read as real divisions, not more hexagon edges.
  material: `
    <polygon points="0,0 0,-40 34.64,-20 34.64,20" fill="currentColor" opacity="0.75"/>
    <polygon points="0,0 34.64,20 0,40 -34.64,20" fill="currentColor" opacity="0.4"/>
    <polygon points="0,0 -34.64,20 -34.64,-20 0,-40" fill="none" stroke="currentColor" stroke-width="2"/>`,
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
  // Plant: Rhombivate's own creased-rhombus, plus a small filled seed
  // dot at its base -- related to Rhombivate (same department, same
  // "growing thing" language) but a distinct, more specific mark, not a
  // duplicate of the department's own icon.
  plant: `
    <polygon points="${rhombusPts(30, 40)}" ${THIN}/>
    <path d="M0,-20 Q6,0 0,20" ${THIN}/>
    <circle cx="0" cy="20" r="5" fill="currentColor"/>`,
  // Growth Params: three vertical bars of different heights (adjustable
  // parameters) -- deliberately not a dial/slider (outside this
  // project's hex/rhombus vocabulary), a bar-height comparison is real
  // grounded geometry instead.
  growthParams: `<path d="M-18,14 V-6 M0,14 V-18 M18,14 V2" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>`,
  // Prune: the same creased rhombus as Plant/Rhombivate, with a cut mark
  // (a short crossing line) at one point -- trimming.
  prune: `
    <polygon points="${rhombusPts(30, 40)}" ${THIN}/>
    <path d="M0,-20 Q6,0 0,20" ${THIN}/>
    <path d="M-8,4 L8,-4" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>`,
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
  // Construct: a pure routing hub with no tool of its own (its own code
  // comment: "not a full wheel with its own faces... routes directly to
  // Build or Alter") -- a hexagon split in half, echoing Build's "+" on
  // one side and Alter's "-" on the other, rather than an arbitrary new
  // symbol for something that's genuinely just a choice between two
  // already-iconified things.
  construct: `
    <path d="M0,-46 V46" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 3"/>
    <path d="M-13,-13 V13 M-19,0 H-7" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity="0.85"/>
    <path d="M7,0 H19" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity="0.85"/>`,

  // --- Universal-ring gaps (appear on every wheel, not spec-resolved) ---
  // Lab / Settings: resolved by the same live cross-walk logic as Cyborg
  // -- already has a real shipped icon (⚙, the HUD's lab-toggle), reuse
  // verbatim rather than invent a competing hex/rhombus mark for it.
  lab: `<text x="0" y="11" font-size="40" text-anchor="middle" fill="currentColor">⚙</text>`,
  // Home: a single solid hexagon at dead center, nothing else -- the
  // "origin point" every wheel descends from. Deliberately distinct from
  // Rhombisis (a central hexagon WITH rays to satellites): Home has no
  // rays, just the anchor itself.
  home: `<polygon points="${hexPts(20)}" fill="currentColor"/>`,
  // BCC Build: the SAME real geometry as the HUD wheel's own icon
  // (hud-wheel-3d.js) -- the truncated octahedron's silhouette down a
  // square-face axis, scaled into this mark's coordinate space. One
  // symbol, one purpose, same shape everywhere it appears.
  bccBuild: `
    <polygon points="-30,-15 -15,-30 15,-30 30,-15 30,15 15,30 -15,30 -30,15" ${THIN}/>
    <polygon points="0,-15 15,0 0,15 -15,0" ${THIN}/>`,
};
