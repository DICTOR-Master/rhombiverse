// ---------------------------------------------------------------------
// Rhombic Wheel 3D -- shared geometry/config/style core.
//
// Copied verbatim (per rhombic-wheel-shared-renderer.md's instruction:
// "don't re-derive this math from the prose description; copy it") from
// the task's companion reference file. This is the single source of
// truth for the RD face geometry, the universal-ring content, and every
// per-wheel face config -- resolveWheelFaces() is the one function that
// makes it structurally impossible for a wheel to drift from the
// universal ring. Full design rationale: docs/code-notes/app/wheel.md
// (see the "Rhombic Wheel 3D" section) once written.
//
// Deliberately no THREE.js/DOM here -- rhombic-wheel-3d.js consumes
// these exports and does all scene/camera/raycaster/DOM work, reusing
// this repo's existing THREE setup rather than duplicating one.
// ---------------------------------------------------------------------

// === 1. GEOMETRY ========================================================
// RD vertices: 6 four-valent "octahedral" points (±2,0,0) etc,
// 8 three-valent "cube" points (±1,±1,±1). 12 planar rhombic faces.
// Verified: all 12 faces planar, all edges equal length (√3), correct
// 4-valent/3-valent vertex counts.
//
// Note: this is a deliberately separate, self-contained face/vertex
// representation from core/lattice.js's rdRawVerts() (which returns an
// unordered 14-point list consumed by THREE's ConvexGeometry -- the
// existing renderer has no per-face quad/winding structure at all, so
// there is nothing to reconcile conventions with; see Phase 0 report).

function P(sx, sy, sz) { return [sx, sy, sz]; }

export function buildRDFaces() {
  const faces = [];
  // XY faces (equator ring -- touch ±X and ±Y axis vertices)
  for (const sx of [1, -1]) for (const sy of [1, -1]) {
    faces.push({
      verts: [[sx * 2, 0, 0], P(sx, sy, 1), [0, sy * 2, 0], P(sx, sy, -1)],
      ring: "equator", sx, sy
    });
  }
  // YZ faces (top ring if sz=1, bottom ring if sz=-1 -- touch ±Y and ±Z)
  for (const sy of [1, -1]) for (const sz of [1, -1]) {
    faces.push({
      verts: [[0, sy * 2, 0], P(1, sy, sz), [0, 0, sz * 2], P(-1, sy, sz)],
      ring: sz === 1 ? "top" : "bottom", sy, sz
    });
  }
  // XZ faces (top ring if sz=1, bottom ring if sz=-1 -- touch ±X and ±Z)
  for (const sx of [1, -1]) for (const sz of [1, -1]) {
    faces.push({
      verts: [[sx * 2, 0, 0], P(sx, 1, sz), [0, 0, sz * 2], P(sx, -1, sz)],
      ring: sz === 1 ? "top" : "bottom", sx, sz
    });
  }
  return faces; // 12 faces: 4 equator, 4 top, 4 bottom
}

// Deterministic key per face -- the config system below keys off this,
// so every wheel config and the shared universal-ring constant address
// the *same* geometric slot the same way. Must match buildRDFaces()'s
// field names exactly.
export function faceKey(f) {
  if (f.ring === "equator") return `equator|sx${f.sx}sy${f.sy}`;
  if (f.ring === "top")     return f.sy !== undefined ? `top|sy${f.sy}sz${f.sz}` : `top|sx${f.sx}sz${f.sz}`;
  return f.sy !== undefined ? `bottom|sy${f.sy}sz${f.sz}` : `bottom|sx${f.sx}sz${f.sz}`;
}

// THE bug from the first pass: face-loop winding wasn't consistent
// across the three axis-pair groups (XY/YZ/XZ) -- half came out wound
// clockwise as seen from outside, which flips which side of the quad
// is "front" for UV/texture purposes. Verified fix: check whether the
// raw cross-product normal points outward (positive dot with the
// face's own centroid -- valid because the RD is centered at origin),
// and reverse the vertex loop (not just a normal variable) if not.
// Call this once per face at mesh-construction time.
export function ensureOutwardWinding(vertsAsVector3Array, centroidVector3) {
  const v = vertsAsVector3Array;
  const rawNormal = v[1].clone().sub(v[0]).cross(v[3].clone().sub(v[0]));
  if (rawNormal.dot(centroidVector3) < 0) {
    return v.slice().reverse(); // preserves the cyclic quad loop, flips winding
  }
  return v;
}

