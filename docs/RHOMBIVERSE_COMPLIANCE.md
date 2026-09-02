# Rhombiverse — Compliance, Safety & Governance Checklist

Companion document to `RHOMBIVERSE_PLAN.md`. This covers everything *outside* the core build/render mechanics that becomes necessary as the project moves from private repo → public repo → public UGC world with real users.

Each item below is tagged with **when it's required by**, mapped to the phases in the main plan. Nothing here blocks Phase 1–3 (local, single-player, private repo).

---

## Required before Phase 4 (public playable link)

- [x] **License file** (`LICENSE`) — deliberately deferred 2026-08-11, added 2026-08-12 (MIT, direct instruction) once the public deploy actually happened.
- [x] **Terms of Service** — `TERMS.md` added 2026-08-11; updated 2026-08-13 to cover Shared World (opt-in, what placing content there actually means, land claims) now that Phase 5 is live — no longer just the original no-account/no-backend scope. Still flagged for real legal review before this project takes on real accounts, payments, or a larger user base.
- [x] **Privacy Policy** — `PRIVACY.md` added 2026-08-11; updated 2026-08-13 to disclose Shared World's anonymous per-browser identity and Supabase as a third-party processor. Still honest that Shared World has no self-service deletion tooling yet (see its own "Data deletion" section) rather than overclaiming.
- [x] **SECURITY.md** — added 2026-08-11, reporting contact + GitHub private advisory link. "Scope" section updated 2026-08-28 to cover the Supabase-backed Shared World (RLS, rate limiting, backups) alongside the original static/local tier.
- [x] **Input sanitization audit** — done 2026-08-11: no user-submitted text (world name, imported JSON, material strings) is ever passed to `innerHTML`/`outerHTML`/`insertAdjacentHTML`/`document.write`. The three `innerHTML` uses in `src/render.js` (ring-list placeholder/empty states) are static literals, not interpolated data. All dynamic text (shell labels, counts) goes through `.textContent`, which auto-escapes. Imported JSON is parsed via `JSON.parse` only (no `eval`), and `worldName` is currently never rendered into the DOM at all. `MATERIAL_COLORS[material] ?? MATERIAL_COLORS.base` is a safe plain-object lookup with fallback — no dynamic property write, no code execution path. **No fixes were needed; nothing found.** Re-run this audit if user-facing text (chat, usernames) is added in a later phase. **Re-checked 2026-08-28** against every file touched by the reframe-plan session (Lens Parity, Model/World workspace mode, Dualize, performance guardrails): zero new `innerHTML`/`outerHTML`/`insertAdjacentHTML`/`document.write` usages introduced; the one new dynamic-text write (the FPS meter) uses `.textContent`. Still nothing found.

## Required before Phase 5 (shared/multiplayer backend)

Phase 5 (Shared World) shipped 2026-08-12 — this section is no longer forward-looking, it's the actual current backend.

