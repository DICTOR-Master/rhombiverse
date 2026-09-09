# Rhombiverse — Spec: The Almanac

Staged implementation plan for Almanac, the universal-ring wheel face that has existed as a real, wired stub since the Rhombic Wheel 3D shipped (`openAlmanac` action, `src/render.js:3055` — currently just `showHudPrompt('Almanac is not built yet.', 3000)`) but has never had its actual content built. Governed by `RHOMBIVERSE_PRINCIPLES.md` — in particular Grounded Simplicity (section 0): this plan leans hard on reusing content and code that already exists rather than inventing a parallel system, the same discipline every other spec in this project already follows.

Cross-project context: this is Rhombiverse's version of a pattern already built and shipped on its twin project, Polyhedraverse — a karaoke-style catalog/reference browser (`ShapeBrowser`, `app/components/browser/` in that repo). That project's browser exists because Polyhedraverse's whole purpose is browsing 137 abstract polyhedra; Almanac's purpose is different on purpose (see section 2) even though the UI shape rhymes.

---

## 1. Purpose

Almanac's own already-written description (`rhombic-wheel-3d-core.js`, `UNIVERSAL_RING`) states its purpose plainly, and this plan takes that at face value rather than re-deriving it:

> "Math & Geometry reference — the demonstrations behind everything you build."

That means Almanac is a **reference and demonstration surface**, not a second piece picker. Rhombiverse already has a real, complete piece-selection UI (`WHEEL_PIECE` + its `WHEEL_RD_FAMILY` sub-wheel) — 14 real placeable pieces, each with a working action, icon, and description. Almanac's job is to let a player (or someone just curious, not currently building) look up **why** those pieces exist and what's true about them geometrically — vertex/edge/face counts, real angles, how they decompose an RD, how RD itself tiles space — the same kind of reference material Polyhedraverse's `ShapeDetailDrawer` shows (Vertices/Edges/Faces/Connectors stats) for its own 137 shapes, but scoped to Rhombiverse's specific, much smaller set of real building blocks plus the lattice concepts that connect them.

---

## 2. Why This Isn't a Second Piece Picker (Redundancy Check)

Direct precedent for this exact question already exists on the twin project: Polyhedraverse built two shape-selection UIs (`PolyhedralWheel` and `ShapeBrowser`) and deliberately did **not** unify them behind a mode toggle, because they serve genuinely different moments — one is a fast radial picker for *placing* something, the other is a searchable catalog for *finding/learning about* something (see that project's own `[[polyhedraverse-wheel]]` memory).

The same split applies here, and is actually cleaner in Rhombiverse's case because the two surfaces are already structurally separate:

- **`WHEEL_PIECE`/`WHEEL_RD_FAMILY`** — action-taking. Clicking a face **places a piece**. Optimized for speed during active building.
- **Almanac** — non-action-taking. Clicking an entry **shows you information about it**. No placement side effect at all. Optimized for browsing/learning, not speed.

So Almanac is not redundant with Piece — it's the "what does this actually mean" companion to it, the same relationship `ShapeDetailDrawer` has to `PolyhedralWheel` on the twin project.

---

## 3. Content Model

Almanac's content comes from **three tiers**, all sourced from data that already exists in this codebase — nothing here should be hand-typed twice:

### 3a. Piece entries (14, all already named and described)

Every real placeable piece already has a `label` + `desc` in `WHEEL_PIECE`/`WHEEL_RD_FAMILY` (`rhombic-wheel-3d-core.js`) and a real icon mark in `MARKS` (`wheel-icons.js`): RD, Hemi RD, Hourglass, Corner Cluster, Band Cluster, Triangle Cluster, Triangle Ring, Cube, Pyramid, TO (Truncated Octahedron), Flattened Octahedron, Disphenoid, CO (Cuboctahedron), Octahedron.

Almanac's Stage 1 (below) is almost entirely **importing this existing array**, not writing new copy. The one thing to *add* per entry, not already present anywhere: real geometric stats (vertex/edge/face count, at minimum) — see Stage 2.

### 3b. Lattice concepts (new, small set)

A handful of standing facts that don't belong to any single piece — why RD tiles space with no gaps (real space-filling honeycomb, not approximate), the BCC lattice, RD's dual relationship to the FCC lattice's own Voronoi cell, why the interstitial pieces (Flattened Octahedron / Disphenoid) exist at all. These are genuinely new copy, but short — this is a reference card, not a textbook. Cite `RHOMBIVERSE_PRINCIPLES.md`'s real-physics grounding examples as the tone to match (plain, factual, no invented lore where real crystallography already answers the question).

### 3c. World Systems note (one entry, historical)

World Systems (mining/trade/claims/achievements/animals/hazards) was retired to Shared World only (commit `890615a`). Almanac is a natural, low-stakes place for a single "what happened to X" entry for anyone who remembers the old mode — keeps that history discoverable without it cluttering the active UI anywhere else. Optional; not blocking any other stage.

---

## 4. UI Shell — Reuse, Don't Invent

Per Grounded Simplicity, the overlay shell should copy an existing, already-shipped Rhombiverse pattern rather than design a new one:

- **Panel chrome:** `changelog.js` already implements exactly this shape of thing (a dismissible overlay listing entries) — same file this project's own twin, Polyhedraverse, modeled its brand-new `ChangelogOverlay.tsx` on this session, in the other direction. Reuse `changelog.js`'s open/close/backdrop pattern directly.
- **Rotating 3D demonstration:** `welcome.js`'s `buildRDEdges()` already renders a rotating wireframe RD for the welcome screen. Almanac's per-entry detail view wants the same idea generalized: a small rotating preview of *that entry's specific piece*, not just RD. `render.js`'s `buildRDGeometry(scale = 1)` and `rhombic-wheel-3d-core.js`'s `buildRDFaces()` are the two existing geometry builders closest to reusable for this — confirm at implementation time whether either already parametrizes by piece type or whether that's new surface area (see Stage 3).
- **Icons:** `wheel-icons.js`'s `MARKS` already has a real SVG mark for every piece in section 3a (`pieceRD`, `pieceHalfRD`, `pieceHourglass`, `pieceHemi3`, `pieceHemi4`, `pieceHemiTri`, `pieceHemiRing`, `pieceCube`, `piecePyramid`, `pieceTO`, `pieceOctaSite`, `pieceOctahedron`, `pieceDisphenoid`) plus `almanac` itself for the wheel face. Reuse these directly as the catalog list's icons — same principle as Polyhedraverse's `FAMILY_META` symbols being the single shared source of truth across its wheel and browser.

---

## 5. Staged Implementation

Matches this project's own established stage-by-stage build discipline (see e.g. `RHOMBIVERSE_SPEC_RHOMBIS_GAME_BUILD_PLAN.md`'s own staging).