// === 2. VISUAL SYSTEM (validated, user-approved) =======================
// Single wire color across the whole RD -- matches the existing `home`
// classDef stroke from the flow chart, so it's consistent with graphics
// already established elsewhere in the project, not a new invented
// color. Spare/reserved faces differ only by dash pattern, never color.
export const SKELETON_COLOR = "#4DD0E1";

// Faces: near-invisible glass fill (opacity ~0.05, still raycastable),
// plus a real 3D line outline per face in SKELETON_COLOR. On hover,
// bump fill to ~0.15 and outline opacity by ~+0.35; on select, ~0.60
// fade further out to 0.4 base and boost similarly.
export const FACE_STYLE = {
  fillOpacityBase: 0.05, fillOpacityHoverBump: 0.10, fillOpacitySelectBump: 0.10,
  outlineOpacityBase: 0.65, outlineOpacityBaseSpare: 0.4, outlineOpacityBump: 0.35,
  popOutHover: 0.12, popOutSelect: 0.22
};

// Labels: plain DOM elements (not canvas textures -- those foreshorten/
// shear on a tilted face; not WebGL sprites -- sizeAttenuation shader
// behavior proved hard to verify reliably). Position every frame via
// Vector3.project(camera). For a convex solid, a face is visible
// exactly when its outward normal (transformed by current rotation)
// has positive dot product with the direction back to camera -- no
// depth buffer needed, this is geometrically exact, not a heuristic.
export function computeLabelVisibility(worldNormal, viewDirToCamera) {
  const facing = worldNormal.dot(viewDirToCamera); // 1 = square-on, 0 = edge-on, <0 = away
  const angleFade = Math.max(0, Math.min(1, (facing - 0.05) / 0.5));
  return { facing, angleFade };
  // Caller: targetOpacity = Math.max(angleFade, hoverOrSelectBoost)
  // Hard cutoff: if (facing < -0.3) opacity = 0 regardless of boost.
  // Lerp toward target at ~0.25/frame for smoothness, not a snap.
}

export const LABEL_STYLE = {
  fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
  fontWeight: 700, letterSpacing: "3px", textTransform: "uppercase",
  fontSizeBase: "16px", fontSizeSelected: "19px",
  // text-shadow using currentColor keeps the glow in sync with
  // whatever color the label element is set to (SKELETON_COLOR),
  // so it never needs updating in two places if the palette changes.
  textShadow: "0 0 10px currentColor, 0 0 2px currentColor, 0 1px 4px rgba(0,0,0,0.9)"
};

// === 3. UNIVERSAL RING -- SINGLE SOURCE OF TRUTH =========================
// Defined exactly once. Every wheel gets this injected by the renderer.
// No wheel config below re-declares these keys -- that's the whole
// point: it's structurally impossible for a wheel to drift from this.
//
// Action mapping to real, already-shipped UI (see Phase 0/1 report):
// openCyborg -> #cyborg-toggle, openLab -> #lab-toggle already exist
// and do the described thing. openLenses is mapped to the closest
// existing single control, #xray-toggle (X-Ray is one of the three
// "lenses" named in the doc; Math/Polyhedral-Morph lenses don't exist
// yet as separate controls) -- flagged as a judgment call, not a 1:1
// match. openAlmanac has no existing counterpart and is a stub.
export const UNIVERSAL_RING = {
  "top|sy1sz1":  { kind: "universal", label: "Lenses",         action: "openLenses",
                   desc: "X-Ray / Math / Polyhedral Morph lenses — view-only overlays, available from anywhere." },
  "top|sy-1sz1": { kind: "universal", label: "Cyborg",         action: "openCyborg",
                   desc: "Assistance Spectrum controls — Manual, Semi-Cyborg, Full-Cyborg tiers." },
  "top|sx1sz1":  { kind: "universal", label: "Lab / Settings", action: "openLab",
                   desc: "The full technical interface — claims, JSON, moderation, generation parameters." },
  "top|sx-1sz1": { kind: "universal", label: "Almanac",        action: "openAlmanac",
                   desc: "Math & Geometry reference — the demonstrations behind everything you build." }
};

