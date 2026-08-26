// ---------------------------------------------------------------------
// Rhombic Wheel 3D -- shared geometry/config/style core.
//
// Copied verbatim (per rhombic-wheel-shared-renderer.md's instruction:
// "don't re-derive this math from the prose description; copy it") from
// the task's companion reference file. This is the single source of
// truth for the RD face geometry, the universal-ring content, and every
// per-wheel face config -- resolveWheelFaces() is the one function that
// makes it structurally impossible for a wheel to drift from the
// universal ring. Full design rationale: docs/code-notes/app/
// rhombic-wheel-3d.md.
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
  kind: "universal", label: "Home", action: "navigateHome", temporary: true,
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
  // Home's 5th universal slot hosts a 6th department here -- unassigned
  // in the flow chart itself, but explicitly reserved for exactly this
  // ("here that's moot, so it hosts a 6th department instead"). Filled
  // 2026-08-25 with Rhombisis (see WHEEL_RHOMBISIS below), per direct
  // user decision -- restores a unified "genesis" gesture (sculpt,
  // generate a body, plant a seed) the flow chart's own department
  // taxonomy had scattered across Build/Rhombitect/Cultivate by
  // mechanism rather than by shared creative intent. Real second
  // doorway, not new logic -- every face here reuses an action string
  // already handled in render.js's onAction.
  fifthSlotOverride: { kind: "dept", label: "Rhombisis", action: "navigateTo:rhombisis",
    desc: "Sculpt, Generate a Body, Plant a Seed — every act of bringing something new into being, in one place." },
  faces: {
    "equator|sx1sy1":   { kind: "dept", label: "Construct",  action: "navigateTo:construct",
      desc: "Build and Alter modules live here." },
    "equator|sx1sy-1":  { kind: "dept", label: "Rhombitect", action: "navigateTo:rhombitect",
      desc: "Precise coordinate building — Dome, Spiral Column, Templates." },
    // Label only -- internal id/action ("cultivate") unchanged, so
    // #cultivate-panel and every navigateTo:cultivate reference stay
    // exactly as they are. Deliberate departure from Flow_chart.md's
    // own literal naming (unlike Rhombitect, which already matches
    // the source doc) -- direct user decision, made eyes-open.
    "equator|sx-1sy1":  { kind: "dept", label: "Rhombivate",  action: "navigateTo:cultivate",
      desc: "Plant, Prune, and Growth Parameters for the organic/Penrose layer." },
    "equator|sx-1sy-1": { kind: "dept", label: "Trade",      action: "navigateTo:trade",
      desc: "Offer, Accept, and Inventory — the resource/decay economy." },
    "bottom|sy1sz-1":   { kind: "dept", label: "Explore",    action: "navigateTo:explore",
      desc: "Rhombinaut mode — one face, one destination, identity-framed name only." },
    // Least-adjacent-available placement (verified numerically --
    // bottom|sx-1sz-1 is non-adjacent to equator|sx1sy1, bottom|
    // sx1sz-1 is non-adjacent to equator|sx-1sy1), same rule applied
    // uniformly across every wheel with a remaining blank face.
    "bottom|sx1sz-1":   { kind: "dept", label: "Rhombivate", action: "navigateTo:cultivate", temporary: true,
      desc: "Plant, Prune, and Growth Parameters for the organic/Penrose layer. Duplicated here for quick access from a spare slot." },
    "bottom|sx-1sz-1":  { kind: "dept", label: "Construct", action: "navigateTo:construct", temporary: true,
      desc: "Build and Alter modules live here. Duplicated here for quick access from a spare slot." }
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
    // Temporary duplicates at each real face's true geometric antipode
    // (centroid inversion through the RD's center, verified
    // numerically -- equator|sx-1sy1 <-> equator|sx1sy-1, equator|
    // sx-1sy-1 <-> equator|sx1sy1) -- standing policy: a blank face
    // duplicates its antipode's content until real content exists for
    // it, direct user directive 2026-08-25.
    "equator|sx-1sy1":  { kind: "dept", label: "Alter", action: "navigateTo:alter", temporary: true,
      desc: "Dig, Smooth, and Replace. Duplicated here for quick access from a spare slot." },
    "equator|sx-1sy-1": { kind: "dept", label: "Build", action: "navigateTo:build", temporary: true,
      desc: "Rhombi-model, Rhombi-sculpt, and Fill. Duplicated here for quick access from a spare slot." },
    // DUPLICATE_HOME_FACE sits at bottom|sy1sz-1, not bottom|sx1sz-1 --
    // that's the one bottom-ring face that does NOT share an edge with
    // the real Home slot (bottom|sy-1sz-1); bottom|sx1sz-1 and
    // bottom|sx-1sz-1 both do (verified numerically, not eyeballed).
    // Direct user directive 2026-08-25: two faces doing the same job
    // belong in mirror-opposite positions, not adjacent ones. Applies
    // to every wheel below with a duplicate.
    "bottom|sy1sz-1":   DUPLICATE_HOME_FACE,
    // Both remaining bottom slots reverted to genuine SPARE (2026-08-25
    // audit fix): this wheel only has two distinct real actions (Build,
    // Alter) and both are ALREADY doubled via their equator antipode
    // above, which between them saturate both edge-adjacent neighbors
    // of every bottom slot -- a 3rd copy of either can only ever land
    // next to one of its own siblings. Confirmed via the same numeric
    // edge-adjacency audit that first caught this bug class (see
    // /tmp/rw3d_duplicate_adjacency_audit.mjs): "Build" was adjacent
    // between equator|sx-1sy-1 and bottom|sx-1sz-1, "Alter" between
    // equator|sx1sy-1 and bottom|sx1sz-1. No non-colliding real content
    // exists for these two slots, so they stay open rather than forcing
    // a violation of the mirror-opposite/least-adjacent duplicate rule.
    "bottom|sx1sz-1":   SPARE,
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
    // Repeat is the 2D wheel's own real "tool-drag" leaf (drag across
    // faces to place a run of cells) -- reused via the new
    // toggleDragPlacement() export, same pattern as Material/Generate
    // a Body/Species above. Pattern matches the 2D wheel's OWN real
    // capability exactly: it's a "coming soon" placeholder there too
    // (kind: 'placeholder'), not a real feature being ported -- added
    // here for full flow-parity, not invented beyond what exists.
    // Pyramid-model (RHOMBIVERSE_SPEC_PYRAMID_SUBCELL.md), replacing the
    // DUPLICATE_HOME_FACE that used to live here -- per this file's own
    // stated policy on that face type ("as real tools get built out...
    // replace the relevant DUPLICATE_HOME_FACE with the actual feature").
    // Home is still always reachable via the 5th slot (bottom|sy-1sz-1,
    // injected on every non-Home wheel), so nothing is stranded.
    "bottom|sy1sz-1":  { kind: "dept", label: "Pyramid-model", action: "tool:pyramidModel",
      desc: "Finer-grained Build: re-add one of an already-partial cell's missing pyramids." },
    "bottom|sx1sz-1":  { kind: "dept", label: "Repeat", action: "tool:repeat", desc: "Drag across faces to place a run of cells." },
    "bottom|sx-1sz-1": { kind: "dept", label: "Pattern", action: "tool:pattern", desc: "Pattern stamping is coming soon." }
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
    // Temporary duplicate at Dig's true geometric antipode (equator|
    // sx-1sy-1 <-> equator|sx1sy1, verified numerically) -- standing
    // policy: a blank face duplicates its antipode's content until
    // real content exists for it, direct user directive 2026-08-25.
    "equator|sx-1sy-1": { kind: "dept", label: "Dig", action: "tool:dig", temporary: true, desc: "Excavate mode -- click a cell to remove it. Duplicated here for quick access from a spare slot." },
    "bottom|sy1sz-1":  DUPLICATE_HOME_FACE,
    // Pyramid-sculpt (RHOMBIVERSE_SPEC_PYRAMID_SUBCELL.md) fills what was
    // a genuine SPARE here (not a duplicate -- the adjacency-to-Smooth
    // concern noted below only ever applied to a Smooth duplicate, not to
    // real new distinct content). Alter/"remove" is Pyramid-sculpt's own
    // natural department, mirroring how Dig is Rhombi-sculpt's whole-
    // block-tier counterpart; Pyramid-model lives in WHEEL_BUILD instead
    // (Build had no free slot without displacing a DUPLICATE_HOME_FACE,
    // which is exactly what that face type is FOR -- see WHEEL_BUILD).
    // bottom|sx1sz-1 was reverted to SPARE from a Smooth duplicate
    // because it's edge-adjacent to Smooth's own true original
    // (equator|sx1sy-1) -- found via a fuller re-run of the adjacency
    // audit after the first fix pass (2026-08-25). That adjacency rule
    // is specifically about DUPLICATES of an existing face, so it does
    // not block placing genuinely new content (Pyramid-sculpt) here.
    "bottom|sx1sz-1":  { kind: "dept", label: "Pyramid-sculpt", action: "tool:pyramidSculpt",
      desc: "Finer-grained Alter: remove one of a placed cell's 6 pyramids, exposing a flat cube face." },
    // Smooth's duplicate (moved here from bottom|sx1sz-1 -- confirmed
    // non-adjacent to equator|sx1sy-1). The OTHER remaining slot
    // (bottom|sx1sz-1, above) skips Replace on purpose -- it's a
    // non-functional stub (see comment above), duplicating "not built
    // yet" would just be misleading clutter.
    "bottom|sx-1sz-1": { kind: "dept", label: "Smooth", action: "tool:smooth", temporary: true,
      desc: "Round mode -- click to smooth a corner. Duplicated here for quick access from a spare slot." }
    // Note: Dig already has 2 copies (original + equator-antipode
    // duplicate) which between them saturate both edge-adjacent
    // neighbors of every open bottom slot here -- no 3rd copy of Dig
    // can avoid colliding with a sibling, so it isn't force-duplicated
    // a 3rd time.
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
    "bottom|sy1sz-1":  DUPLICATE_HOME_FACE,
    // Least-adjacent placement duplicates Dome; the OTHER remaining
    // slot skips Templates on purpose (a non-functional stub, same
    // reasoning as WHEEL_ALTER skipping Replace) -- Generate a Body
    // fills it instead.
    "bottom|sx1sz-1":  { kind: "dept", label: "Generate a Body", action: "tool:generateBody", temporary: true,
      desc: "Pick a celestial body type to spawn (planetoid, moon, giant, ...). Duplicated here for quick access from a spare slot." },
    "bottom|sx-1sz-1": { kind: "dept", label: "Dome", action: "tool:dome", temporary: true,
      desc: "Opens Sculpt with \"dome\" prefilled -- press Go to build it. Duplicated here for quick access from a spare slot." }
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
    // Temporary duplicate at Plant's true geometric antipode (equator|
    // sx-1sy-1 <-> equator|sx1sy1, verified numerically) -- standing
    // policy: a blank face duplicates its antipode's content until
    // real content exists for it, direct user directive 2026-08-25.
    "equator|sx-1sy-1": { kind: "dept", label: "Plant", action: "tool:plant", temporary: true, desc: "Pick a species, then click to plant it. Opens the Cultivate panel. Duplicated here for quick access from a spare slot." },
    "bottom|sy1sz-1":  DUPLICATE_HOME_FACE,
    "bottom|sx1sz-1":  { kind: "dept", label: "Growth Params", action: "tool:growthParams", temporary: true,
      desc: "Opens the Cultivate panel's Growth Parameters section. Duplicated here for quick access from a spare slot." },
    // Was a 2nd Plant copy (2026-08-25 audit fix): Plant already has its
    // true original PLUS an equator-antipode duplicate, and this bottom
    // slot is edge-adjacent to that duplicate (equator|sx-1sy-1) -- a
    // 3rd copy here can't avoid touching a sibling. Prune has NO
    // existing duplicate anywhere yet and this slot is non-adjacent to
    // Prune's true original (equator|sx1sy-1, verified numerically), so
    // it fills the slot with genuinely new coverage instead of a
    // colliding 3rd copy of Plant.
    "bottom|sx-1sz-1": { kind: "dept", label: "Prune", action: "tool:prune", temporary: true,
      desc: "Sets Plant mode -- right-click an existing growth tile to prune it. Duplicated here for quick access from a spare slot." }
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
    // Temporary duplicate at Offer's true geometric antipode (equator|
    // sx-1sy-1 <-> equator|sx1sy1, verified numerically) -- standing
    // policy: a blank face duplicates its antipode's content until
    // real content exists for it, direct user directive 2026-08-25.
    "equator|sx-1sy-1": { kind: "dept", label: "Offer", action: "tool:offer", temporary: true, desc: "Trades start via Interact -- walk up to another player and tap Interact. Duplicated here for quick access from a spare slot." },
    "bottom|sy1sz-1":  DUPLICATE_HOME_FACE,
    "bottom|sx1sz-1":  { kind: "dept", label: "Inventory", action: "tool:inventory", temporary: true,
      desc: "Opens the Lab panel, where your real inventory is shown. Duplicated here for quick access from a spare slot." },
    // Was a 2nd Offer copy (2026-08-25 audit fix): Offer already has its
    // true original PLUS an equator-antipode duplicate, and this bottom
    // slot is edge-adjacent to that duplicate (equator|sx-1sy-1) -- a
    // 3rd copy here can't avoid touching a sibling. Accept has NO
    // existing duplicate anywhere yet and this slot is non-adjacent to
    // Accept's true original (equator|sx1sy-1, verified numerically),
    // so it fills the slot with genuinely new coverage instead of a
    // colliding 3rd copy of Offer.
    "bottom|sx-1sz-1": { kind: "dept", label: "Accept", action: "tool:accept", temporary: true,
      desc: "Pending trades from others show up in the Lab panel. Duplicated here for quick access from a spare slot." }
  }
};

