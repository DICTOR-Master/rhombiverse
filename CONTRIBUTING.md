# Contributing to Rhombiverse

Rhombiverse is a small hobby project, open to improvements from anyone
who wants to make one — **human or AI**. This repo has actually been
built collaboratively with an AI coding agent (Claude Code) from the
start; there's no double standard here between a human PR and a
well-tested, clearly-described AI-assisted one. Read on for what "well
tested and clearly described" means in practice.

## Start here

1. **`CLAUDE.md`** (repo root) is the technical onboarding doc, for
   humans as much as agents: what the app is, its scope guardrails, how
   to run and check it, and the conventions that matter.
2. **`docs/RHOMBIVERSE_PRINCIPLES.md`**: the short design law every
   decision here traces back to.
3. **`docs/guide.md`**: how the app is used, the same text users read.

## Ground rules this project actually follows

- **No build step for local dev, by design.** Plain ES modules loaded
  via an import map in `index.html` — no bundler, no `npm install`
  needed to run or edit the app itself; any static file server works.
  Production (Vercel) does run `npm run build` (`scripts/build.mjs`) to minify each `src/**/*.js` file in place for real
  measured performance — no bundling, same module graph, doesn't
  change local dev at all. Don't add bundling, or anything that would
  make local dev need tooling, unless a real requirement forces it.
- **Grounded Simplicity.** Borrow real math and crystallography over
  inventing something arbitrary; prefer the simplest version that still
  works. If you're tuning a constant with no real-world anchor
  (this repo has a few), say so in a comment rather than presenting it
  as derived.
- **The world is data.** A build is plain JSON, one store per lattice.
  Extend it rather than breaking what's saved, and migrate old saves on
  load.
- **Comments explain WHY, not WHAT.** Well-named code and this repo's
  own docs already say what something does. A comment earns its place
  by capturing a non-obvious constraint, a bug that was actually hit, or
  a reason a simpler approach doesn't work — not by restating the code.

## Running it locally

No build step — serve the directory with any static file server:

```
cd rhombiverse
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Testing your change

`tests/` has a CI-wired suite (`.github/workflows/ci.yml`, runs on every
push/PR): unit tests for pure lattice/world-state logic (`node --test
tests/unit/`) and a real-browser Playwright smoke test (`tests/browser/`).
See `tests/README.md` to run either locally. That covers regressions in
the core math and a basic real-browser sanity check — it does not
replace direct execution for anything nontrivial. In practice, changes
in this repo have been verified by direct execution — real browser runs
(Playwright), or a portable Node.js + the real `three` package for pure
lattice/raycast math — rather than by static reading alone, because
static reading has repeatedly missed real bugs here. You don't need
that exact setup, but your PR should say **what you actually did to
confirm the change works**, not just "should work." A screenshot, a
console-error-free run, or a described manual test all count.

## Making a PR

1. Fork the repo, branch off `master`.
2. Keep the change scoped to what it says it does — this project avoids
   unrelated cleanup riding along with a feature/fix.
3. Describe what you tested and how in the PR description.
4. **If a PR (or parts of it) was AI-generated or AI-assisted, say so.**
   That's not a mark against it — it's just accurate attribution, same
   as crediting any other tool or collaborator, and it helps reviewers
   calibrate what to double-check.
5. Be patient — this is maintained by one person in their spare time.

## Reporting bugs or security issues

Regular bugs: open a GitHub issue. Security issues: see `SECURITY.md`
— please don't file those as public issues.

## Code of Conduct

This project follows the Contributor Covenant — see
`CODE_OF_CONDUCT.md`. Short version: be respectful, assume good faith,
and help each other out.