// The 5th universal slot: "Home" on every wheel except Home itself,
// where "return Home" is moot, so the flow chart says it can host a
// 6th department instead.
export const FIFTH_SLOT_KEY = "bottom|sy-1sz-1";
export const FIFTH_SLOT_DEFAULT = {
  kind: "universal", label: "Home", action: "navigateHome",
  desc: "Return to the Home Wheel."
};

// Resolve a full 12-key face map for a given wheel config. This is
// THE function that guarantees uniformity -- every wheel, including
// Home, passes through here rather than assembling its own map.
export function resolveWheelFaces(wheelConfig) {
  const faces = { ...UNIVERSAL_RING };
  faces[FIFTH_SLOT_KEY] = wheelConfig.id === "home" && wheelConfig.fifthSlotOverride
    ? wheelConfig.fifthSlotOverride
    : FIFTH_SLOT_DEFAULT;
  for (const [key, val] of Object.entries(wheelConfig.faces)) {
    if (faces[key]) {
      throw new Error(`Wheel "${wheelConfig.id}" face key "${key}" collides with the universal ring — ` +
        `wheel configs must never declare universal-ring or 5th-slot keys.`);
    }
    faces[key] = val;
  }
  return faces;
}

const SPARE = { kind: "spare", label: "Spare", action: null, desc: "Reserved — not yet needed." };

// Blank/unassigned slots don't have to be dead ends -- duplicating a
// high-traffic destination into an otherwise-spare slot is better UX
// than a literal dead face, as long as it's an EXISTING action being
// repeated (not a new invented feature).
// TEMPORARY, at least in intent: this is filler for otherwise-dead
// slots, not a permanent design decision. As real tools get built out
// for each module wheel, replace the relevant DUPLICATE_HOME_FACE with
// the actual feature rather than leaving the duplicate in place once
// something better exists to put there.
export const DUPLICATE_HOME_FACE = {
  kind: "universal", label: "Home", action: "navigateHome",
  desc: "Return to the Home Wheel. Duplicated here for quick access from a spare slot."
};

// === 4. WHEEL CONFIGS ====================================================
// Only faces the (now-lost, see Phase 0 report) flow chart actually
// specified are filled in; every other non-universal slot is
// explicitly SPARE, not invented content.
// Equator ring key order for reference: sx1sy1, sx1sy-1, sx-1sy1, sx-1sy-1.
// Bottom ring key order: sy1sz-1, sy-1sz-1 (=5th slot, injected), sx1sz-1, sx-1sz-1.

export const WHEEL_HOME = {
  id: "home",
  // Home's 5th universal slot hosts a 6th department here (unassigned
  // in the source -- mark spare, don't invent one).
  fifthSlotOverride: { kind: "spare", label: "Open Slot", action: null,
    desc: "The 5th Universal Ring position. On every other wheel this returns Home — here that's moot, so it hosts a 6th department instead. Unassigned in the flow chart." },
  faces: {
    "equator|sx1sy1":   { kind: "dept", label: "Construct",  action: "navigateTo:construct",
      desc: "Build and Alter modules live here." },
    "equator|sx1sy-1":  { kind: "dept", label: "Rhombitect", action: "navigateTo:rhombitect",
      desc: "Precise coordinate building — Dome, Spiral Column, Templates." },
    "equator|sx-1sy1":  { kind: "dept", label: "Cultivate",  action: "navigateTo:cultivate",
      desc: "Plant, Prune, and Growth Parameters for the organic/Penrose layer." },
    "equator|sx-1sy-1": { kind: "dept", label: "Trade",      action: "navigateTo:trade",
      desc: "Offer, Accept, and Inventory — the resource/decay economy." },
    "bottom|sy1sz-1":   { kind: "dept", label: "Explore",    action: "navigateTo:explore",
      desc: "Rhombinaut mode — one face, one destination, identity-framed name only." },
    "bottom|sx1sz-1":   SPARE,
    "bottom|sx-1sz-1":  SPARE
  }
};

