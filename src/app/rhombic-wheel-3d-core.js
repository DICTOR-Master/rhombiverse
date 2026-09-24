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
  // noUniversalRing (2026-09-22, dimension wheel only): direct
  // instruction, "on first view of wheel only dimensions should show...
  // not all almanac and everything else." The dimension wheel is the
  // one wheel in this app that's never navigated TO from another wheel
  // (it's the standalone top-level gate, its own createRhombicWheel3D
  // instance) and never needs Cyborg/Settings/Almanac/Home reachable
  // from it -- so, uniquely, it skips the universal-ring/5th-slot
  // injection entirely and declares all 12 face keys itself. Every
  // other wheel keeps the normal injected ring unchanged.
  if (wheelConfig.noUniversalRing) {
    const faces = {};
    for (const [key, val] of Object.entries(wheelConfig.faces)) faces[key] = val;
    return faces;
  }
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
// one of these actions is gated for free, with no separate list to keep
// in sync.
//
// Cultivate/Plant/Explore removed from this set 2026-09-22 (second
// world-building removal pass) -- growth/evolution/cultivation and
// walking/exploring were archived along with the systems these actions
// pointed at; their wheel faces are plain Spare now (see WHEEL_HOME/
// WHEEL_RHOMBITECT below), not gated ones. Cuboctahedron Build is the
// one remaining real reason this gate exists at all.
const WORLD_ONLY_FACE_ACTIONS = new Set([
  "tool:cuboctaBuild",    // Piece's Cuboctahedron Build
  // "tool:bccBuild" removed 2026-09-02 -- the standalone BCC Build face
  // it gated is retired; BCC-lattice placement now happens entirely via
  // Piece:TO + the universal Add/Remove tool ("tool:add"/"tool:remove",
  // static placement, never gated by Model-workspace mode -- correctly,
  // since it's not continuously-simulated).
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

// World Systems retirement: the "Trade" face this gate used to mask
// (Offer/Accept/Inventory, the resource/decay economy) is now a plain
// Spare face directly in WHEEL_HOME's own definition above -- a genuine
// blank rather than a real department masked at render time. Mining/
// achievements/animals/hydrosphere never had dedicated wheel faces at
// all, so no other gate was ever needed here.

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
    // Was "Cultivate" (Plant/Prune/Growth Parameters) -- growth/
    // evolution/cultivation retired 2026-09-22 along with the rest of
    // the second world-building removal pass (see README.md). Now real
    // again, same day: the dimension-select wizard's own "Change
    // Dimension" doorway (tool:changeDimension, handled in render.js's
    // onAction) -- reopens WHEEL_DIMENSION, focused back on whichever
    // dimension is already active.
    "equator|sx-1sy1":  { kind: "dept", label: "Change Dimension", action: "tool:changeDimension",
      desc: "Switch which dimension tier you're building in." },
    // Was "Trade" (Offer/Accept/Inventory) -- the resource/decay economy
    // was retired 2026-09-17 along with the rest of World Systems (see
    // README.md); this face is a genuine, honest blank now rather than a
    // real department masked at render time by a gate.
    "equator|sx-1sy-1": { kind: "spare", label: "Spare", action: null, desc: "Reserved — not yet needed." },
    // Was "Explore" (Rhombinaut/walk mode) -- retired 2026-09-22 along
    // with gravity/planetoids, its own reason for existing. Genuine
    // blank now, same treatment as Trade/Cultivate above.
    "bottom|sy1sz-1":   { kind: "spare", label: "Spare", action: null, desc: "Reserved — not yet needed." },
    // Cultivate's own duplicate, same retirement as its true original
    // above -- also now a genuine blank.
    "bottom|sx1sz-1":   { kind: "spare", label: "Spare", action: null, desc: "Reserved — not yet needed." },
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
    // the two here). BCC Build originally filled this slot and had no
    // existing duplicate anywhere on Home, so nothing else needed
    // updating to keep it reachable at the time.
    //
    // BCC Build itself retired 2026-09-02 (direct report): it was a
    // genuinely separate, duplicate implementation of the exact
    // bootstrap/extend mechanic Piece:TO's own handleToClick already
    // provided (see core/build.js, core/bcc-build.md) -- not a second
    // real doorway to a shared action, an actual reimplementation. Its
    // face here is replaced with a Piece duplicate (its own true
    // original lives on WHEEL_BUILD, a different wheel's own key
    // namespace, so the same-wheel adjacency rule doesn't apply) --
    // Piece is the one remaining doorway to BCC/TO placement now, so
    // giving it direct Home-level visibility makes real sense post-
    // removal, not an arbitrary filler pick.
    "top|sy1sz1":       { kind: "dept", label: "Piece", action: "navigateTo:piece", temporary: true,
      desc: "Choose what Add/Remove operate on: RD, Cube, Pyramid, Truncated Octahedron, Flattened Octahedron, Octahedron, or Disphenoid. Duplicated here for quick access from a spare slot." }
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
    "top|sy1sz1":      { kind: "dept", label: "Color", action: "tool:color", desc: "Pick a build color." }
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
    // RD's own true original face was a direct "tool:pieceType:rd"
    // terminal through 2026-09-05 -- changed to a doorway into its own
    // sub-wheel (WHEEL_RD_FAMILY below), direct user decision 2026-09-06,
    // made right at the moment two new RD-derived pieces (Hemi RD,
    // Hourglass, ported from Rhombis) needed a home: WHEEL_PIECE itself
    // was found to be completely full (all 12 slots -- 8 real + the 4
    // universal-ring ones every wheel structurally can't touch -- already
    // spoken for), so cramming new top-level piece types in here would
    // have meant evicting something real. A sub-wheel gives the RD family
    // room to grow (this user: "I have some more ideas for piece
    // variety") without reopening WHEEL_PIECE's own already-settled layout.
    "equator|sx1sy1":   { kind: "dept", label: "RD", action: "navigateTo:rdFamily", desc: "RD and its real derived pieces -- Hemi RD, Hourglass, and more." },
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
    "equator|sx-1sy-1": { kind: "dept", label: "Dome", action: "tool:dome", temporary: true,
      desc: "Opens Sculpt with \"dome\" prefilled -- press Go to build it. Duplicated here for quick access from a spare slot." },
    "bottom|sy1sz-1":  DUPLICATE_HOME_FACE,
    // Was "Generate a Body" (planetoidgen.js) -- retired 2026-09-22
    // along with gravity/planetoids, its own reason for existing.
    // Genuine, honest blank now, same treatment as Trade on WHEEL_HOME.
    "bottom|sx1sz-1":  { kind: "spare", label: "Spare", action: null, desc: "Reserved — not yet needed." },
    "bottom|sx-1sz-1": { kind: "dept", label: "Dome", action: "tool:dome", temporary: true,
      desc: "Opens Sculpt with \"dome\" prefilled -- press Go to build it. Duplicated here for quick access from a spare slot." },
    // Was Generate a Body's own true-original slot (one of only 3 faces
    // visible at a wheel's default opening rotation) -- also now a
    // genuine blank rather than inventing a 3rd Dome duplicate to fill
    // it; Dome already has 2 copies (true original + equator-antipode
    // duplicate above), matching this file's own standing policy of not
    // over-duplicating one action past what real coverage needs.
    "top|sy1sz1":      { kind: "spare", label: "Spare", action: null, desc: "Reserved — not yet needed." }
  }
};