### Stage 0 — Content data module
New file, e.g. `src/app/almanac-data.js`: a plain array/object built by **importing** `WHEEL_PIECE`/`WHEEL_RD_FAMILY`'s existing `label`/`desc`/`action` fields (don't copy-paste them — derive, the same "single source of truth" rule Polyhedraverse's `families.ts` states explicitly for its own family metadata) plus the small set of new lattice-concept entries from section 3b. No UI yet — just get the real data shape settled and verifiable (e.g. a quick console check that every `WHEEL_PIECE`/`WHEEL_RD_FAMILY` action has exactly one matching Almanac entry, no silent gaps).

### Stage 1 — Static list + detail panel, wired to the real stub
Replace the `showHudPrompt('Almanac is not built yet.')` line in `render.js` with opening a real overlay (shell per section 4): a scrollable list of entries (icon + label), click → detail panel (desc text + icon, no 3D yet). This alone already resolves the stub and is independently shippable — Stage 2/3 are pure enhancement on top of a working Stage 1.

### Stage 2 — Real geometric stats per piece
Add vertex/edge/face counts (and dihedral angles where meaningful) to each piece entry, computed from the same geometry data the game itself already uses to build/place that piece (`core/hemisphere-build.js`, `core/build.js`, etc.) — not hand-typed, the same "derive, don't duplicate" standard Polyhedraverse's whole registry holds itself to. This is the step most likely to need real investigation (confirm exactly which existing module owns each piece's authoritative vertex data before computing anything) — treat that investigation as its own sub-task before writing stats, don't guess numbers.

### Stage 3 — Rotating 3D preview per entry
Generalize `welcome.js`'s rotating-RD-wireframe pattern to render *the selected entry's own piece geometry*, reusing `buildRDGeometry`/`buildRDFaces` where they already cover a piece, extending only where a real gap exists. Confirm reuse-vs-gap per piece before building rather than assuming either way.

### Stage 4 — Cross-link to Polyhedraverse
Same twin-identity cross-link Polyhedraverse's own `WelcomeOverlay.tsx` already added pointing at Rhombiverse this session — Almanac is the natural place for the *reverse* link (a small Polyhedraverse icon + "the idealized math version of these shapes lives here too" line), completing the pair rather than leaving it one-directional.

### Deferred (not in scope until Stage 0-4 ship and prove the concept)
Search/filter, favorites, or a tabbed layout matching `ShapeBrowser`'s Home/Search/Scene/Favorites structure — only worth adding if Almanac's real entry count grows enough to need it. At 14 pieces + a handful of lattice concepts, a single scrollable list (Stage 1) is very likely sufficient forever; don't build search infrastructure for a list this short pre-emptively.

---

## 6. Open Questions (flagged honestly, not guessed at)

- Whether `buildRDGeometry`/`buildRDFaces` already parametrize by piece type or only build plain RD — unconfirmed, needs a direct read at Stage 3 time.
- Which module holds authoritative per-piece vertex data for Stage 2's stats (likely `core/hemisphere-build.js` for the RD-derived pieces, `core/build.js`/`core/pyramid.js`/`core/cubocta-build.js` for the rest) — unconfirmed, needs a direct read at Stage 2 time, not assumed from file names alone.
- Icon reuse for the 2 lattice-concept entries in section 3b that have no existing piece mark (BCC lattice, RD/FCC duality) — these need either a new small mark or a text-only entry; not decided here.
