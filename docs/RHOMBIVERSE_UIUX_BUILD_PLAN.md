# Rhombiverse — Actionable Build Plan (Fully Self-Contained Claude Code Instructions)

**This file supersedes the two files sent earlier** (the short two-prompt file, and the first "full plan" file that referenced other prompts by name instead of including them). Every step below is written out in full — nothing here requires access to any other document to execute.

Synthesized from: the MVP spec, the Improvement Plan v2, the Duality/Cultivation addendum, the Assistance Spectrum/Sculpture Mode addendum, the Cyborg Mode addendum, and — for B7's moderation gate specifically — the Compliance/Safety/Governance checklist. The contradictions between these docs were resolved by the project owner across two rounds of decisions (2026-08-17).

**A note on references inside the prompts below:** where a prompt says something like "reuse the lattice's existing order-48 symmetry" or "the existing regions/claims system," that points at code already in your repository — the live game is confirmed to already exist past Phase 6, so Claude Code can find these by reading the codebase, not by needing another planning document. Where something genuinely isn't specified anywhere yet, it's called out in §Open Items rather than glossed over.

---

## How to use this file

Nine steps: A is fully independent. B1–B7 are mostly sequential; B3 and B4b have no dependencies and can run anytime.

| Step | What | Depends on |
|---|---|---|
| A | MVP prototype — throwaway, separate codebase | none |
| B1 | Rhombic Wheel / HUD rebuild | none |
| B2 | Visual language, material wheel, X-Ray | B1 |
| B3 | Cyborg Mode (guided onboarding) | none |
| B4a | In-world sculpting ("Create" wheel category) | B1 |
| B4b | Standalone Sculpture Mode (separate top-level mode) | none |
| B5 | Duality Mode + Cultivation Mode | B2 (Duality); B1 + B4 (Cultivation) |
| B6 | Ecosystem/trading/ownership surfaced in-world | B1, B2 |
| B7 | Reach, accessibility, trust & compliance | B6 |

---

## Track A — MVP Prototype (independent, throwaway build)

**Purpose:** not a binary "is it fun" gate — a revisit to determine which specific aspect of the core loop is most enjoyable (placing blocks, a particular growth outcome, variety across outcomes). Zero dependency on Track B; do not reference any other Rhombiverse document while building this.

> Build a minimal Rhombiverse prototype: a Three.js web app with the RD/FCC lattice (valid cells where x+y+z is even, 12-neighbor face placement: (±1,±1,0), (±1,0,±1), (0,±1,±1)), one clickable block type for building, and one "seed" block that, once planted, automatically grows over a short fixed delay (a few seconds) into one of three distinct small shapes — e.g. a compact poppy, a taller branching tree, and a low crystal cluster — separate outcomes, not sequential stages of each other, each grown outward from the seed position using the same neighbor-offset math as building. Seeds are free and unlimited so a tester can plant several back-to-back and compare outcomes. No materials, no economy, no hazards, no multiplayer, no moderation, no telemetry/analytics — just placement and simple distinct growth outcomes, built to be watched and compared by a human, not measured by the code. Keep this small enough to build and test in a single session; do not reference or pull in any other Rhombiverse spec document for this build.

**Done when:** a tester can freely alternate placing blocks and planting different seeds, and can say which specific aspect they'd want more of.

---

## Track B — Live Game (existing repository)

### B1 — Make It Playable

> Working in the existing Rhombiverse repository, remove the existing sidebar UI entirely. Build a persistent minimal HUD: top-left wordmark, top-right small contextual indicator area, bottom contextual prompt shown only when relevant. Implement the Rhombic Wheel: a radial menu (triggered by Tab/Space or equivalent) with a first level of Build/Alter/Create/Explore, each opening a second-level radial submenu only after selection (Build → Place/Repeat/Pattern/Material; Alter → Dig/Smooth/Fill/Replace), styled with rhombic (not circular/rectangular) grammar. Make block placement the default interaction: hovering a face shows a translucent ghost block in the next valid FCC position; implement the intelligent ghost block behavior — edge-hover previews resulting structure, hold shows a second preview, drag produces continuous placement (walls, curves). Add crosshair/face-highlight feedback with a brief animation and sound on placement/removal. Add a Settings panel (sensitivity, invert-Y, FOV, graphics quality, volume) accessible only via an explicit Advanced/Lab entry point, not the main screen. On first-ever visit with no saved world state, auto-generate a small starter planetoid instead of a single empty cell. Apply the player-facing terminology renames from the table below in all new UI text — existing technical names stay available only in the Lab/Advanced view. Do not modify world-state schema, multiplayer sync, or backend logic in this pass.