// Construct is a routing grouping in the flow chart ("not a wheel with
// its own faces... routes directly to Build or Alter"), not a full
// 12-face department wheel -- but a single click still has to resolve
// to exactly one of two destinations somehow. Per direct user decision
// 2026-08-25, that's built the same way every other level of this
// navigation system already resolves one face into more faces: a real
// (mostly-spare) wheel with just Build and Alter populated, routing
// onward via the same navigateTo:<id> mechanism as everything else --
// no new UI paradigm, no popup picker, reusing resolveWheelFaces/
// switchWheel exactly as-is. This is the "grouping with two children"
// read of the flow chart's intent, not a literal violation of it.
export const WHEEL_CONSTRUCT = {
  id: "construct",
  faces: {
    "equator|sx1sy1":   { kind: "dept", label: "Build", action: "navigateTo:build",
      desc: "Rhombi-model, Rhombi-sculpt, and Fill." },
    "equator|sx1sy-1":  { kind: "dept", label: "Alter", action: "navigateTo:alter",
      desc: "Dig, Smooth, and Replace." },
    "equator|sx-1sy1":  SPARE,
    "equator|sx-1sy-1": SPARE,
    "bottom|sy1sz-1":   SPARE,
    "bottom|sx1sz-1":   DUPLICATE_HOME_FACE,
    "bottom|sx-1sz-1":  SPARE
  }
};

export const WHEEL_BUILD = {
  id: "build",
  faces: {
    "equator|sx1sy1":  { kind: "dept", label: "Rhombi-model", action: "tool:rhombiModel", desc: "Place mode -- click a face to add a cell there." },
    "equator|sx1sy-1": { kind: "dept", label: "Rhombi-sculpt", action: "tool:rhombiSculpt", desc: "Opens the Sculpt panel -- symmetry and mirror tools, no World required." },
    "equator|sx-1sy1": { kind: "dept", label: "Fill", action: "tool:fill", desc: "Fill mode -- click to fill in a gap." },
    // Filling a real, already-working feature into a spare, not
    // inventing one: the 2D wheel's material picker (openMaterialWheel)
    // already exists and works, it just had nowhere to live in this
    // flow-chart-derived structure until now. See render.js's onAction.
    "equator|sx-1sy-1": { kind: "dept", label: "Material", action: "tool:material", desc: "Pick a build material." },
    "bottom|sy1sz-1":  SPARE,
    "bottom|sx1sz-1":  DUPLICATE_HOME_FACE,
    "bottom|sx-1sz-1": SPARE
  }
};

export const WHEEL_ALTER = {
  id: "alter",
  faces: {
    "equator|sx1sy1":  { kind: "dept", label: "Dig", action: "tool:dig", desc: "Excavate mode -- click a cell to remove it." },
    "equator|sx1sy-1": { kind: "dept", label: "Smooth", action: "tool:smooth", desc: "Round mode -- click to smooth a corner." },
    // Not wired: the underlying "replace" mode has no implementation
    // anywhere in the codebase (no mode-btn, no currentMode handling)
    // -- the 2D wheel's own Replace item is already a silent no-op
    // today, discovered while wiring this. See render.js's onAction.
    "equator|sx-1sy1": { kind: "dept", label: "Replace", action: "tool:replace", desc: "Not built yet." },
    "equator|sx-1sy-1": SPARE,
    "bottom|sy1sz-1":  SPARE,
    "bottom|sx1sz-1":  DUPLICATE_HOME_FACE,
    "bottom|sx-1sz-1": SPARE
  }
};

