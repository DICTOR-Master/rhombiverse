#!/usr/bin/env bash
# Git Resilience (reframe Stage 4): produces a full, restorable snapshot
# of this repository via `git bundle` -- every branch, tag, and ref, not
# just the current branch -- stored OUTSIDE the working tree so a
# problem with the working tree (or the whole repo directory) can't take
# the backups down with it. See docs/GIT_RESILIENCE.md for the restore
# procedure and the reasoning behind this approach.
set -euo pipefail

REPO_ROOT="$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)"
BACKUP_DIR="${RHOMBIVERSE_BACKUP_DIR:-$HOME/rhombiverse-backups}"
KEEP="${RHOMBIVERSE_BACKUP_KEEP:-30}" # how many recent bundles to retain; 0 disables pruning
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BUNDLE_PATH="$BACKUP_DIR/rhombiverse-$TIMESTAMP.bundle"

mkdir -p "$BACKUP_DIR"

cd "$REPO_ROOT"
git bundle create "$BUNDLE_PATH" --all

# Fail loudly rather than leaving a silently-corrupt bundle around --
# `git bundle verify` checks the bundle is well-formed and that its
# prerequisite objects are actually present.
git bundle verify "$BUNDLE_PATH" >/dev/null

echo "Backup created: $BUNDLE_PATH"
git bundle list-heads "$BUNDLE_PATH" | sed 's/^/  /'

if [ "$KEEP" -gt 0 ]; then
  # Prune oldest bundles beyond $KEEP -- relies on the filename's own
  # timestamp sorting lexicographically the same as chronologically
  # (YYYYMMDD-HHMMSS), so no separate mtime bookkeeping is needed.
  mapfile -t ALL_BUNDLES < <(ls -1 "$BACKUP_DIR"/rhombiverse-*.bundle 2>/dev/null | sort)
  COUNT=${#ALL_BUNDLES[@]}
  if [ "$COUNT" -gt "$KEEP" ]; then
    TO_REMOVE=$((COUNT - KEEP))
    for ((i = 0; i < TO_REMOVE; i++)); do
      echo "Pruning old backup: ${ALL_BUNDLES[$i]}"
      rm -f "${ALL_BUNDLES[$i]}"
    done
  fi
fi