Terminology renames (apply consistently, everywhere outside Lab/Advanced view):

| Technical (Lab/internal) | Player-facing |
|---|---|
| Section View | X-Ray / Cutaway |
| Generate | Create |
| Excavate | Dig |
| Round | Smooth / Shape |
| Fill | Fill (unchanged) |
| Walk Mode | Explore |
| Presets | Worlds |

**Done when:** default screen shows near-zero UI — no sidebar, no paragraph status text, no visible mode list — and all mode/material interaction happens through the radial wheel.

---

### B2 — Make It Beautiful

> Working in the existing Rhombiverse repository, building on the Phase 1 HUD/wheel work (B1), apply rhombic-grammar styling (rhombus-shaped buttons/selectors, tessellating selection highlight patterns, geometric menu transitions) across all remaining UI surfaces. Replace the material selection UI with a radial material wheel of miniature rhombi per material, with live structure-preview on hover. Replace any numeric Undo readout with a held-icon (↶) miniature scrub-timeline of past world states. Implement a visible transition sequence when entering/exiting Explore (Walk) mode — HUD fade, camera settle, gravity engagement cue, horizon change — rather than an instant toggle. Rebuild the existing Section View as an interactive draggable cutaway plane (X-Ray) that reveals a structure's interior in real time as the player drags it through, rather than a binary on/off checkbox. Keep all underlying mechanics (gravity, section logic, undo history) unchanged — this phase is presentation and interaction feel only.

**Done when:** all mode/material/undo interaction uses rhombic-grammar controls, and X-Ray is a draggable plane rather than a checkbox.

---

### B3 — Cyborg Mode (guided onboarding)

No dependency — builds on the Phase 2 build tool (camera orbit, face hover, placement), which already exists in the live game.

> Working in the existing Rhombiverse repository, implement Cyborg Mode. Create a `cyborg-subscript.json` format: an ordered list of steps, each with a `stepId`, a plain-language `instruction`, a `successCondition` (a named event the game client emits or can be made to emit), a `hintAfterSeconds` window, a plain-language `hint` shown if the success condition hasn't fired within that window, and a `highlightTarget` CSS selector for visually anchoring the guidance on screen. Author a real `first-build-session` subscript covering camera orbit, face-hover, and block placement — the actual existing build-tool mechanics — using this exact shape:
>
> ```json
> {
>   "subscriptName": "first-build-session",
>   "steps": [
>     {
>       "stepId": "orbit_camera",
>       "instruction": "Try dragging with your mouse to look around the shape.",
>       "successCondition": "cameraRotated",
>       "hintAfterSeconds": 8,
>       "hint": "Click and hold anywhere on the screen, then move your mouse.",
>       "highlightTarget": "#viewport"
>     },
>     {
>       "stepId": "find_face",
>       "instruction": "See the diamond shape? Move your mouse over one of its flat faces.",
>       "successCondition": "faceHovered",
>       "hintAfterSeconds": 10,
>       "hint": "Any of the 12 flat sides works — just hover over one.",
>       "highlightTarget": "#viewport"
>     },
>     {
>       "stepId": "place_block",
>       "instruction": "Click that face to place a new block there.",
>       "successCondition": "cellPlaced",
>       "hintAfterSeconds": 8,
>       "hint": "Left-click on the highlighted face.",
>       "highlightTarget": "#viewport"
>     }
>   ],
>   "completionMessage": "That's the whole build tool — hover a face, click, and keep going. You've got it."
> }
> ```
>
> Emit the named success-condition events (`cameraRotated`, `faceHovered`, `cellPlaced`) from existing game code where they aren't already available. Build a simple agent-narration UI (text + `highlightTarget` highlighting) that listens for these events and surfaces hints per the `hintAfterSeconds` timing. If a player performs an action out of the expected order (e.g. places a block before orbiting the camera), recognize the corresponding step's success condition whenever it fires rather than strictly enforcing sequence. Cyborg Mode must be toggleable off at any time with zero persistent state change to the world — it only guides, it never acts on the player's behalf in this pass; do not implement an agent-acts-on-behalf-of-player mode here.

**Done when:** toggling Cyborg Mode narrates the first-build-session subscript, hints appear only after their timing window elapses without success, and toggling off leaves world-state untouched.

---

### B4 — Sculpture Mode & the Assistance Spectrum

Sculpture Mode is a **separate top-level mode from the shared Universe** — its own entry point, not a category nested inside the Rhombic Wheel. It shares a tool module with a small in-world subset, but the two are architecturally distinct contexts.

**Shared tool module (build once, used by both B4a and B4b):**

