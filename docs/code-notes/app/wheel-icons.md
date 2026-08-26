# Notes: `src/app/wheel-icons.js` and the Icon System

Full design rationale/history, moved out of the source so the code
itself stays lite and readable. See `CONTRIBUTING.md`'s "Ground rules"
for why this split exists. Covers `wheel-icons.js` plus its wiring into
`rhombic-wheel-3d.js`. Built across two passes the same day (2026-08-26)
-- see "Second pass" below for the one that closed almost all of the
first pass's own gap list.

## Scope of the first pass

`RHOMBIVERSE_SPEC_ICON_SYSTEM.md` (outside this repo) is a full spec:
frame, reveal-on-touch, 17 resolved marks. Direct instruction was to
skip cautiously piloting the infrastructure on one wheel first -- "we
already have two wheels that work, [the main one already renders real
faces,] the HUD already is symbols alone" -- so this pass built the real
infrastructure (frame, reveal-on-touch) and wired it in directly across
every wheel at once, not incrementally.

**What did NOT get built in the first pass** (closed by the second, see
below): a mark for every real action across all 8 wheels. The spec's own
section 4 table only resolves ~15 of the ~30+ real actions in
`rhombic-wheel-3d-core.js`. The spec explicitly says not to guess
silently on unresolved items (section 5's own framing) -- so this pass's
`ACTION_TO_MARK` only mapped the genuinely spec-resolved subset; every
other face kept its existing plain text label.

## `wheel-icons.js`

`iconFrame(markSvg, { title })`: the universal container (spec section
2) -- a circle plus a regular hexagon whose 6 vertices touch it, real
trig (`hexPts`), not eyeballed. This same hexagon outline doubles as
"the one hexagon" referenced by every single-hexagon mark (e.g. Rhombi-
model's "+ inside one hexagon") -- no redundant nested hexagon drawn for
those; only multi-hexagon/multi-rhombus marks (Fill, Replace, Rhombisis,
Shell Brush) draw their own smaller shapes inside the frame.

`MARKS`: one SVG fragment per resolved concept, all authored in the same
-50..50 coordinate space as the frame so they compose directly.
Generated from real computed vertex coordinates (`hexPts`/`rhombusPts`
helpers, verified well-formed XML and visually reviewed as a rendered
gallery before shipping -- 2 of the first pass's marks, `rhombitect` and
`symmetryMirror`, turned out to draw their extra geometry directly on
top of the frame's own hexagon edges and were nearly invisible when
actually rendered; both were redone with geometry clearly inset/offset
from the frame instead of retracing it. Caught by actually looking at
the rendered gallery, not by reading the SVG source.

`cyborg`'s mark is not new geometry -- it's the live cross-walk's own
resolution (see `bcc-build.md`'s icon-system section): reuses the HUD
wheel's existing ◈ character verbatim via a `<text>` element, since
Cyborg already has a real shipped icon and the spec's own two candidate
directions (diamond-based / target-brackets) would have been a second,
competing symbol for the same concept -- direct instruction: no two
symbols for one purpose.

## Wiring into `rhombic-wheel-3d.js`

`ACTION_TO_MARK`: action-string -> `MARKS` key, not label-string -- more
stable, and a single mapping this way automatically gives the SAME icon
to every duplicate/quick-access copy of a function across every wheel
(they all share the same `action` value by construction already), with
zero extra bookkeeping.

Label creation: a face with a resolved mark gets `.has-icon` and two
children -- `.rw3d-label-icon` (the `iconFrame()` output, always
present) and `.rw3d-label-text` (the existing plain-text label,
`opacity: 0` by default). Everything else is untouched, still a bare
text node, exactly as before.

Reveal-on-touch (spec section 3): `.rw3d-label-text`'s opacity is
CSS-toggled by a `.reveal` class, layered on TOP of (not replacing) the
existing per-frame facing-driven opacity animation on the parent
`.rw3d-label` (`updateLabelsAndFaceVisuals()`, unmodified) -- CSS
opacity multiplies down the tree, so the resting state genuinely reads
as "icon only, faded in as you rotate toward it" (existing behavior,
now driving the icon instead of text) and the text ONLY shows once
BOTH the face is front-facing enough AND revealed. Desktop:
`pointerenter`/`pointerleave` adds/removes `.reveal` directly. Touch has
no hover equivalent, so a hold timer (`REVEAL_HOLD_MS`, currently 350ms
-- spec explicitly leaves this tunable, "needs real testing on touch
devices") stands in, added alongside (not replacing) the label's
existing `pointerdown` → `startDrag()` call, so orbit-dragging a label
still works exactly as before. A quick tap still activates immediately
via the existing unmodified `click` → `selectFace()` handler, per the
spec's explicit requirement that reveal never gate activation.

## Verified live (Playwright)

WHEEL_HOME: 9 of 12 faces got real icons (the resolved subset), 3 kept
plain text (Construct, Lab/Settings, one duplicate) -- exactly matching
`ACTION_TO_MARK`'s real coverage, not a bug. Confirmed a rendered icon
(Almanac's four-diamond mark) visually via screenshot, correctly
inheriting the wheel's own cyan theme color through `currentColor`.
Confirmed the reveal mechanism itself with computed styles, not just
class names: a visible icon label's text starts at `opacity: 0`
(resting, symbol-only) and becomes `opacity: 1` after a real mouse
hover. Zero console/page errors throughout.

## Second pass, 2026-08-26: resolving the rest

Direct instruction to work through every action listed above. All 13
real gaps plus the universal-ring pair (Lab/Settings, Home -- present on
EVERY wheel, not spec-resolved either) got real marks designed here
(not in the spec itself), same hex/rhombus vocabulary, same "verify by
rendering before shipping" practice as the first pass:

- **Material**: frame hexagon split into 3 filled wedges (a swatch).
- **Repeat**: same 3-small-hexagons layout as Fill, arrow instead of
  "+" -- shares Fill's "acts across three cells" language, distinguishes
  the drag gesture from Fill's result.
- **Pattern**: a 3x3 dot-grid (a stamp).
- **Generate a Body**: a filled circle (a body/orb) -- as literal as
  this vocabulary allows.
- **Plant**: Rhombivate's own creased rhombus plus a seed dot at its
  base -- related to, not a duplicate of, the department's own icon.
- **Growth Params**: three bars of different heights (parameters),
  deliberately not a dial/slider -- outside the hex/rhombus vocabulary.
- **Prune**: the creased rhombus with a cut mark.
- **Offer / Accept**: a rhombus with an outward vs. inward arrow.
- **Inventory**: a 2x2 grid of filled squares (stored items).
- **Lab / Settings**: resolved the same way as Cyborg was in the first
  pass -- already has a real shipped icon (⚙, the HUD's lab-toggle),
  reused verbatim rather than invent a competing mark.
- **Home**: a single solid hexagon at dead center, nothing else --
  deliberately distinct from Rhombisis (central hexagon WITH rays to
  satellites) by having no rays, just the anchor.
- **BCC Build**: the exact same geometry as the HUD wheel's own icon
  (`hud-wheel-3d.js`, the truncated octahedron's silhouette down a
  square-face axis), now also on the main wheel -- one symbol, one
  purpose, wired to both surfaces.
- **Build / Alter department-nav faces**: reuse their own wheel's
  primary tool icon (Rhombi-model, Dig) rather than invent two more
  marks for "leads to the wheel with Rhombi-model in it."
- **Construct**: a pure routing hub with no tool of its own (confirmed
  via its own code comment: "not a full wheel with its own faces...
  routes directly to Build or Alter") -- a hexagon split in half,
  echoing Build's "+" on one side and Alter's "-" on the other, instead
  of an arbitrary new symbol for a face that's genuinely just a choice
  between two already-iconified things.

**Real coverage, verified live** (not eyeballed -- `resolveWheelFaces()`
run for real against every one of `ALL_WHEELS`' 8 wheels, cross-checked
against the actual `ACTION_TO_MARK`): 89 of 93 real (non-spare) faces
across the whole app now carry a real icon. The remaining 4 are Dome,
Spiral Column, and Templates -- all three genuine unbuilt-feature stubs,
left as plain text per the spec's own suggested default (section 5 item
2), not an oversight.

## Real bug fixed after going live and actually looking (2026-08-26)

Direct report: "symbols aren't centred on faces." Real cause, found via
`getBoundingClientRect()` diagnostics, not guessed: `.rw3d-label`
(the positioned element the JS centers via `translate(-50%,-50%)`) had
always relied on an absolutely-positioned block's *implicit*
shrink-to-fit width. `.has-icon`'s own `display: flex` had been quietly
supplying that shrink-wrap as a side effect; removing it (this file's
own docs above once described `.has-icon` as `display:flex`, since
corrected) left the label as a plain block box, which stretched to the
full overlay width (measured: 1000px, the whole viewport) -- so the
centering transform centered *that*, not the icon, visibly dragging
every icon away from its true face anchor. Fixed by giving `.rw3d-label`
an explicit `width: max-content` -- shrink-to-fit is no longer implicit/
accidental. Also enlarged the icon itself per direct follow-up
instruction ("icons enlarge, not wheel"): 30px -> 52px, wheel geometry
itself untouched. Verified via the same `getBoundingClientRect()` check:
icon center and label center now match exactly, at every face checked.

## Second real bug: that fix's own regression (2026-08-26, same day)

The fix above added `.rw3d-label.has-icon { position: relative; }` so
`.rw3d-label-text`'s `position: absolute; left: 100%` had something to
anchor to. That shipped, then a live report came back: icons "floating
all over the place." Local testing right after the fix (every wheel
checked, every face `boxW:52 offBy:0`) couldn't reproduce it, so the
icon system was disabled behind a kill-switch (`ICON_SYSTEM_ENABLED =
false`) rather than argue with an unverified live report -- "return to
a functional state until you can work out the bug" was a direct,
unambiguous instruction.

Real cause, found by finally diffing `getBoundingClientRect()` against
**every** face at once (not spot-checking a couple, which is exactly
why the first pass's own local testing missed it): `.rw3d-label.has-icon`
(two classes) outranks the base `.rw3d-label { position: absolute }`
(one class) on specificity, so `position: relative` was silently
overriding it on every icon-bearing label. That turns the label from a
positioned box -- `top`/`left` = real screen coordinates relative to
`#rhombic-wheel-3d-labels` -- into a normal-flow block that stacks
under its own DOM siblings, with `top`/`left` then applied as a
*relative* offset on top of that stacked position. The drift compounds
by about one icon-height (52px) per face in DOM order: the first face
built lands dead-on (offset 0), the last of 12 lands ~572px off. This
is identical at every viewport size (checked desktop through phone) --
it has nothing to do with actual wheel/screen dimensions, which is why
"stale cache" or "environment mismatch" was the wrong lead, and why
checking only the first face or two in local testing produced
`offBy:0` even though the bug was real and present the whole time.

Fix: drop the `position: relative` override entirely. `position:
absolute` (already inherited from the base rule) is itself a valid
positioned ancestor for `.rw3d-label-text` -- `relative` was never
needed. Re-verified via the same `getBoundingClientRect()` diff, this
time against all 12 home-wheel faces at once, at both a desktop and a
phone viewport size: every face lands at offset 0. `ICON_SYSTEM_ENABLED`
kill-switch removed (was explicitly temporary) now that the real defect
is fixed, not routed around.

**Lesson for next time a "can't reproduce" live report comes in**: diff
*every* instance of the affected element in one pass, not the first
couple found by hand -- an offset that compounds with DOM order is
exactly the kind of bug spot-checking will miss while it's still real.

## Universal Add/Remove + Piece picker (2026-08-26, same day)

`RHOMBIVERSE_SPEC_PYRAMID_SUBCELL.md`'s own follow-up: what shipped first
as three separate model/sculpt pairs (Rhombi-/Pyramid-/Cube-, 6 marks)
got consolidated same-day into one universal Add + Remove pair, piece-
tier-aware via a new Piece picker (see `docs/code-notes/render.md`'s
Pyramid Sub-Cell section for the full redesign story). `rhombiModel`/
`rhombiSculpt` were renamed to `add`/`remove` in place -- the "+"/"-"
marks were already generic enough that no new geometry was needed, just
a new meaning attached. `pyramidModel`/`pyramidSculpt`/`cubeModel`/
`cubeSculpt` (the square-pyramid-net and isometric-cube marks) are gone
-- their wheel faces no longer exist, so keeping unreferenced marks
around would just be dead code. A new `pieceType` mark represents the
picker itself -- literal small shapes (originally a hexagon/cube/
pyramid-net row, see the TO section below for the current 4-shape
version), matching this file's own vocabulary rather than an abstract
symbol for "pick a tier." `tool:symmetry` (the renamed rich brush/mirror
panel, was `tool:rhombiSculpt`) reuses the existing `symmetryMirror`
modifier mark instead of `remove` -- a real match for what that panel
does, and frees `remove` to mean the new plain click-to-remove action
without the two reading as the same thing.

## TO joins the Piece picker as a 4th tier (2026-08-26, same day)

Direct instruction, framed explicitly as "adopted family member, not
pretending to be blood" -- RD/Cube/Pyramid share being different amounts
of the SAME RD's 14-vertex decomposition (`core/pyramid.md`); a truncated
octahedron genuinely isn't that, it lives on the separate BCC dual
lattice (`core/bcc-build.md`). The Piece picker including it doesn't
claim otherwise -- it's honestly just "what Add/Remove currently
produce," and one of the four happens to route to a different world/mesh
under the hood (`core/build.js`'s `handleToClick`, reusing BCC's own
existing bootstrap-vs-extend logic rather than reimplementing it).
Real wiring cost was moderate, not "too hard": bccWorld/bccMesh/
bccCellAt/onBCCChange threaded into `createBuildController` as
optional/no-op-by-default params (every other caller unaffected), plus
one real correctness fix -- a BCC-mesh hit's `instanceId` indexes a
completely different instance array than the FCC world's own `cellOrder`,
so both `onClick` and `onContextMenu` had to check `hit.object ===
bccMesh` and route to `bccCellAt`/`bccWorld` BEFORE ever calling the
generic FCC `cellAt()`, not after -- an easy one-line-later bug to miss.
Gated behind `FEATURES.bccLattice` (same Rhombeometry-only condition as
the rest of BCC's own UI) via the `<option>` element's own `disabled`/
`hidden`, not a separate guard in build.js -- `getPieceType()` simply
never returns `'to'` when the option can't be selected.

`pieceType`'s own mark updated to a real 4-shape cluster -- hexagon
(RD), square (Cube), triangle (Pyramid), octagon (TO) -- arranged at the
four cardinal positions around a shared center, the exact same layout
`almanac` below already uses for its own four diamonds (`octPts`, a new
sibling to `hexPts`, added for the TO shape). Direct instruction: tight
and centered rather than spread out, "so switching between tiers reads
as moving between neighbors." Separately, "on the full-size wheel" turned
out to already be solved -- `pickers.openPieceTypePicker()` (same
`openPickerStrip` mechanism Species/Generator use) already lays all four
real options out as one adjacent cluster of strip items the instant the
Piece face is clicked, no wheel renavigation needed between them.
Verified live with a real click through Home -> Construct -> Build ->
Piece and a screenshot of the resulting strip, not assumed from reading
the picker code.

## Real remaining gap, for whenever this continues

Dome/Spiral Column/Templates' own marks, if ever wanted (not currently
planned -- they're placeholder actions with no real mechanic behind two
of the three). Reveal-timing tuning against a real touch device (spec
section 5 item 3, still genuinely untested on hardware). Everything else
the spec's own table or this session's second pass could reasonably
resolve, is resolved.
