# Rhombiverse — Compliance, Safety & Governance Checklist

Companion document to `RHOMBIVERSE_PLAN.md`. This covers everything *outside* the core build/render mechanics that becomes necessary as the project moves from private repo → public repo → public UGC world with real users.

Each item below is tagged with **when it's required by**, mapped to the phases in the main plan. Nothing here blocks Phase 1–3 (local, single-player, private repo).

---

## Required before Phase 4 (public playable link)

- [ ] **License file** (`LICENSE`) — choose before first public exposure:
  - MIT / Apache-2.0 → permissive, easiest for others to build on.
  - GPL-family → derivatives must stay open-source.
  - Decision affects who can fork/commercialize later — treat as near-irreversible once adopted.
- [ ] **Terms of Service** — even minimal, required once strangers can use the app and their data/content is stored.
- [ ] **Privacy Policy** — required if any data is collected (even just localStorage-only usage counts or future accounts).
- [ ] **SECURITY.md** — private vulnerability reporting channel (e.g. an email or GitHub private security advisory), standard open-source norm before wide exposure.
- [ ] **Input sanitization audit** — any user-submitted text (world names, usernames, future chat) must be sanitized before being rendered back into the DOM (XSS prevention). Do this before Phase 4, not after.

## Required before Phase 5 (shared/multiplayer backend)

- [ ] **Backend write authentication** — no unauthenticated or unlimited writes to the shared world-state once a real backend exists.
- [ ] **Rate limiting** — cap builds/placements per user/time window to prevent griefing or lattice-spam.
- [ ] **Backup strategy independent of live world-state** — the Phase 5.8 snapshot/rollback system doubles as moderation tooling AND disaster recovery, but confirm backups are stored somewhere separate from the live DB.
- [ ] **GDPR considerations** (if EU users possible) — right to data export and deletion; consent flow for any analytics.
- [ ] **CCPA considerations** (if California users possible) — similar deletion/disclosure rights.

## Required before/alongside Phase 5.8 (Trust Zones / Moderation)

- [ ] **Written community guidelines** — human-readable standard for what gets promoted `pending → reviewed/core` vs `flagged/removed`. The ring system is mechanism; this is the judgment layer humans apply.
- [ ] **DMCA takedown process, documented** — required for safe-harbor protection once UGC exists publicly; even a simple documented process (who receives reports, how content is pulled) matters legally.
- [ ] **User-content ownership clause in ToS** — state whether players own what they build and what license they grant you to host/display/moderate it.
- [ ] **COPPA review** (US) — if minors may realistically use the app, this is a real legal obligation around data collection from under-13 users, not satisfied by "family-friendly" design alone. Get real legal review here if audience will include children.
- [ ] **Moderator scaling plan** — identify at least a backup reviewer; a single-moderator bottleneck is a common failure point for small UGC open-source projects.
- [ ] **Player-to-player abuse handling** — separate from content moderation; needed once usernames/chat/presence exist.

## Required before/alongside going public as an open-source repo

- [ ] **CONTRIBUTING.md** — how outside contributors submit changes, coding conventions, PR process.
- [ ] **CODE_OF_CONDUCT.md** — standard for contributor behavior (many projects adopt the Contributor Covenant as-is).
- [ ] **CLA decision** — only needed if you want to retain rights to relicense later (e.g. dual open-source/commercial). Skip entirely if you want the simplest possible open project — this is optional, not required.
- [ ] **.env / secrets audit** — confirm no API keys or credentials are anywhere in git history before flipping repo visibility to public (check history, not just current files — a past commit with a leaked key remains exposed even after removal).

## Ongoing / lower urgency (worth designing for early, not blocking)

- [ ] **Accessibility** — colorblind-safe palette for status indicators (`approved`/`flagged`/`pending` should never rely on color alone); basic keyboard navigation for menus even in a mouse/touch-first 3D world.
- [ ] **Analytics/telemetry disclosure** — if added later, must be reflected in Privacy Policy and (if EU/CA users) consent-gated.

---

## Suggested Claude Code prompt for this document

> Using `RHOMBIVERSE_COMPLIANCE.md`, scaffold the repo-level files needed for the "Required before Phase 4" section: a `LICENSE` file (ask which license before generating), a minimal `TERMS.md`, a minimal `PRIVACY.md`, and a `SECURITY.md` with a placeholder reporting contact. Do not implement backend/auth items yet — those belong to the Phase 5 checklist section.