// Rhombisis: a unified "genesis" doorway for the three real acts of
// bringing something new into being -- sculpting, generating a body,
// planting a seed -- which the flow chart's own department taxonomy
// scattered across Build/Rhombitect/Cultivate by mechanism, not by
// shared creative intent (2026-08-25, direct user decision). Every
// action string below is already handled in render.js's onAction --
// this wheel adds a second doorway to the exact same real behavior,
// zero new logic, same pattern DUPLICATE_HOME_FACE already uses for a
// single face, just for three at once.
export const WHEEL_RHOMBISIS = {
  id: "rhombisis",
  faces: {
    "equator|sx1sy1":   { kind: "dept", label: "Sculpt", action: "tool:rhombiSculpt",
      desc: "Opens the Sculpt panel -- symmetry and mirror tools, no World required." },
    "equator|sx1sy-1":  { kind: "dept", label: "Generate a Body", action: "tool:generateBody",
      desc: "Pick a celestial body type to spawn (planetoid, moon, giant, ...)." },
    "equator|sx-1sy1":  { kind: "dept", label: "Plant a Seed", action: "tool:plant",
      desc: "Pick a species, then click to plant it. Opens the Cultivate panel." },
    // Temporary duplicate at Sculpt's true geometric antipode (equator|
    // sx-1sy-1 <-> equator|sx1sy1, verified numerically) -- standing
    // policy: a blank face duplicates its antipode's content until
    // real content exists for it, direct user directive 2026-08-25.
    "equator|sx-1sy-1": { kind: "dept", label: "Sculpt", action: "tool:rhombiSculpt", temporary: true,
      desc: "Opens the Sculpt panel -- symmetry and mirror tools, no World required. Duplicated here for quick access from a spare slot." },
    "bottom|sy1sz-1":   DUPLICATE_HOME_FACE,
    // Remaining 2 bottom spares: least-adjacent-available placement
    // (verified numerically -- bottom|sx-1sz-1 is non-adjacent to
    // equator|sx1sy1, bottom|sx1sz-1 is non-adjacent to equator|
    // sx-1sy1), same rule applied uniformly across every wheel.
    "bottom|sx1sz-1":   { kind: "dept", label: "Plant a Seed", action: "tool:plant", temporary: true,
      desc: "Pick a species, then click to plant it. Opens the Cultivate panel. Duplicated here for quick access from a spare slot." },
    // 2026-08-26 direct instruction: this slot's Generate a Body
    // duplicate (a 3rd copy of a function with no existing duplicate
    // problem -- Generate a Body is also reachable via WHEEL_
    // RHOMBITECT's own copy) replaced with BCC Build, real new content
    // rather than another quick-access copy. "A fourth way to bring
    // something new into being," alongside this wheel's Sculpt/
    // Generate a Body/Plant a Seed. See core/bcc-build.md.
    "bottom|sx-1sz-1":  { kind: "dept", label: "BCC Build", action: "tool:bccBuild",
      desc: "Place cells on the dual body-centered-cubic lattice, alongside your normal World (Rhombeometry only)." }
  }
};

export const ALL_WHEELS = {
  home: WHEEL_HOME, construct: WHEEL_CONSTRUCT, build: WHEEL_BUILD, alter: WHEEL_ALTER,
  rhombitect: WHEEL_RHOMBITECT, cultivate: WHEEL_CULTIVATE, trade: WHEEL_TRADE,
  rhombisis: WHEEL_RHOMBISIS
};