- [x] **Backend write authentication** — done via Supabase RLS (`supabase/schema.sql`): every write policy keys off `auth.uid()` (anonymous sign-in, no unauthenticated writes possible), not just app-level checks. `cells_insert_own`/`claims_insert_own` restrict authorship; `cells_delete_own` (plus the additive `cells_delete_asteroid` policy) restricts deletion.
- [x] **Rate limiting** — done 2026-08-13: `supabase/schema.sql`'s `cells_rate_limit` trigger + `check_rate_limit()`, a token bucket (capacity 15000, refill 20/sec) per identity, sized to never punish one legitimate large Fill/Generate click (up to 12431 cells) while still bounding sustained/scripted abuse. Verified live via direct SQL against a simulated auth context: correct consumption, correct rejection near-empty, correct incremental refill math. `render.js`/`sync.js` gained a debounced on-screen notice so a rejection is visible to the player instead of silently desyncing — verified live via a real mocked-rejection browser test.
- [x] **Backup strategy independent of live world-state** — done 2026-08-13, honestly scoped: a daily `pg_cron` job snapshots `cells`+`claims` into a separate `world_snapshots` table (30-day retention), verified live (manual invocation produced a correct row; `cron.job` confirms the schedule is active). This is NOT off-platform disaster recovery (a total project loss takes the snapshots too, since they're the same Postgres instance) — Supabase's own point-in-time recovery is a paid-plan feature not in use here. What it covers for real: the actually-likely failure modes (a buggy moderation pass, an application bug, a bad manual SQL edit).
- [ ] **GDPR considerations** (if EU users possible) — still open; `PRIVACY.md` at least discloses what's collected and is honest that shared-world deletion is manual/best-effort for now, but a real consent flow / self-service export-and-delete doesn't exist. Needs real legal review before this matters at any real scale.
- [ ] **CCPA considerations** (if California users possible) — same gap as GDPR above.

## Required before/alongside Phase 5.8 (Trust Zones / Moderation)

**2026-08-13: the remaining open items below are a deliberate scope
decision, not an oversight.** Sat down to build the reachability gate/
age-mode selector, got real pushback ("it seems quite a step to be able
to create anything offensive enough at this juncture to warrant legal
protection") — correct on inspection: this app's entire UGC surface is
placing fixed-material voxels from an 8-item enum, no chat, no free
text, no usernames beyond anonymous UUIDs, at effectively zero real
users. The already-shipped `flagged`/`removed` Report mechanism is a
real, working, proportionate safety valve for that surface right now.
Building the rest now would be exactly what `RHOMBIVERSE_PRINCIPLES.md`
section 0 (Grounded Simplicity) warns against — engineering for a
hypothetical future requirement. **Revisit if**: free-text UGC (chat,
naming) gets added, the population grows past "effectively zero," or a
real incident occurs that flagged/removed doesn't adequately handle.

- [ ] **Written community guidelines** — still open, deliberately not drafted this pass (see above) for the actual in-world moderation judgment layer (what gets promoted `pending → reviewed/core` vs `flagged/removed`); the ring system is mechanism, this is the judgment humans apply on top of it. Distinct from the *community-space* guidelines added 2026-08-13 (the Discussions welcome post + `CODE_OF_CONDUCT.md`), which cover conduct in GitHub Issues/PRs/Discussions, not in-world content review.
- [ ] **DMCA takedown process, documented** — still open, deliberately not drafted this pass (see above). Genuinely more relevant than it was pre-launch (the repo is public and Shared World is live UGC), but not urgent at current scale/population.
- [x] **User-content ownership clause in ToS** — `TERMS.md`'s "Shared World and your content" section (added 2026-08-13) states what placing content in Shared World means: visible to and buildable-near by other players, may outlive your session, and the license you grant Rhombiverse to store/transmit/display it.
- [ ] **COPPA review** (US) — still open. Needs real legal review no Claude Code session can substitute for; not attempted here, deliberately, rather than faking a review. `PRIVACY.md`'s "Children's privacy" section is honest about collecting no PII even via Shared World's anonymous identity, but that's not a substitute for real review.
- [ ] **Moderator scaling plan** — still open (single maintainer). A staffing decision only the maintainer can make; not something to draft on their behalf.
- [ ] **Player-to-player abuse handling** — `CODE_OF_CONDUCT.md` (2026-08-13) now covers this for GitHub-side spaces (Issues/PRs/Discussions, which do have usernames). In-world player-to-player abuse handling (no chat/presence system exists yet) is still not applicable/not built.

## Required before/alongside going public as an open-source repo

Done, and the repo actually went public 2026-08-13.

- [x] **CONTRIBUTING.md** — added 2026-08-13. Explicitly welcomes AI-assisted/AI-generated PRs on equal footing with human ones (this repo has genuinely been built collaboratively with an AI coding agent from the start), asks for disclosure and real evidence of testing.
- [x] **CODE_OF_CONDUCT.md** — added 2026-08-13, the standard Contributor Covenant v2.1 adopted as-is, per this doc's own suggestion below.
- [x] **CLA decision** — skipped, per this doc's own explicit guidance that it's optional and unnecessary for the simplest open setup.
- [x] **.env / secrets audit** — done 2026-08-13 across full git history before flipping visibility: no `.env` files ever committed, no service-role/private keys, only the already-documented, intentionally-public Supabase publishable key (security is RLS, not key secrecy).
- [x] **GitHub Discussions enabled** — 2026-08-13, with light structured templates (`.github/DISCUSSION_TEMPLATE/`) on the Ideas/Q&A categories to nudge toward specificity, and a pinned welcome post explaining category purposes and the same "open commons, good faith over enforcement" framing as `TERMS.md`. Not originally a checklist item here, but the same category of "open-source readiness" work.

## Ongoing / lower urgency (worth designing for early, not blocking)

- [ ] **Accessibility** — colorblind-safe palette for status indicators (`approved`/`flagged`/`pending` should never rely on color alone); basic keyboard navigation for menus even in a mouse/touch-first 3D world.
- [ ] **Analytics/telemetry disclosure** — if added later, must be reflected in Privacy Policy and (if EU/CA users) consent-gated.

---

## Suggested Claude Code prompt for this document

> Using `RHOMBIVERSE_COMPLIANCE.md`, scaffold the repo-level files needed for the "Required before Phase 4" section: a `LICENSE` file (ask which license before generating), a minimal `TERMS.md`, a minimal `PRIVACY.md`, and a `SECURITY.md` with a placeholder reporting contact. Do not implement backend/auth items yet — those belong to the Phase 5 checklist section.