// WHEEL_CULTIVATE (Plant/Prune/Growth Parameters) removed 2026-09-22
// along with the rest of the second world-building removal pass (growth/
// evolution/cultivation) -- see README.md. Its own "Cultivate" doorway on
// WHEEL_HOME is now a plain Spare face (see that wheel's own comment).

// WHEEL_TRADE (Offer/Accept/Inventory) removed 2026-09-17 along with the
// rest of World Systems -- see README.md. Its own "Trade" doorway on
// WHEEL_HOME is now a plain Spare face (see that wheel's own comment).

// Rhombisis (unified "genesis" doorway for Symmetry/Generate a Body/
// Plant a Seed/BCC Build) retired 2026-09-02 -- see WHEEL_HOME's own
// header comment for the full reasoning. BCC Build (its one genuinely
// unique action) moved to Home; the other three were pure duplicates of
// Build/Rhombitect/Cultivate's own real faces, cut per "one tool, one
// doorway."

// RD family: reached via WHEEL_PIECE's own "RD" face (navigateTo:rdFamily,
// see that face's own header comment for why this exists as a sub-wheel
// rather than more WHEEL_PIECE faces). Hemi RD/Hourglass/the two cluster
// stamps below all ported from Rhombis 2026-09-06 (src/rhombis/stages.js's
// Hourglass/Hourglass Chain stages and Multi-Cell's hubcap-cluster idea,
// core/lattice.js's hemisphereSplit -- see core/hemisphere-build.js for
// the real store/key/cluster-group scheme).
//
// Real same-day bug, direct report: this wheel's first draft only
// declared 3 of its 12 addressable faces, leaving top|sy1sz1 undeclared --
// one of only 3 faces visible at a fresh wheel's default opening rotation
// (equator|sx1sy1, top|sx1sz1, top|sy1sz1, same fact every OTHER wheel's
// own header comment already documents), so this wheel broke the
// established "never open onto a mostly-blank wheel" rule every sibling
// wheel deliberately upholds by filling that exact slot with real
// content. Fixed by giving the cluster-stamp pieces (hemi3/hemi4,
// added the same session once the earlier "12-cluster" idea was dropped
// as redundant with 'to' -- see core/hemisphere-build.js's own header)
// real homes, one of them AT top|sy1sz1 specifically. Two more clusters
// (hemiTri Triangle Cluster, hemiRing Triangle Ring) filled the remaining
// bottom-ring slots later the same session. The 1 remaining slot is
// explicit SPARE (not just left undeclared) -- this user flagged "more
// ideas for piece variety" the same session this wheel was created, so
// real room is kept for future RD-derived pieces, just never as an
// accidentally-blank face again.
// Trimmed 2026-09-22, direct instruction ("remove some RD pieces, just
// keeping RD-Hemi and RD-Hourglass"): the 4 cluster stamps (Corner/Band/
// Triangle Cluster, Triangle Ring) are cut from this wheel -- their
// underlying core/hemisphere-build.js math and core/build.js click
// handling are untouched, just no longer reachable via this face or the
// Piece picker (archived-in-place, per this repo's own "archive, don't
// delete" convention, not removed from the codebase).
export const WHEEL_RD_FAMILY = {
  id: "rdFamily",
  faces: {
    "equator|sx1sy1":   { kind: "dept", label: "RD", action: "tool:pieceType:rd", desc: "A full block -- cube plus all 6 pyramids." },
    "equator|sx1sy-1":  { kind: "dept", label: "Hemi RD", action: "tool:pieceType:halfrd",
      desc: "One real hemisphereSplit() half of an RD -- click an existing face to add the neighbor's near half." },
    "equator|sx-1sy1":  { kind: "dept", label: "Hourglass", action: "tool:pieceType:hourglass",
      desc: "Two matching hemisphere halves bridging a cell and its neighbor -- click an existing face to add one across that boundary." },
    // Not strictly "RD family" (Elongated Dodecahedron/Hex Prism are 2
    // of the OTHER real parallelohedra, unrelated to RD's own
    // decomposition) -- placed here anyway, direct pragmatic call:
    // WHEEL_PIECE itself has zero spare slots (see its own header
    // comment -- "completely full" already before these 3 existed), and
    // this sub-wheel is the only one with real room. RD Quarter IS a
    // genuine RD-family piece (one of RD's own 4 real rhombohedra).
    "equator|sx-1sy-1": { kind: "dept", label: "RD Quarter", action: "tool:pieceType:rdquarter",
      desc: "One of RD's own 4 real rhombohedra (Fedorov's zonotope decomposition) -- click a corner to fill it in." },
    // "ED", not the full name -- direct instruction 2026-09-23, matching
    // this wheel's own existing abbreviation convention (RD, TO, CO):
    // "Elongated Dodecahedron" was the one long label left on this
    // wheel, long enough to visually crowd/overlap its neighboring
    // faces' own label area.
    "top|sy1sz1":       { kind: "dept", label: "ED", action: "tool:pieceType:elongdodeca",
      desc: "Elongated Dodecahedron -- the 4th of the real \"5\" parallelohedra -- its own lattice, same FCC positions, anisotropic scale." },
    "bottom|sy1sz-1":   { kind: "dept", label: "Hex Prism", action: "tool:pieceType:hexprism",
      desc: "The 5th real parallelohedron -- its own separate hexagonal lattice." },
    // Rhombohedra (free lattice): direct follow-up, same session as RD
    // Quarter -- "need placement of rhombohedra not limited to fill
    // existing RDs, rhombohedra should be able to fulfil their own
    // geometry free connecting in all directions... call them
    // rhombohedra too." Genuinely the SAME real shape as one of RD
    // Quarter's own 4 congruent orientations (geometry-extensions/
    // rhombohedra-lattice.js reuses rdQuarterPieces(s)[0] directly),
    // just growing freely through open space via its own 6 real face
    // directions instead of only appearing pre-packed inside an
    // already-solid RD -- see that file's own header for why RD
    // Quarter itself can't be freely placed/removed once bootstrapped
    // into an already-solid cell (its own volume becomes fully
    // enclosed, unclickable from outside).
    "bottom|sx1sz-1":   { kind: "dept", label: "Rhombohedra", action: "tool:pieceType:rhombohedra",
      desc: "The same real rhombohedron as RD Quarter, but its own free-standing lattice -- click an existing face to grow in any of 6 real directions." },
    // Pyrochlore (3D Kagome) -- direct request 2026-09-24, placed in
    // this wheel's one remaining spare slot (direct decision). Not RD-
    // family either, but registered to the RD world's own FCC frame:
    // one up-tetrahedron inside every RD, truncated-tetrahedron voids in
    // its real holes -- see geometry-extensions/pyrochlore-lattice.js.
    "bottom|sx-1sz-1":  { kind: "dept", label: "Pyrochlore", action: "tool:pieceType:pyrochlore",
      desc: "Pyrochlore (3D Kagome) -- place truncated tetrahedra; the corner-sharing tetrahedra between them appear on their own." },
  }
};