- **Assistance Spectrum, three tiers:** Manual (no agent involvement, player performs every action directly); Semi-Cyborg (agent proposes an edit as preview/ghost cells; applies only on explicit player accept, never automatically); Full-Cyborg (player describes intent in natural language; agent executes the edit directly, no per-action confirmation).
- **Symmetry mirroring:** reuse the lattice's existing order-48 cubic symmetry group — placing/removing a cell can optionally mirror the same action across a chosen symmetry plane.
- **Shell-radius brush:** reuse the existing `shellCount(n) = 10n² + 2` formula to define a brush radius — one click adds/removes an entire shell-cluster around the cursor rather than one cell at a time.
- **Session state shape:**
  ```json
  {
    "sculptureSessions": {
      "session_1": {
        "playerId": "userId_example",
        "assistanceTier": "semi-cyborg",
        "pendingSuggestion": {
          "cells": ["4,2,0", "4,2,2"],
          "action": "add",
          "reason": "completing symmetric dome edge"
        }
      }
    }
  }
  ```
  `assistanceTier` is one of `manual` / `semi-cyborg` / `full-cyborg`, player-selectable per session. `pendingSuggestion` exists only in Semi-Cyborg tier, cleared on accept or dismiss, never auto-applied.
- **Semi-Cyborg behavior:** the agent observes the player's recent manual edits and proposes a plausible next edit (e.g. completing a symmetric feature the player has only partly built, or smoothing an irregular edge), surfaced as preview cells. Player accepts (applies it, single action) or dismisses (no effect).
- **Full-Cyborg behavior:** the agent interprets natural-language intent (e.g. "make a rounded dome here," "mirror this wing on the other side") against the current structure and executes the edit directly.

#### B4a — In-world sculpting ("Create" wheel category)

Depends on B1 (the Rhombic Wheel must exist).

> Working in the existing Rhombiverse repository, wire the shared Sculpture tool module (symmetry mirroring, shell-radius brush, Assistance Spectrum tiers) into the Rhombic Wheel's "Create" first-level category, built in B1. Selecting Create opens a second-level radial menu, styled with the same rhombic grammar as the rest of the wheel, exposing the Manual-tier tools (symmetry mirror, shell brush) and an assistance-tier selector. Edits made here write directly to the player's claim/world-state like any other build action, attributed to the player's `authorId`. Build Manual and Semi-Cyborg tiers fully and enable them — Semi-Cyborg already requires explicit player accept before any world-state change, consistent with every other consent-gated action in this game. Build Full-Cyborg's logic too (parse natural-language intent into concrete cell edits, restricted to the player's own claimed region — using the existing regions/claims system already in the codebase — or `destructible`-flagged space, with all resulting cells attributed to the requesting player's `authorId`, not the agent), but keep it behind a feature flag that stays off until B7's moderation work is verified complete, since this tier writes shared world-state without per-action confirmation.

#### B4b — Standalone Sculpture Mode (separate top-level mode)

No dependency — can be built in parallel with anything else.

> Working in the existing Rhombiverse repository, build Sculpture Mode as a separate, top-level mode — its own entry point, peer to "enter the shared world," not nested inside the Rhombic Wheel. Entering it opens a fresh, fully isolated lattice space: no connection to the player's claim, no `authorId`, no moderation state, no persistence in shared world-state — pure scratch space. Wire in the full shared Sculpture tool module: all three Assistance Spectrum tiers work identically here, including Full-Cyborg's natural-language execution — enable Full-Cyborg fully in this context from the start, since nothing here writes shared world-state, so B7's moderation gate does not apply to this context. Add export to standard 3D mesh formats — STL for 3D printing, OBJ/GLTF for general 3D use — generated by converting the RD-lattice cell structure into rhombic-dodecahedron-faceted geometry, reusing the same mesh-generation logic already used for in-world rendering rather than a new export pipeline. No persistence requirement: a standalone sculpture is local save/export only by default. Add one explicit, separate "place a copy in-world" action as the only bridge back to shared world-state — this is a normal player-attributed placement (the player placing something they made), not a live agent write, so it does not need the Full-Cyborg gate either. A player must be able to move freely between this standalone workspace and in-world sculpting (B4a) without either affecting the other's state.

**Done when (both):** Manual/Semi-Cyborg suggestions require explicit accept before any world-state change; Full-Cyborg edits are attributed to the requesting player, not the agent; a player can move between in-world and standalone sculpting without either affecting the other's state; export produces valid STL/OBJ/GLTF using existing mesh-generation code.

---

### B5 — Duality Mode & Cultivation Mode

