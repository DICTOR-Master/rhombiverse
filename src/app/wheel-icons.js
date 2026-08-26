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
  // Rhombi-model (add): "+" inside one hexagon (the frame's own).
  rhombiModel: `<path d="M0,-18 V18 M-18,0 H18" ${STROKE}/>`,
  // Rhombi-sculpt / Remove (shared): "-" inside one hexagon.
  rhombiSculpt: `<path d="M-18,0 H18" ${STROKE}/>`,
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
};