// Dimension-select wheel (2026-09-22, 3rd iteration): two earlier
// drafts tried and reverted, both real, both worth keeping on record.
// (1) A flat HTML/CSS card overlay -- replaced because "UI wheel should
// display 2D 3D 4D 5D 6D" asked for a real rotating wheel. (2) Put
// directly ON this shared department wheel (WHEEL_DIMENSION/
// WHEEL_LATTICE_3D configs right here) -- reverted because "as in
// polyhedraverse one list two routes"/"the wheel has breakdown family
// shapes as in 3D currently" clarified this shared wheel's real job
// stays exactly what it already does for 3D (Piece -> RD Family), not
// dimension-select too; replaced with a separate wireframe-card wizard
// (src/app/dimension-wizard.js).
//
// THIS is the 3rd iteration, direct instruction: "one moving rhombic
// wheel with all dimensions selectable" -- but confirmed as "a
// dedicated rotating wheel just for dimensions... NOT reusing/merging
// with the shared Build/Piece navigation wheel." So: a SEPARATE
// createRhombicWheel3D() instance (its own scene/overlay, see
// render.js's own dimensionWheel3D), reusing this exact config system
// (resolveWheelFaces/ALL_WHEELS) since it's already proven, just never
// reached via navigateTo: from any other wheel and never navigated away
// from. dimension-wizard.js is retired (archived, not deleted --
// src/world-systems-archived/dimension-wizard.js) now that this wheel
// replaces it as the actual dimension picker.
//
// 4th iteration, direct correction: "on first view of wheel only
// dimensions should show[,] all dimensions doubled on opposite poles" +
// "not all almanac and everything else." resolveWheelFaces' own
// noUniversalRing flag (see that function's own header) is what makes
// this possible -- with the 3 fixed universal-ring faces and the 5th-
// slot Home no longer injected, ALL 12 face keys are free, which
// resolve into exactly 6 true antipodal pairs (verified via this file's
// own established face-normal-direction math): the 2 equator pairs
// already used for 3D/4D, plus 4 more cross-ring pairs (a top face at
// (0,sy,1)/(sx,0,1) has its true antipode at (0,-sy,-1)/(-sx,0,-1) on
// the bottom ring) that were previously unreachable because their
// antipodes were fixed universal-ring faces. That's exactly enough for
// every one of the 5 real dimensions to get a TRUE doubled pair (10
// slots), with one pair (2 slots) left over -- given to Almanac,
// doubled too, direct follow-up ("maybe almanac too doubled for all
// 12") -- so all 12 slots are real, none truly spare. Only 3D is
// buildable (`kind: "dept"`, real click); 2D/4D/5D/6D stay plain SPARE
// (dark, non-clickable, label + desc kept) until each tier actually
// ships -- "simplicity is key" still applies unchanged, just now with
// every dimension visibly doubled rather than only the ones that
// happened to have a free antipode under the old universal-ring layout.
export const WHEEL_DIMENSION = {
  id: "dimension",
  noUniversalRing: true,
  faces: {
    "equator|sx1sy1":   { kind: "dept", label: "3D", action: "tool:selectDimension:3D",
      desc: "FCC (Rhombic Dodecahedron) and BCC (Truncated Octahedron) -- this app's existing lattice core." },
    "equator|sx-1sy-1": { kind: "dept", label: "3D", action: "tool:selectDimension:3D",
      desc: "FCC (Rhombic Dodecahedron) and BCC (Truncated Octahedron) -- this app's existing lattice core." },
    "equator|sx1sy-1":  { kind: "dept", label: "4D", action: "tool:selectDimension:4D",
      desc: "Tesseract and D4 (24-cell, 16-cell) -- Hyper-pyrochlore planned." },
    "equator|sx-1sy1":  { kind: "dept", label: "4D", action: "tool:selectDimension:4D",
      desc: "Tesseract and D4 (24-cell, 16-cell) -- Hyper-pyrochlore planned." },
    // Phase 2 (2026-09-22): Square shipped (flat layer, own store, same
    // FCC-world scene) -- 2D goes from spare to real, matching 3D's own
    // dual-antipode-doubled treatment now that a second dimension is
    // actually buildable. Briefly renamed to a 70-degree Rhombus same
    // session ("why square for 2D[,] all rhombi should be derived from
    // same basic shape"), then reverted just as directly ("dont call
    // square rhombus when its familiar name is square") -- a real,
    // separate Rhombus family is still planned, after Triangular.
    // Hexagon shipped next. Triangular still planned.
    "top|sy1sz1":       { kind: "dept", label: "2D", action: "tool:selectDimension:2D",
      desc: "Square, Hexagon, and Triangle (shipped) -- a real (non-square) Rhombi family still planned." },
    "bottom|sy-1sz-1":  { kind: "dept", label: "2D", action: "tool:selectDimension:2D",
      desc: "Square, Hexagon, and Triangle (shipped) -- a real (non-square) Rhombi family still planned." },
    "top|sy-1sz1":      { kind: "spare", label: "5D", action: null,
      desc: "Decagonal quasicrystal -- planned, not yet built." },
    "bottom|sy1sz-1":   { kind: "spare", label: "5D", action: null,
      desc: "Decagonal quasicrystal -- planned, not yet built." },
    "top|sx-1sz1":      { kind: "dept", label: "Almanac", action: "openAlmanac",
      desc: "Math & Geometry reference -- the demonstrations behind everything you build." },
    "bottom|sx1sz-1":   { kind: "dept", label: "Almanac", action: "openAlmanac",
      desc: "Math & Geometry reference -- the demonstrations behind everything you build." },
    "top|sx1sz1":       { kind: "spare", label: "6D", action: null,
      desc: "Icosahedral quasicrystal -- planned, not yet built." },
    "bottom|sx-1sz-1":  { kind: "spare", label: "6D", action: null,
      desc: "Icosahedral quasicrystal -- planned, not yet built." },
  }
};