Duality depends on B2 (extends the X-Ray/viewport pattern). Cultivation depends on B1 (wheel entry point) and B4 (reuses its Assistance Spectrum framework directly — do not redefine it here).

> Working in the existing Rhombiverse repository, building on B2's X-Ray/viewport work and B4's Assistance Spectrum framework:
>
> **Duality Mode:** build a rendering-only toggle, available in the same viewport-level control area as X-Ray, that reinterprets a selected structure's existing `cells` data (positions, materials — no new data required) through the cut-and-project mapping already established for this project's math (the RD lattice as a 4D hypercube shadow, the rhombic triacontahedron as a 6D hypercube shadow), rendering an aperiodic "shadow" of the same structure. Zero world-state writes — purely a client-side render mode. Available on any structure regardless of claim ownership, since nothing is being modified. No schema addition needed.
>
> **Cultivation Mode:** reuse the Assistance Spectrum tiers and Full-Cyborg scoping rules from B4 exactly — do not redefine them. Manual tier: at planting time, expose the existing growth-layer's L-system/substitution parameters (directional bias, density vs. spread) as player-adjustable inputs via a `growthParameters` field; manually pruning part of an already-grown structure should trigger the existing aperiodic fill/reroute behavior the growth system already has, with no new rule added. Semi-Cyborg: the agent proposes a seed location or parameter set (e.g. "this spot has strong hydrosphere permeation, likely a good planting site," reusing the existing `hydrosphereActive` flag from the water/ice system already in the codebase), optionally showing the location's Duality Mode shadow as part of its reasoning; player accepts or dismisses, nothing plants without explicit confirmation. Full-Cyborg: player describes intent in natural language ("grow me a forest along this ridge," "let this garden fill in naturally over time"); agent plants/tends using the existing growth-rule parameter space, scoped and attributed exactly as B4a's Full-Cyborg (player's own claim or `destructible` space only, `authorId` = requesting player) — and gated the same way, behind a feature flag until B7's moderation work is verified complete, since this writes shared world-state. Use this schema:
>
> ```json
> {
>   "growthSeeds": {
>     "seed_1": {
>       "authorId": "userId_example",
>       "location": [12, 4, 8],
>       "growthParameters": { "directionalBias": [0, 1, 0], "densityBias": 0.6 },
>       "assistanceTier": "semi-cyborg"
>     }
>   }
> }
> ```
>
> Place Cultivation's Manual/Semi-Cyborg controls behind the Rhombic Wheel — use whichever of the existing "Alter" category or a new "Grow" category fits the existing wheel taxonomy more cleanly, and document which one you chose.

**Done when:** toggling Duality Mode never modifies `cells` data; Cultivation's Semi-Cyborg suggestions require explicit accept; Cultivation's Full-Cyborg is scoped and gated identically to B4a's.

---

### B6 — Make It a Game

Depends on B1 and B2.

> Working in the existing Rhombiverse repository, building on the B1/B2 HUD and interaction work, remove the Shared World requirement for solo mining/inventory; gate only trade actions behind a connection. Add an achievements/soft-goals system using the existing bottom contextual-prompt element from B1 (the "toast" pattern) rather than a new panel — e.g. "Grow your first fern," "Build a 3-shell planetoid," "Reach a black hole," "Evolve a species." Ensure growth/evolution/ecosystem parameters are hidden by default (Lab-only) — planting a seed should just grow, animals should just appear and be followable, with no configuration UI shown unless the player explicitly opens Advanced (note: this default-hidden behavior is compatible with B5's Cultivation Mode, since Cultivation's parameter exposure is opt-in via deliberate tool use, not default UI). Add a visible transition when approaching a mineable asteroid (lattice becoming apparent, then diggable) mirroring the B2 Explore-mode transition style. Rename "Presets" to "Worlds" throughout the UI and internal player-facing labels (My Worlds / Showcase / New World / Import World / Shared Worlds), without changing the underlying data format. Implement world sharing via a compressed URL/short code, and a public gallery view of showcase/community Worlds with thumbnails. Rebuild first-time onboarding around the existing Showcase World as a sequenced discovery experience (build → keep going → open the wheel → notice growth → notice an animal → discover Explore) rather than a tutorial modal. Rebuild the trade UI as an in-world "Interact" action opening a two-sided drag-and-accept offer view. Add a subtle in-world visual indicator for claimed regions (tint/boundary glow/sigil) rather than relying solely on a menu. Add lightweight pseudonymous account creation and named cursor/avatar indicators for other players in Shared World mode.

**Done when:** achievements use the existing toast pattern (no new panel); ecosystem parameters stay hidden outside Advanced/Cultivation tools; trading and claims are in-world interactions, not menus.

