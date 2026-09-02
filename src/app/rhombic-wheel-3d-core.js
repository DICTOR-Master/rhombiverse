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
// and do the described thing. openAlmanac has no existing counterpart
// and is a stub.
//
// 2026-08-29: "Lenses" (openLenses / X-Ray) was dropped from this ring
// on direct instruction ("lenses are amply catered for now so can come
// off universal ring") -- X-Ray is already reachable from the corner
// HUD wheel and the Lab panel, so the universal-ring seat was
// redundant. Its freed key (top|sy1sz1) is no longer auto-injected;
// every wheel below now declares that key itself -- real content
// where one exists (Piece -> Cuboctahedron), SPARE everywhere else.
export const UNIVERSAL_RING = {
  "top|sy-1sz1": { kind: "universal", label: "Cyborg",         action: "openCyborg",
                   desc: "Assistance Spectrum controls — Manual, Semi-Cyborg, Full-Cyborg tiers." },
  // Direct instruction 2026-09-02: "get rid of lab everywhere" -- label
  // only, dropped from "Lab / Settings" to plain "Settings"; internal
  // id/action ("openLab", #lab-toggle, #lab-panel) unchanged, same
  // label-only-rename pattern already used for Rhombitect/Rhombivate.
  "top|sx1sz1":  { kind: "universal", label: "Settings", action: "openLab",
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

// Model vs. World Separation (reframe Stage 2, direct user decision
// 2026-08-28): split by static vs. dynamic -- anything that grows,
// decays, or moves on its own needs live simulation to mean anything,
// so it's locked out while workspaceMode is 'model'. Build's Symmetry
// and Rhombitect's/Blueprint's Generate a Body stay available in both
// modes (pure geometry, no clock involved). Action-keyed (not
// face-key-keyed) so every existing "temporary duplicate" face sharing
// one of these actions (e.g. Home's own bottom|sx1sz-1 Cultivate
// duplicate) is gated for free, with no separate list to keep in sync.
const WORLD_ONLY_FACE_ACTIONS = new Set([
  "navigateTo:cultivate", // Cultivate -- Plant/Prune/Growth Parameters
  "navigateTo:trade",     // Trade -- Offer/Accept/Inventory, the decay economy
  "navigateTo:explore",   // Explore -- grouped with the dynamic side per the reframe brief's own "Grow/Explore/Simulate"
  "tool:plant",           // Cultivate's Plant
  "tool:bccBuild",        // Home's BCC Build
  "tool:cuboctaBuild",    // Piece's Cuboctahedron Build
]);

// Applied after resolveWheelFaces(), never before -- operates on the
// full 12-key resolved map so it also reaches the universal ring/5th
// slot uniformly (none of those actions are in the gated set today, but
// this stays correct if that ever changes). Locked faces keep their
// real label (so the wheel still reads as "there, just unavailable
// right now" rather than a bare mystery Spare) but are re-kinded to
// "spare" -- the existing, already-correct non-clickable/dashed/dimmed
// treatment, reused rather than inventing a second disabled-face style.
export function applyWorkspaceModeGate(resolvedFaces, workspaceMode) {
  if (workspaceMode !== "model") return resolvedFaces;
  const gated = { ...resolvedFaces };
  for (const [key, data] of Object.entries(resolvedFaces)) {
    if (data.action && WORLD_ONLY_FACE_ACTIONS.has(data.action)) {
      gated[key] = { kind: "spare", label: data.label, action: null,
        desc: `${data.label} needs World workspace mode (Settings panel) — switch there to use it.` };
    }
  }
  return gated;
}

// BCC Lattice feature gate (added 2026-08-28, WHEEL_PIECE): the 3 BCC/
// interstitial piece tiers only mean anything when FEATURES.bccLattice
// is on (Rhombeometry mode) -- Full World has no BCC/interstitial
// worlds to place them into at all. Deliberately a SEPARATE gate from
// applyWorkspaceModeGate above -- that one is model-vs-world workspace
// (an orthogonal axis, gates tool:bccBuild for a different reason), not
// Rhombeometry-vs-Full-World. Takes a plain boolean, not FEATURES
// itself, so this module stays free of any global-state import (same
// reasoning applyWorkspaceModeGate already follows for workspaceMode).
const BCC_LATTICE_ONLY_FACE_ACTIONS = new Set([
  "tool:pieceType:to",
  "tool:pieceType:ioct",
  "tool:pieceType:idis",
]);
export function applyBCCLatticeGate(resolvedFaces, bccLatticeEnabled) {
  if (bccLatticeEnabled) return resolvedFaces;
  const gated = { ...resolvedFaces };
  for (const [key, data] of Object.entries(resolvedFaces)) {
    if (data.action && BCC_LATTICE_ONLY_FACE_ACTIONS.has(data.action)) {
      gated[key] = { kind: "spare", label: data.label, action: null,
        desc: `${data.label} needs the BCC Lattice feature (Rhombeometry mode) — switch there to use it.` };
    }
  }
  return gated;
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

// Simplification pass, 2026-09-02 (direct user decision -- entry/
// operation-protocol audit found too many near-identical names and
// redundant navigation hops): Construct (a pure two-child router with
// no content of its own) and Rhombisis (a "second doorway" wheel whose
// three of four real faces just duplicated Build/Rhombitect/Cultivate's
// own actions under a different label) are both retired as wheels.
// Build and Alter move directly onto Home (removing a click for the two
// most-used departments); Rhombisis's one genuinely unique action (BCC
// Build) moves directly onto Home too. Every other duplicate doorway
// (Symmetry, Generate a Body, Plant a Seed/Plant) is cut down to the
// single copy on its real mechanism wheel -- "one tool, one doorway."
// "Rhombitect" and "Rhombivate" (both invented portmanteaus, sitting
// next to plain-English "Trade"/"Explore"/"Build"/"Alter" on the same
// Home wheel) are relabeled to "Blueprint" and "Cultivate" -- label
// only, the internal id/action ("rhombitect", "navigateTo:cultivate")
// is untouched, so no other file needs to change. See LESSONS.md /
// session notes for the full before/after audit.
export const WHEEL_HOME = {
  id: "home",
  // Home's 5th universal slot: previously hosted Rhombisis (see history
  // above); now hosts Alter directly, the second of the two departments
  // freed up by retiring Construct.
  fifthSlotOverride: { kind: "dept", label: "Alter", action: "navigateTo:alter",
    desc: "Dig, Smooth, Replace, and Remove." },
  faces: {
    "equator|sx1sy1":   { kind: "dept", label: "Build",  action: "navigateTo:build",
      desc: "Add, Symmetry, Fill, and Piece. Was one click deeper, behind Construct -- moved directly onto Home." },
    "equator|sx1sy-1":  { kind: "dept", label: "Blueprint", action: "navigateTo:rhombitect",
      desc: "Precise coordinate building — Dome, Spiral Column, Templates. Was labeled \"Rhombitect\"; renamed to plain English, same wheel underneath." },
    // Label only -- internal id/action ("cultivate") unchanged, so
    // #cultivate-panel and every navigateTo:cultivate reference stay
    // exactly as they are. Was labeled "Rhombivate"; renamed to match
    // its own internal name and drop the invented portmanteau.
    "equator|sx-1sy1":  { kind: "dept", label: "Cultivate",  action: "navigateTo:cultivate",
      desc: "Plant, Prune, and Growth Parameters for the organic/Penrose layer." },
    "equator|sx-1sy-1": { kind: "dept", label: "Trade",      action: "navigateTo:trade",
      desc: "Offer, Accept, and Inventory — the resource/decay economy." },
    "bottom|sy1sz-1":   { kind: "dept", label: "Explore",    action: "navigateTo:explore",
      desc: "Rhombinaut mode — one face, one destination, identity-framed name only." },
    // Least-adjacent-available placement (verified numerically --
    // bottom|sx-1sz-1 is non-adjacent to equator|sx1sy1, bottom|
    // sx1sz-1 is non-adjacent to equator|sx-1sy1), same rule applied
    // uniformly across every wheel with a remaining blank face.
    "bottom|sx1sz-1":   { kind: "dept", label: "Cultivate", action: "navigateTo:cultivate", temporary: true,
      desc: "Plant, Prune, and Growth Parameters for the organic/Penrose layer. Duplicated here for quick access from a spare slot." },
    // Direct follow-up report, same day: this swap freed up a real
    // blank spot that's discoverable by rotating -- "another blank face
    // as it spins." Verified non-adjacent numerically (bottom|sx-1sz-1's
    // 4 neighbors are Cultivate/Trade/Explore/Alter, none of which is
    // Build) -- filled with a Build duplicate rather than leaving a
    // genuine dead end, same standing "duplicate a spare rather than
    // leave it blank" policy as everywhere else in this file.
    "bottom|sx-1sz-1":  { kind: "dept", label: "Build", action: "navigateTo:build", temporary: true,
      desc: "Add, Symmetry, Fill, and Piece. Duplicated here for quick access from a spare slot." },
    // Direct report 2026-09-02: top|sy1sz1 is one of only 3 faces
    // visible at a wheel's default opening rotation (equator|sx1sy1,
    // top|sx1sz1, top|sy1sz1 -- see WHEEL_PIECE's own header comment)
    // -- leaving it SPARE on 6 of 7 wheels meant landing on almost any
    // wheel showed "1 real face + Lab/Settings + a blank," reading as
    // mostly empty even though the other faces were real, just not yet
    // rotated into view. Fixed by SWAPPING content with an existing
    // real, non-adjacent face rather than adding a new duplicate (the
    // user's own two suggested fixes -- a duplicate, or reshuffling so
    // real content isn't clustered -- reshuffling needs no new
    // duplicate-adjacency bookkeeping at all, so it's the simpler of
    // the two here). BCC Build had no existing duplicate anywhere on
    // Home, so nothing else needs updating to keep it reachable.
    "top|sy1sz1":       { kind: "dept", label: "BCC Build", action: "tool:bccBuild",
      desc: "Place cells on the dual body-centered-cubic lattice, alongside your normal World (Rhombeometry only)." }
  }
};

export const WHEEL_BUILD = {
  id: "build",
  faces: {
    // Universal Add/Remove + Piece picker (direct instruction 2026-08-26):
    // retires Rhombi-model/Pyramid-model/Cube-model as separate buttons --
    // ONE Add, piece-tier-aware via the new Piece picker below
    // (core/build.js's getPieceType(): RD/Cube/Pyramid). Was "Rhombi-
    // model" (tool:rhombiModel).
    "equator|sx1sy1":  { kind: "dept", label: "Add", action: "tool:add", desc: "Click a face to add a piece there -- see Piece for which kind (RD / Cube / Pyramid)." },
    // Renamed from "Rhombi-sculpt" so it no longer reads as a same-job-
    // different-name twin of the new plain "Remove" (WHEEL_ALTER) --
    // this one still opens the full rich panel (symmetry/mirror/brush),
    // a genuinely different, richer tool. Same action string/mechanism.
    "equator|sx1sy-1": { kind: "dept", label: "Symmetry", action: "tool:symmetry", desc: "Opens the Symmetry panel -- brush, mirror, and symmetry tools, no World required." },
    "equator|sx-1sy1": { kind: "dept", label: "Fill", action: "tool:fill", desc: "Fill mode -- click to fill in a gap." },
    // Direct follow-up report, same day: the top|sy1sz1 swap below freed
    // up a real blank spot that's discoverable by rotating. Verified
    // non-adjacent numerically (equator|sx-1sy-1's own 4 neighbors are
    // top|sy-1sz1, bottom|sy-1sz-1, top|sx-1sz1, and bottom|sx-1sz-1 --
    // Add's true original, equator|sx1sy1, isn't among them) -- filled
    // with an Add duplicate (this wheel's single most-used action)
    // rather than leaving a genuine dead end.
    "equator|sx-1sy-1": { kind: "dept", label: "Add", action: "tool:add", temporary: true,
      desc: "Click a face to add a piece there -- see Piece for which kind (RD / Cube / Pyramid). Duplicated here for quick access from a spare slot." },
    // Piece picker (RHOMBIVERSE_SPEC_PYRAMID_SUBCELL.md follow-up,
    // 2026-08-26): what Add/Remove operate on -- RD (a full block),
    // Cube (bare, no pyramids), or Pyramid (edit one pyramid on an
    // already-placed cell). Replaces the DUPLICATE_HOME_FACE that used
    // to live here, per this file's own stated policy on that face type
    // ("as real tools get built out... replace the relevant
    // DUPLICATE_HOME_FACE with the actual feature"). Home is still always
    // reachable via the 5th slot (bottom|sy-1sz-1, injected on every
    // non-Home wheel), so nothing is stranded.
    //
    // Was a separate mini 3D widget (piece-cluster-3d.js), retired
    // 2026-08-28: with 6 real piece tiers now (RD/Cube/Pyramid/TO/
    // Octahedron Site/Disphenoid) that widget needed either a second
    // fixed camera angle or an artificial flip animation to show them
    // all -- direct feedback: use "the same main real wheel" instead,
    // the same way every other multi-option department already works
    // (navigateTo: a real WHEEL_PIECE layer, discovered by the wheel's
    // own genuine drag-rotation, not a bespoke second scene). See
    // WHEEL_PIECE below.
    "bottom|sy1sz-1":  { kind: "dept", label: "Piece", action: "navigateTo:piece",
      desc: "Choose what Add/Remove operate on: RD, Cube, Pyramid, Truncated Octahedron, Flattened Octahedron, Octahedron, or Disphenoid." },
    // Repeat is the 2D wheel's own real "tool-drag" leaf (drag across
    // faces to place a run of cells) -- reused via the new
    // toggleDragPlacement() export, same pattern as Material/Generate
    // a Body/Species above. Pattern matches the 2D wheel's OWN real
    // capability exactly: it's a "coming soon" placeholder there too
    // (kind: 'placeholder'), not a real feature being ported -- added
    // here for full flow-parity, not invented beyond what exists.
    "bottom|sx1sz-1":  { kind: "dept", label: "Repeat", action: "tool:repeat", desc: "Drag across faces to place a run of cells." },
    "bottom|sx-1sz-1": { kind: "dept", label: "Pattern", action: "tool:pattern", desc: "Pattern stamping is coming soon." },
    // Direct report 2026-09-02: top|sy1sz1 is one of only 3 faces
    // visible at a wheel's default opening rotation -- leaving it SPARE
    // made landing on this wheel look mostly empty (Add + Lab/Settings
    // + a blank). Filled by swapping in Material (used on nearly every
    // placement, arguably the most-reached-for face on this wheel) from
    // its old equator|sx-1sy-1 slot rather than adding a new duplicate
    // -- see WHEEL_HOME's own top|sy1sz1 comment for the full reasoning
    // shared across every wheel this same fix touches.
    "top|sy1sz1":      { kind: "dept", label: "Material", action: "tool:material", desc: "Pick a build material." }
  }
};

// Piece (added 2026-08-28, replacing the separate piece-cluster-3d.js
// widget -- see WHEEL_BUILD's own comment above for the full reasoning).
// Originally exactly 6 real piece tiers filled the 6 available
// non-reserved, non-universal slots (4 equator + 3 bottom) with no
// SPARE or duplicate needed. 2026-08-29: Cuboctahedron Build (a real,
// separate persistent-World system, same shape as BCC Build -- see
// core/cubocta-build.js) needed a 7th seat and this wheel was already
// completely full, so "Lenses" was dropped from the shared universal
// ring entirely (direct instruction: "lenses are amply catered for now
// so can come off universal ring" -- X-Ray/Lenses is already reachable
// via the corner HUD wheel and the Lab panel). That freed top|sy1sz1.
//
// 2026-08-29 SAME-DAY FIX, real bug caught live: top|sy1sz1 (along with
// equator|sx1sy1 and top|sx1sz1) is one of only THREE faces visible/
// clickable at every wheel's default opening rotation (confirmed live:
// every other face sits at opacity 0 / pointer-events:none until the
// player rotates) -- true structurally for every wheel, which is
// exactly why this slot always held the low-consequence universal
// "Lenses" before. Putting Cuboctahedron Build there instead meant an
// early, un-rotated tap near the top of a freshly-opened Piece wheel
// silently switched the whole app into a different BUILD MODE (not
// just a different piece-type selection) -- every subsequent World
// click then routed to Cuboctahedron Build instead of the intended
// piece placement, which is what actually broke Material/Cube/
// Disphenoid taps ("dispenses cuboctahedra"/"cube placement
// interfering"/"disphenoid wont place" were all downstream symptoms of
// the SAME accidental mode-switch, not three separate bugs). Fixed by
// swapping Cuboctahedron and Material's positions: Material (a
// terminal, non-mode-switching action, closes cleanly back to the
// normal Add flow) now sits at the always-visible top|sy1sz1 -- an
// improvement on the original "close together" request, since it's
// reachable with zero rotation -- and Cuboctahedron Build (a real mode
// switch, same category as BCC Build) moved to bottom|sx-1sz-1,
// requiring a deliberate rotation first, same as BCC Build's own
// placement on Home (bottom|sx-1sz-1 there too, since 2026-09-02).
export const WHEEL_PIECE = {
  id: "piece",
  faces: {
    "equator|sx1sy1":   { kind: "dept", label: "RD", action: "tool:pieceType:rd", desc: "A full block -- cube plus all 6 pyramids." },
    "equator|sx1sy-1":  { kind: "dept", label: "Cube", action: "tool:pieceType:cube", desc: "A bare block, no pyramids -- build up from here with the Pyramid tier." },
    "equator|sx-1sy1":  { kind: "dept", label: "Pyramid", action: "tool:pieceType:pyramid", desc: "Add or remove one pyramid on an already-placed cell." },
    "equator|sx-1sy-1": { kind: "dept", label: "TO", action: "tool:pieceType:to", desc: "Truncated Octahedron -- the BCC lattice's own real space-filling cell." },
    "bottom|sy1sz-1":   { kind: "dept", label: "Flattened Octahedron", action: "tool:pieceType:ioct", desc: "BCC interstitial lattice: places the 4-disphenoid bundle a flattened octahedron combines into." },
    "bottom|sx1sz-1":   { kind: "dept", label: "Disphenoid", action: "tool:pieceType:idis", desc: "BCC interstitial lattice: one tetragonal disphenoid at a time." },
    // Cuboctahedron Build: not a "tool:pieceType:*" terminal like its
    // siblings -- it's its own click-to-place/grow mode (like BCC Build
    // on WHEEL_RHOMBISIS), so it uses the matching "tool:cuboctaBuild"
    // action instead. Deliberately NOT on the always-visible top ring --
    // see this wheel's own header comment above. Label shortened to "CO"
    // 2026-08-29, direct instruction ("just say CO like RD does") --
    // matches this wheel's own existing abbreviation convention (RD,
    // TO), the full word still appears in desc below and the detail
    // panel that opens on selection.
    "bottom|sx-1sz-1":  { kind: "dept", label: "CO", action: "tool:cuboctaBuild",
      desc: "Cuboctahedron -- place cells on the RD lattice's dual, vertex-pointed cuboctahedra, alongside your normal World (Rhombeometry only)." },
    // Material lived here 2026-08-29 through 2026-08-31 (direct request
    // to pick shape and Material "close together"), then was removed --
    // direct follow-up feedback: a real color swatch among this wheel's
    // own monochrome marks was a genuine visual outlier, and picking any
    // Piece face now opens the material-swatch overlay directly instead
    // (see the tool:pieceType:* handler in render.js), so a dedicated
    // face here was redundant besides. Material's still reachable at
    // WHEEL_BUILD's own equator and the bottom-left HUD color icon,
    // unchanged. This freed the always-visible top|sy1sz1 slot (see this
    // wheel's own header comment) for the Cuboctahedron gap-fill
    // Octahedron -- a genuinely new piece, kept distinct from the old
    // "Octahedron Site" 4-disphenoid bundle above rather than replacing
    // it, direct user decision 2026-08-31.
    "top|sy1sz1":       { kind: "dept", label: "Octahedron", action: "tool:pieceType:octahedron",
      desc: "Fills the gap between cuboctahedra face to face -- click near a Cuboctahedron's own corner." },
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
    // Universal Remove (direct instruction 2026-08-26, retiring the
    // earlier separate Cube-sculpt/Pyramid-sculpt buttons): a plain
    // "click a piece, it's gone" action, piece-tier-aware via WHEEL_
    // BUILD's Piece picker (RD/Cube = the whole cell; Pyramid = just
    // that one pyramid). Fills what was a genuine SPARE here (not a
    // duplicate -- the adjacency-to-Smooth concern noted below only ever
    // applied to a Smooth duplicate, not to real new distinct content).
    // Alter/"remove" is its natural department, mirroring how Dig is
    // Rhombi-model's whole-block-tier counterpart.
    // Direct follow-up report, same day: moving Remove to top|sy1sz1
    // freed up a real blank spot that's discoverable by rotating.
    // Verified non-adjacent numerically (bottom|sx1sz-1's own 4
    // neighbors are equator|sx1sy1 [Dig], equator|sx1sy-1 [Smooth],
    // bottom|sy1sz-1, and bottom|sy-1sz-1 -- Remove's new true
    // original, top|sy1sz1, isn't among them). Replace (equator|sx-1sy1)
    // skipped as a duplicate target -- it's a non-functional stub, same
    // reasoning as elsewhere in this wheel.
    "bottom|sx1sz-1":  { kind: "dept", label: "Remove", action: "tool:remove", temporary: true,
      desc: "Click a piece to remove it -- see Piece (Build wheel) for which kind (RD / Cube / Pyramid). Duplicated here for quick access from a spare slot." },
    // Smooth's duplicate -- confirmed non-adjacent to both
    // equator|sx1sy-1 (its true original) and top|sy1sz1 (Remove's new
    // slot, since neither is in top|sy1sz1's own 4-face adjacency set).
    "bottom|sx-1sz-1": { kind: "dept", label: "Smooth", action: "tool:smooth", temporary: true,
      desc: "Round mode -- click to smooth a corner. Duplicated here for quick access from a spare slot." },
    // Note: Dig already has 2 copies (original + equator-antipode
    // duplicate) which between them saturate both edge-adjacent
    // neighbors of every open bottom slot here -- no 3rd copy of Dig
    // can avoid colliding with a sibling, so it isn't force-duplicated
    // a 3rd time.
    // Direct report 2026-09-02: top|sy1sz1 is one of only 3 faces
    // visible at a wheel's default opening rotation -- leaving it SPARE
    // made landing on this wheel look mostly empty (Dig + Lab/Settings
    // + a blank). Filled by swapping in Remove (the universal
    // Add's own counterpart, real everyday content) from its old
    // bottom|sx1sz-1 slot rather than adding a new duplicate -- see
    // WHEEL_HOME's own top|sy1sz1 comment for the shared reasoning.
    "top|sy1sz1":      { kind: "dept", label: "Remove", action: "tool:remove",
      desc: "Click a piece to remove it -- see Piece (Build wheel) for which kind (RD / Cube / Pyramid)." }
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
    // Direct follow-up report, same day: moving Generate a Body to
    // top|sy1sz1 freed up a real blank spot that's discoverable by
    // rotating. Verified non-adjacent numerically (equator|sx-1sy-1's
    // own 4 neighbors are top|sy-1sz1, bottom|sy-1sz-1, top|sx-1sz1,
    // and bottom|sx-1sz-1 -- Dome's true original, equator|sx1sy1,
    // isn't among them). Spiral Column/Templates skipped -- both
    // non-functional stubs, same reasoning as elsewhere in this file.
    // Generate a Body itself already has its own duplicate (below), so
    // Dome balances coverage rather than tripling one action.
    "equator|sx-1sy-1": { kind: "dept", label: "Dome", action: "tool:dome", temporary: true,
      desc: "Opens Sculpt with \"dome\" prefilled -- press Go to build it. Duplicated here for quick access from a spare slot." },
    "bottom|sy1sz-1":  DUPLICATE_HOME_FACE,
    // Least-adjacent placement duplicates Dome; the OTHER remaining
    // slot skips Templates on purpose (a non-functional stub, same
    // reasoning as WHEEL_ALTER skipping Replace) -- Generate a Body
    // fills it instead. Still non-adjacent to top|sy1sz1 (Generate a
    // Body's new true-original slot, 2026-09-02) since neither
    // bottom-ring face is in top|sy1sz1's own 4-face adjacency set.
    "bottom|sx1sz-1":  { kind: "dept", label: "Generate a Body", action: "tool:generateBody", temporary: true,
      desc: "Pick a celestial body type to spawn (planetoid, moon, giant, ...). Duplicated here for quick access from a spare slot." },
    "bottom|sx-1sz-1": { kind: "dept", label: "Dome", action: "tool:dome", temporary: true,
      desc: "Opens Sculpt with \"dome\" prefilled -- press Go to build it. Duplicated here for quick access from a spare slot." },
    // Direct report 2026-09-02: top|sy1sz1 is one of only 3 faces
    // visible at a wheel's default opening rotation -- leaving it SPARE
    // made landing on this wheel look mostly empty (Dome + Lab/Settings
    // + a blank). Filled by swapping in Generate a Body from its old
    // equator|sx-1sy-1 slot rather than adding a new duplicate (Dome,
    // the only other non-stub real face here, IS adjacent to top|sy1sz1
    // so couldn't be used) -- see WHEEL_HOME's own top|sy1sz1 comment
    // for the shared reasoning.
    "top|sy1sz1":      { kind: "dept", label: "Generate a Body", action: "tool:generateBody", desc: "Pick a celestial body type to spawn (planetoid, moon, giant, ...)." }
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
    // Direct follow-up report, same day: moving Growth Params to
    // top|sy1sz1 freed up a real blank spot that's discoverable by
    // rotating. Verified non-adjacent numerically (equator|sx-1sy1's
    // own 4 neighbors are top|sy1sz1, bottom|sy1sz-1, top|sx-1sz1, and
    // bottom|sx-1sz-1 -- Prune's true original, equator|sx1sy-1, isn't
    // among them). Prune balances coverage against Plant, which already
    // has its own duplicate just below.
    "equator|sx-1sy1": { kind: "dept", label: "Prune", action: "tool:prune", temporary: true,
      desc: "Sets Plant mode -- right-click an existing growth tile to prune it. Duplicated here for quick access from a spare slot." },
    // Temporary duplicate at Plant's true geometric antipode (equator|
    // sx-1sy-1 <-> equator|sx1sy1, verified numerically) -- standing
    // policy: a blank face duplicates its antipode's content until
    // real content exists for it, direct user directive 2026-08-25.
    "equator|sx-1sy-1": { kind: "dept", label: "Plant", action: "tool:plant", temporary: true, desc: "Pick a species, then click to plant it. Opens the Cultivate panel. Duplicated here for quick access from a spare slot." },
    "bottom|sy1sz-1":  DUPLICATE_HOME_FACE,
    // Still non-adjacent to top|sy1sz1 (Growth Params' new true-original
    // slot, 2026-09-02) since this bottom-ring face isn't in top|sy1sz1's
    // own 4-face adjacency set.
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
      desc: "Sets Plant mode -- right-click an existing growth tile to prune it. Duplicated here for quick access from a spare slot." },
    // Direct report 2026-09-02: top|sy1sz1 is one of only 3 faces
    // visible at a wheel's default opening rotation -- leaving it SPARE
    // made landing on this wheel look mostly empty (Plant + Lab/Settings
    // + a blank). Filled by swapping in Growth Params from its old
    // equator|sx-1sy1 slot rather than adding a new duplicate (Plant,
    // the equator's other real face, IS adjacent to top|sy1sz1 so
    // couldn't be used) -- see WHEEL_HOME's own top|sy1sz1 comment for
    // the shared reasoning.
    "top|sy1sz1":      { kind: "dept", label: "Growth Params", action: "tool:growthParams", desc: "Opens the Cultivate panel's Growth Parameters section." }
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
    "equator|sx1sy1":  { kind: "dept", label: "Offer", action: "tool:offer", desc: "Trades start via Interact -- walk up to another user and tap Interact." },
    "equator|sx1sy-1": { kind: "dept", label: "Accept", action: "tool:accept", desc: "Pending trades from others show up in the Settings panel." },
    // Direct follow-up report, same day: moving Inventory to top|sy1sz1
    // freed up a real blank spot that's discoverable by rotating.
    // Verified non-adjacent numerically (equator|sx-1sy1's own 4
    // neighbors are top|sy1sz1, bottom|sy1sz-1, top|sx-1sz1, and
    // bottom|sx-1sz-1 -- Accept's true original, equator|sx1sy-1, isn't
    // among them). Accept balances coverage against Offer, which
    // already has its own duplicate just below.
    "equator|sx-1sy1": { kind: "dept", label: "Accept", action: "tool:accept", temporary: true,
      desc: "Pending trades from others show up in the Settings panel. Duplicated here for quick access from a spare slot." },
    // Temporary duplicate at Offer's true geometric antipode (equator|
    // sx-1sy-1 <-> equator|sx1sy1, verified numerically) -- standing
    // policy: a blank face duplicates its antipode's content until
    // real content exists for it, direct user directive 2026-08-25.
    "equator|sx-1sy-1": { kind: "dept", label: "Offer", action: "tool:offer", temporary: true, desc: "Trades start via Interact -- walk up to another user and tap Interact. Duplicated here for quick access from a spare slot." },
    "bottom|sy1sz-1":  DUPLICATE_HOME_FACE,
    // Still non-adjacent to top|sy1sz1 (Inventory's new true-original
    // slot, 2026-09-02) since this bottom-ring face isn't in top|sy1sz1's
    // own 4-face adjacency set.
    "bottom|sx1sz-1":  { kind: "dept", label: "Inventory", action: "tool:inventory", temporary: true,
      desc: "Opens the Settings panel, where your real inventory is shown. Duplicated here for quick access from a spare slot." },
    // Was a 2nd Offer copy (2026-08-25 audit fix): Offer already has its
    // true original PLUS an equator-antipode duplicate, and this bottom
    // slot is edge-adjacent to that duplicate (equator|sx-1sy-1) -- a
    // 3rd copy here can't avoid touching a sibling. Accept has NO
    // existing duplicate anywhere yet and this slot is non-adjacent to
    // Accept's true original (equator|sx1sy-1, verified numerically),
    // so it fills the slot with genuinely new coverage instead of a
    // colliding 3rd copy of Offer.
    "bottom|sx-1sz-1": { kind: "dept", label: "Accept", action: "tool:accept", temporary: true,
      desc: "Pending trades from others show up in the Settings panel. Duplicated here for quick access from a spare slot." },
    // Direct report 2026-09-02: top|sy1sz1 is one of only 3 faces
    // visible at a wheel's default opening rotation -- leaving it SPARE
    // made landing on this wheel look mostly empty (Offer + Lab/Settings
    // + a blank). Filled by swapping in Inventory (arguably the most
    // useful at-a-glance face here) from its old equator|sx-1sy1 slot
    // rather than adding a new duplicate (Offer, the equator's other
    // real face, IS adjacent to top|sy1sz1 so couldn't be used) -- see
    // WHEEL_HOME's own top|sy1sz1 comment for the shared reasoning.
    "top|sy1sz1":      { kind: "dept", label: "Inventory", action: "tool:inventory", desc: "Opens the Settings panel, where your real inventory is shown." }
  }
};

// Rhombisis (unified "genesis" doorway for Symmetry/Generate a Body/
// Plant a Seed/BCC Build) retired 2026-09-02 -- see WHEEL_HOME's own
// header comment for the full reasoning. BCC Build (its one genuinely
// unique action) moved to Home; the other three were pure duplicates of
// Build/Rhombitect/Cultivate's own real faces, cut per "one tool, one
// doorway."

export const ALL_WHEELS = {
  home: WHEEL_HOME, build: WHEEL_BUILD, alter: WHEEL_ALTER,
  rhombitect: WHEEL_RHOMBITECT, cultivate: WHEEL_CULTIVATE, trade: WHEEL_TRADE,
  piece: WHEEL_PIECE
};