// WHEEL_PIECE_4D (2026-09-24 design): the separate 4D picker wheel,
// opened from the Dimension wheel's 4D face and from the bottom-left
// quick-select while in 4D. Six cells, each doubled on an antipodal pair
// (every face reachable from either side), no universal ring -- same
// layout rule as WHEEL_DIMENSION. Tesseract and the three A4 cells are
// planned (spare) until their worlds ship.
export const WHEEL_PIECE_4D = {
  id: "piece4d",
  noUniversalRing: true,
  faces: {
    "equator|sx1sy1":   { kind: "dept", label: "24-cell", action: "tool:pieceType:cell24", desc: "D4's own space-filling cell -- the 4D RD. Its w = 0 slice is the RD world." },
    "equator|sx-1sy-1": { kind: "dept", label: "24-cell", action: "tool:pieceType:cell24", desc: "D4's own space-filling cell -- the 4D RD. Its w = 0 slice is the RD world." },
    "equator|sx1sy-1":  { kind: "dept", label: "16-cell", action: "tool:pieceType:cell16", desc: "D4's other cell -- 16-cells fill the gaps between D4 points." },
    "equator|sx-1sy1":  { kind: "dept", label: "16-cell", action: "tool:pieceType:cell16", desc: "D4's other cell -- 16-cells fill the gaps between D4 points." },
    "top|sy1sz1":       { kind: "dept", label: "Tesseract", action: "tool:pieceType:tesseract", desc: "Z4 (Hypercubic) -- the 4D cube. Its w = 0 slice is the RD world's own unit cube." },
    "bottom|sy-1sz-1":  { kind: "dept", label: "Tesseract", action: "tool:pieceType:tesseract", desc: "Z4 (Hypercubic) -- the 4D cube. Its w = 0 slice is the RD world's own unit cube." },
    "top|sy-1sz1":      { kind: "spare", label: "Truncated 5-cell", action: null, desc: "Hyper-pyrochlore (4D Kagome) -- planned, not yet built." },
    "bottom|sy1sz-1":   { kind: "spare", label: "Truncated 5-cell", action: null, desc: "Hyper-pyrochlore (4D Kagome) -- planned, not yet built." },
    "top|sx-1sz1":      { kind: "spare", label: "Bitruncated 5-cell", action: null, desc: "Hyper-pyrochlore (4D Kagome) -- planned, not yet built." },
    "bottom|sx1sz-1":   { kind: "spare", label: "Bitruncated 5-cell", action: null, desc: "Hyper-pyrochlore (4D Kagome) -- planned, not yet built." },
    "top|sx1sz1":       { kind: "spare", label: "5-cell", action: null, desc: "Hyper-pyrochlore (4D Kagome) -- planned, not yet built." },
    "bottom|sx-1sz-1":  { kind: "spare", label: "5-cell", action: null, desc: "Hyper-pyrochlore (4D Kagome) -- planned, not yet built." },
  }
};

