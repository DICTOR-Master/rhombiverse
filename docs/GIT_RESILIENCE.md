# Git Resilience

Local backup and commit-granularity practices for this repository, per
the reframe brief's Stage 4. Process/tooling only — no application code
depends on anything here.

## Why a local backup on top of GitHub

GitHub hosting is a real, live remote, but it isn't a substitute for a
local, on-demand, fully offline snapshot: a compromised/lost GitHub
account, an accidental force-push, or a `git filter-repo` mistake could
all still leave the *remote* history damaged. A `git bundle` is a single
file containing a complete copy of the repository's objects and refs —
restorable to a fully working clone with nothing but `git` itself, no
network required.

## Creating a backup

```
./scripts/backup.sh
```

This produces a timestamped bundle of **every branch, tag, and ref** (not
just the current branch) at `~/rhombiverse-backups/rhombiverse-<timestamp>.bundle`
— a sibling directory of this repo, not inside it, so a problem with the
repo directory itself (accidental `rm -rf`, a corrupted working tree)
can't take the backups down with it. The script verifies the bundle
immediately after creating it (`git bundle verify`) and fails loudly
rather than leaving a silently-corrupt file behind.

By default it also prunes old backups, keeping the most recent 30.
Override either path via environment variables if needed:

```
RHOMBIVERSE_BACKUP_DIR=/some/other/path RHOMBIVERSE_BACKUP_KEEP=10 ./scripts/backup.sh
```

Set `RHOMBIVERSE_BACKUP_KEEP=0` to disable pruning entirely.

Verified live (2026-08-28): a real backup was created, its bundle
verified, and a real `git clone` from that bundle produced a working
repository with the expected commit history — not just reasoned about.

## Restoring from a backup

**Full restore into a new directory** (e.g. the repo directory was lost
or corrupted):

```
git clone ~/rhombiverse-backups/rhombiverse-<timestamp>.bundle rhombiverse-restored
```

**Recovering specific history into an existing clone** (e.g. you need to
pull back a branch or commit that's gone from your working clone but is
still in an old bundle):

```
git remote add backup ~/rhombiverse-backups/rhombiverse-<timestamp>.bundle
git fetch backup
# then inspect/cherry-pick/reset as needed, e.g.:
git log backup/master
git remote remove backup   # once done
```

**Checking what a bundle contains without restoring anything:**

```
git bundle verify ~/rhombiverse-backups/rhombiverse-<timestamp>.bundle
git bundle list-heads ~/rhombiverse-backups/rhombiverse-<timestamp>.bundle
```

## Running it on a schedule (optional)

The script is safe to run unattended — it's read-only against the repo
(a `git bundle create` never mutates anything) and self-contained. To
back up automatically, add a cron entry (`crontab -e`); this is
**not** installed automatically by this repo — add it yourself if you
want scheduled backups:

```
# Hourly, logging output for troubleshooting:
0 * * * * /home/dicto/rhombiverse/scripts/backup.sh >> /home/dicto/rhombiverse-backups/backup.log 2>&1
```

## Commit granularity

Reviewed recent history (`git log`) for commits bundling unrelated
changes together, per the reframe brief's own instruction. Most commits
are well-scoped to one logical change. Two real exceptions found:

- `644b73c` ("Persist camera view across reloads; real, placeable BCC
  dual-lattice cells") — two named changes in one commit, though the
  commit message documents a real causal link (building BCC Build
  surfaced the camera-persistence bug, fixed together) rather than pure
  batching.
- `4b6da63` ("Add a production-only minify build step; welcome-screen
  copy/layout fixes") — two unrelated concerns (build tooling; UI copy)
  genuinely batched into one commit with no stated causal link between
  them.

The large multi-file commits further back (`23fdafd`, 69 files;
`8af98ad`, 45 files) are legitimate single-purpose bulk moves (`git mv`
reorganizations), not a granularity problem — a bulk move is one logical
change regardless of file count.

**Going forward:** commit each logical change separately — one stage, or
one clearly separable piece of a stage, per commit — rather than
batching unrelated work into one commit for convenience. The reframe
plan's own Stage 0–3 work in this session already followed this
(gating), landing as one commit per stage plus a separate follow-up
commit for the later Dualize schema-decision note rather than folding
it into Stage 3's own commit after the fact.