---

### B7 — Reach, Accessibility, Trust & Compliance

Depends on B6. **Gates the in-world Full-Cyborg flags from B4a and B5's Cultivation Mode** (not B4b — see B4b above). Also required, per the compliance checklist, before any broad public push — and this step has two different kinds of work in it: things Claude Code can actually build, and things that need a human legal/business decision. Both are listed; don't treat the code half as satisfying the second half.

**UI/UX and platform work (Claude Code can build this directly):**

> Working in the existing Rhombiverse repository, build a clearly organized Advanced/Lab view containing: advanced building controls, ecosystem/generation parameter controls, JSON import/export and raw data access, administration/moderation tools, and developer/debug tools — reachable via one explicit entry point from the main HUD, never shown by default. Add a responsive mobile/touch layout (bottom toolbar, tap-to-build, long-press-to-remove, pinch-to-zoom, on-screen joystick for Explore mode). Add accessibility support: scalable UI text, a colorblind-safe material palette using distinguishable patterns/icons within the material wheel (not color alone — this applies to moderation status indicators too, e.g. approved/flagged/pending should never rely on color alone), and full keyboard-only building controls. Add performance guardrails: automatic quality/pixel-ratio reduction before content is dropped under load, warnings before loading large Worlds, and an optional FPS meter with auto-degrade. Add Open Graph meta tags using a Showcase World screenshot. Replace "Under Construction" branding with a versioned "What's new" changelog panel.

**Moderation & compliance scaffolding (Claude Code can scaffold these; content needs human review before this gates anything):**

> Additionally, scaffold the repo-level trust/compliance files: a `LICENSE` file (ask which license before generating — this choice is near-irreversible once adopted), a minimal `TERMS.md` including a user-content ownership clause stating whether players own what they build and what license they grant to host/display/moderate it (and that this clause also covers sculptures exported from B4b), a minimal `PRIVACY.md`, and a `SECURITY.md` with a placeholder vulnerability-reporting contact. Run an input-sanitization audit on any user-submitted text (world names, usernames, chat) to prevent it being rendered unsanitized into the DOM. Build the age/mode gate and review-queue UI (pending → reviewed/core vs. flagged/removed) referenced by the moderation system, with the actual promotion criteria left as an editable config the team fills in — do not hardcode judgment calls about what content is acceptable. Add backend write authentication and rate limiting on builds/placements per user/time window. Document the multi-account limitation explicitly in code comments as a known, unresolved gap, not something this pass claims to solve.

**Explicitly NOT code — needs a human before "moderation complete" is actually true:** written community guidelines (the judgment layer humans apply on top of the review-queue mechanism), a documented DMCA takedown process, COPPA legal review if the audience may include minors (not satisfied by "family-friendly" design alone — get real legal review), a moderator staffing/backup plan, and a decided approach to player-to-player abuse handling separate from content moderation. **Do not flip on the in-world Full-Cyborg feature flags (B4a, B5's Cultivation) or begin broad public promotion until both halves of this step — the built code and the human sign-off — are actually done.**

**Done when:** Lab/Advanced view, mobile layout, accessibility, and performance guardrails all verified; License/Terms/Privacy/Security files exist; age gate and review queue are functional; the non-code items above have an explicit human answer (even if that answer is "not needed for our audience," it should be a stated decision, not a silent gap).

---

## Open items — content that genuinely doesn't exist yet in this synthesis

- Regions/claims system internals and the water/ice hydrosphere system are referenced above by concept only (`destructible` flag, `hydrosphereActive`) because they already exist in your codebase per the confirmed project state — their full mechanics aren't reproduced here.
- Cultivation Mode's exact wheel placement (Alter vs. a new "Grow" category) is left to the implementer, per the owner's decision in the prior round.
- The narrowed Full-Cyborg gating for B4b (standalone Sculpture Mode ships without waiting for B7) is a reasoned suggestion from this synthesis, confirmed by the owner in the prior round — noted here for traceability, not stated verbatim in any source doc.
- B7's compliance content comes from the Compliance/Safety/Governance checklist doc, which itself notes several items (COPPA, DMCA process, moderator staffing) require actual human/legal decisions this file cannot make for you.
- Improvement Plan v2's own phase numbers (1–4, UI/UX phases) are a different numbering system from the original plan's engineering phases (which the compliance doc references as "Phase 4" = public playable link, and "Phase 5.8" = moderation/trust zones). Worth keeping straight when talking to Claude Code about "Phase 4" — this file's B7 covers both meanings by including both the UI/reach work and the compliance checklist content.