export const ALL_WHEELS = {
  home: WHEEL_HOME, build: WHEEL_BUILD, alter: WHEEL_ALTER,
  dimension: WHEEL_DIMENSION,
  rhombitect: WHEEL_RHOMBITECT,
  piece: WHEEL_PIECE, rdFamily: WHEEL_RD_FAMILY,
  piece4d: WHEEL_PIECE_4D,
};

// Icon System (RHOMBIVERSE_SPEC_ICON_SYSTEM.md): only actions the spec's
// section 4 table (or the live cross-walk's Cyborg resolution) actually
// resolves get a real mark -- every other face keeps its existing plain
// text label exactly as today. Deliberately NOT a guess-to-fill-every-
// face table: the spec explicitly says not to guess silently, and
// several real actions (tool:material, tool:repeat, tool:generateBody,
// tool:offer/accept/inventory, tool:plant/growthParams/prune, and the
// Build/Alter department-nav faces themselves) have no resolved row.
// See docs/code-notes/app/wheel-icons.md for the full gap list.
//
// Lives here (rhombic-wheel-3d-core.js), not rhombic-wheel-3d.js, even
// though it's only ever consumed there for real icon rendering -- moved
// 2026-09-09 so almanac-data.js (a plain data/logic module with zero
// npm dependencies, covered by the pure `node --test tests/unit/` suite
// per tests/README.md) can reuse this same action -> mark mapping
// instead of re-declaring a second copy that could drift out of sync.
// rhombic-wheel-3d.js imports `three` for its own rendering, so ANY
// import from that file (even of a plain object like this one) drags a
// browser-only dependency into that pure-Node test environment, which
// this pure "core" file (already home to WHEEL_PIECE/WHEEL_RD_FAMILY,
// zero imports of its own) never has that problem -- real failure hit
// and fixed while wiring almanac-data.js's Stage 0, not a hypothetical.
// See docs/RHOMBIVERSE_SPEC_ALMANAC.md section 4.
export const ACTION_TO_MARK = {
  // Universal Add/Remove + Piece picker (direct instruction 2026-08-26,
  // retiring the earlier separate Rhombi-/Pyramid-/Cube- model/sculpt
  // marks). 'tool:symmetry' reuses the existing `symmetryMirror` modifier
  // mark below (a real match for what that panel actually does) rather
  // than the old generic "-" now spoken for by 'tool:remove'.
  'tool:add': 'add',
  'tool:remove': 'remove',
  'tool:symmetry': 'symmetryMirror',
  // Piece: the doorway face (WHEEL_BUILD's own "Piece") shows the
  // clustered-shapes mark as a preview of what's inside, same pattern
  // as navigateTo:build/alter below; each of the 6 real tiers inside
  // WHEEL_PIECE gets its own real shape mark instead (added 2026-08-28,
  // replacing the old bare 'tool:pieceType' -- that action string no
  // longer exists on its own now that Piece is a real wheel, not a
  // picker overlay).
  'navigateTo:piece': 'pieceType',
  // RD's own doorway face reuses its own family's primary mark as a
  // preview of what's inside, same convention as navigateTo:build/alter
  // below.
  'navigateTo:rdFamily': 'pieceRD',
  'tool:pieceType:rd': 'pieceRD',
  // Real 3D-profile marks, added 2026-09-06 -- see wheel-icons.js's own
  // pieceHalfRD/pieceHourglass/pieceHemi3/pieceHemi4 header for the full
  // derivation (real orthographic silhouettes, not hand-drawn).
  'tool:pieceType:halfrd': 'pieceHalfRD',
  'tool:pieceType:hourglass': 'pieceHourglass',
  'tool:pieceType:hemi3': 'pieceHemi3',
  'tool:pieceType:hemi4': 'pieceHemi4',
  'tool:pieceType:hemiTri': 'pieceHemiTri',
  'tool:pieceType:hemiRing': 'pieceHemiRing',
  'tool:pieceType:cube': 'pieceCube',
  'tool:pieceType:pyramid': 'piecePyramid',
  'tool:pieceType:to': 'pieceTO',
  'tool:pieceType:ioct': 'pieceOctaSite',
  'tool:pieceType:octahedron': 'pieceOctahedron',
  'tool:pieceType:idis': 'pieceDisphenoid',
  // Same real gap as PIECE_MARK_KEY's own (render.js) -- every piece
  // added this session was missing here too, leaving these wheel faces
  // with no icon at all (the `markKey && MARKS[markKey]` fallback in
  // rhombic-wheel-3d.js/almanac.js is empty-string, not pieceRD, so this
  // specific gap read as "blank," not "wrong," but still a real gap).
  'tool:pieceType:elongdodeca': 'pieceElongDodeca',
  'tool:pieceType:hexprism': 'pieceHexPrism',
  'tool:pieceType:rdquarter': 'pieceRDQuarter',
  'tool:pieceType:rhombohedra': 'pieceRhombohedron',
  'tool:pieceType:pyrochlore': 'piecePyrochlore',
  'tool:pieceType:tesseract': 'pieceTesseract',
  'tool:pieceType:cell24': 'piece24Cell',
  'tool:pieceType:cell16': 'piece16Cell',
  // 2D lattice tier: one entry per lattice-2d.js's own LATTICE_PRIMITIVES
  // (Phase 6: primitive id alone -- angle is a live, in-scene toggle now,
  // not part of the piece-type value at all; see render.js's own
  // lattice2dSeedCell header for the full incident that drove this),
  // spelled out by hand rather than generated -- this file's own header
  // is explicit that it stays at "zero imports of its own" (a real prior
  // failure importing into a file in this same wheel-config layer, see
  // that header), so these ids are kept in sync with lattice-2d.js by
  // hand instead.
  'tool:pieceType:lattice2d:parallelogram': 'piece2dParallelogram',
  'tool:pieceType:lattice2d:triangle': 'piece2dTriangle',
  'tool:pieceType:lattice2d:hexagon': 'piece2dHexagon',
  'tool:fill': 'fill',
  'tool:dig': 'dig',
  'tool:smooth': 'smooth',
  'tool:replace': 'replace',
  'navigateTo:rhombitect': 'rhombitect', // wheel now labeled "Blueprint"; mark/id name unchanged
  openAlmanac: 'almanac',
  openCyborg: 'cyborg',
  // 2026-08-26 second pass -- see wheel-icons.js for full design notes
  // on each of these (not in the spec's own table, resolved here).
  'tool:color': 'color',
  'tool:repeat': 'repeat',
  'tool:pattern': 'pattern',
  // Build's department-nav face reuses its own wheel's primary tool
  // icon -- the face is a doorway into that wheel, so Add doubles as a
  // preview of what's inside. Alter used to do the same with Dig, but
  // got its own real mark (a 6-arrow recycling symbol) 2026-09-02 --
  // direct request, see wheel-icons.js's MARKS.alter for the full
  // design-review history.
  'navigateTo:build': 'add',
  'navigateTo:alter': 'alter',
  // Universal ring (every wheel): Lab/Settings and Home.
  openLab: 'lab',
  navigateHome: 'home',
  // Cuboctahedron Build (Piece, 2026-08-29): reuses the same pinwheel
  // mark Lattice Quick-View already uses for this shape.
  'tool:cuboctaBuild': 'cuboctahedron',
};