export const WHEEL_RHOMBITECT = {
  id: "rhombitect",
  faces: {
    // Dome routes to the Sculpt panel's real "dome" shape keyword --
    // a judgment call (never a documented 1-click action before), see
    // render.js's onAction handler. Spiral Column and Templates have
    // no backing mechanic anywhere in this codebase -- real stubs.
    "equator|sx1sy1":  { kind: "dept", label: "Dome", action: "tool:dome", desc: "Opens Sculpt with \"dome\" prefilled -- press Go to build it." },
    "equator|sx1sy-1": { kind: "dept", label: "Spiral Column", action: "tool:spiralColumn", desc: "Not built yet." },
    "equator|sx-1sy1": { kind: "dept", label: "Templates", action: "tool:templates", desc: "Not built yet." },
    // Filling a real, already-working feature into a spare, not
    // inventing one: "Generate a Body" (the 2D wheel's generator-type
    // picker) spawns a real procedural celestial body (Rocky Planetoid,
    // Ice Moon, Gas Giant, etc. -- see #generator-type-select). Placed
    // here rather than on Build/Cultivate/Trade per direct user
    // decision 2026-08-25 -- closer to "spawn a whole world" than
    // single-cell placement or organic growth.
    "equator|sx-1sy-1": { kind: "dept", label: "Generate a Body", action: "tool:generateBody", desc: "Pick a celestial body type to spawn (planetoid, moon, giant, ...)." },
    "bottom|sy1sz-1":  SPARE,
    "bottom|sx1sz-1":  DUPLICATE_HOME_FACE,
    "bottom|sx-1sz-1": SPARE
  }
};

export const WHEEL_CULTIVATE = {
  id: "cultivate",
  faces: {
    // Also opens the species picker (2D wheel's "Plant a Seed") --
    // folded in here rather than given its own face, since choosing
    // what to plant is naturally part of the same action as choosing
    // to plant. See render.js's onAction.
    "equator|sx1sy1":  { kind: "dept", label: "Plant", action: "tool:plant", desc: "Pick a species, then click to plant it. Opens the Cultivate panel." },
    // Prune has no separate mode of its own -- it's a real right-click
    // gesture on an existing growth tile while already in Plant mode
    // (see render.js's contextmenu listener / pruneTile()).
    "equator|sx1sy-1": { kind: "dept", label: "Prune", action: "tool:prune", desc: "Sets Plant mode -- right-click an existing growth tile to prune it." },
    "equator|sx-1sy1": { kind: "dept", label: "Growth Params", action: "tool:growthParams", desc: "Opens the Cultivate panel's Growth Parameters section." },
    "equator|sx-1sy-1": SPARE,
    "bottom|sy1sz-1":  SPARE,
    "bottom|sx1sz-1":  DUPLICATE_HOME_FACE,
    "bottom|sx-1sz-1": SPARE
  }
};

export const WHEEL_TRADE = {
  id: "trade",
  faces: {
    // Offer/Accept are real, but only reachable via the in-world
    // Interact trigger (walk up to another player) -- there's no
    // menu-driven way to start a trade, so these open the Lab panel
    // (where the real pending-trades list and inventory live) and
    // explain the real mechanism rather than pretending a direct
    // action exists. Judgment call -- see render.js's onAction.
    "equator|sx1sy1":  { kind: "dept", label: "Offer", action: "tool:offer", desc: "Trades start via Interact -- walk up to another player and tap Interact." },
    "equator|sx1sy-1": { kind: "dept", label: "Accept", action: "tool:accept", desc: "Pending trades from others show up in the Lab panel." },
    "equator|sx-1sy1": { kind: "dept", label: "Inventory", action: "tool:inventory", desc: "Opens the Lab panel, where your real inventory is shown." },
    "equator|sx-1sy-1": SPARE,
    "bottom|sy1sz-1":  SPARE,
    "bottom|sx1sz-1":  DUPLICATE_HOME_FACE,
    "bottom|sx-1sz-1": SPARE
  }
};

export const ALL_WHEELS = {
  home: WHEEL_HOME, construct: WHEEL_CONSTRUCT, build: WHEEL_BUILD, alter: WHEEL_ALTER,
  rhombitect: WHEEL_RHOMBITECT, cultivate: WHEEL_CULTIVATE, trade: WHEEL_TRADE
};
