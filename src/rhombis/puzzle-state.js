// Rhombis puzzle state machine -- pure logic, no THREE/DOM, same
// "core logic separate from rendering" split as worldstate-core.js.
// Full design: docs/RHOMBIVERSE_SPEC_RHOMBIS_GAME_BUILD_PLAN.md
// ("Interaction model": tap a piece, tap its destination).
//
// Deliberately minimal for Stage 1 (one piece, one void, no orientation
// check) but shaped the way the spec's own later stages need: `pieces`
// and `voids` are arrays from the start (not a single hardcoded pair),
// since Stage 3 already requires the tray to "track counts of identical
// pieces" -- an array of piece entries supports that for free, a single
// piece/void pair would not.
//
// Stage 2 adds `orientation` (on a piece) and `requiredOrientation` (on
// a void), both optional -- a piece/void with neither set behaves
// exactly as Stage 1 did (no orientation gate), so this is additive,
// not a schema change to what Stage 1 already relies on.
//
// Stage 5 adds `groupIds` (on a void, an array) and `fillsGroup` (on a
// piece, a single id). A normal ("loose") piece never sets `fillsGroup`
// and behaves exactly as before -- fills the one void it's tapped
// onto. A "fused" piece's `fillsGroup` names one id; placing it fills
// EVERY void whose `groupIds` INCLUDES that id, in one placement, but
// only if none of them are filled yet (a fused piece physically can't
// fit where a loose piece already sits) -- the spec's own "more than
// one valid decomposition of the same volume": the group's voids stay
// individually fillable by loose pieces too, right up until a fused
// piece claims the whole group at once. `groupIds` is an ARRAY, not a
// single id, because a void can belong to more than one fused piece's
// own group at once -- a 2-cell composite's void belongs to both its
// own cell's single-cell group (a decoy single-RD fused piece can
// still claim just that cell) AND a shared cross-cell group (a
// "joined pair" fused piece spanning both cells at once). Every
// existing single-group void just gets a one-element array; nothing
// about the single-group case changed semantically.
//
// Every void also tracks `filledBy` (a piece id, or null while open) --
// Stage 7's undo needs a reverse mapping from a placed piece back to
// where it went (a loose piece's own one void's position/quaternion) to
// resync the scene after popping a history snapshot; a fused piece's
// own target comes from its `fillsGroup` directly instead, but its
// group's voids get `filledBy` set too, for uniformity.

// A "fillsGroup" sentinel for a fused piece that's interchangeable with
// every other geometrically-identical copy of itself -- direct
// instruction (2026-09-04, "it doesn't make sense in real world" --
// stage 11's own N-cell singles were each bound to ONE specific cell's
// group at build time, so a single that physically fits any open cell
// was rejected everywhere except the one arbitrary cell it happened to
// be assigned, exactly the "identical pieces should be interchangeable"
// property Stage 3's cube pieces already had). A piece with `fillsGroup
// === ANY_SINGLE_CELL_GROUP` resolves its ACTUAL target group at
// placement time from whichever void got tapped, rather than a group
// id fixed on the piece -- see `smallestEnclosingGroupId`.
export const ANY_SINGLE_CELL_GROUP = '__any-single-cell__';

// A void can belong to more than one group at once (its own single
// cell, a joined pair spanning it, "full", ...) -- the SMALLEST of
// those (fewest total voids) is always its own single-cell group,
// since any multi-cell group is strictly a superset of voids across
// more than one cell. General on purpose (compares real void counts,
// not a hardcoded 'cell-' string prefix) so it keeps working for
// whatever group shapes a stage defines, not just today's N-cell ones.
// Exported for `main.js`'s own undo/resync path, which needs the same
// resolution for an already-placed interchangeable piece (no fresh
// `placeSelected()` result to read `targetGroupId` off of there).
export function smallestEnclosingGroupId(state, voidEntry) {
  return voidEntry.groupIds.reduce((smallest, groupId) => {
    const count = state.voids.filter((v) => v.groupIds.includes(groupId)).length;
    const smallestCount = state.voids.filter((v) => v.groupIds.includes(smallest)).length;
    return count < smallestCount ? groupId : smallest;
  }, voidEntry.groupIds[0]);
}

// Resolves a piece's ACTUAL target group for a specific tapped void --
// its own fixed `fillsGroup`, or (for an interchangeable piece) whatever
// group is smallest among the tapped void's own groupIds.
function resolveTargetGroupId(state, piece, voidEntry) {
  return piece.fillsGroup === ANY_SINGLE_CELL_GROUP
    ? smallestEnclosingGroupId(state, voidEntry)
    : piece.fillsGroup;
}

export function createPuzzleState({ pieces, voids }) {
  return {
    pieces: pieces.map((p) => ({ ...p, placed: false })),
    voids: voids.map((v) => ({ ...v, filled: false, filledBy: null })),
    selectedPieceId: null,
  };
}

export function selectPiece(state, pieceId) {
  const piece = state.pieces.find((p) => p.id === pieceId);
  if (!piece || piece.placed) return state;
  return { ...state, selectedPieceId: pieceId };
}

export function deselect(state) {
  return { ...state, selectedPieceId: null };
}

// Spec's "rotating the piece itself matters" (Stage 2): cycles a piece
// through its own `orientationOptions` list (e.g. Stage 2's ['y+',
// 'y-']) to the next entry after its current `orientation`. A no-op for
// a piece with no `orientationOptions` at all (Stage 1's single piece,
// Stage 3's cube pieces -- those auto-orient on placement instead, no
// player-driven flip needed) or one already placed, so callers can
// invoke this unconditionally on "tap an already-selected piece again"
// without a feature check first. Cycling (not a hardcoded binary
// toggle) so a piece with more than 2 valid orientations works the same
// way without a second flip function.
export function flipPiece(state, pieceId) {
  const piece = state.pieces.find((p) => p.id === pieceId);
  if (!piece || piece.placed || !piece.orientationOptions || piece.orientationOptions.length < 2) {
    return state;
  }
  const options = piece.orientationOptions;
  const currentIndex = options.indexOf(piece.orientation);
  const next = options[(currentIndex + 1) % options.length];
  const pieces = state.pieces.map((p) => (p.id === pieceId ? { ...p, orientation: next } : p));
  return { ...state, pieces };
}

// A second, real way to reach an orientation besides stepping through
// flipPiece() one at a time -- direct instruction (2026-09-04): "three
// ways of matching orientation... you tap (as now), you revolve picker
// shape" (dragging a selected piece by hand should reach the SAME set
// of valid poses flipPiece() already cycles through, just arrived at
// by feel instead of blind tapping). Sets the orientation directly to
// any key already in the piece's own `orientationOptions` -- a no-op
// for a placed piece, one with no `orientationOptions`, or a key not
// actually in that piece's own list (never silently accepts an
// orientation the piece couldn't reach some other way).
export function setPieceOrientation(state, pieceId, orientationKey) {
  const piece = state.pieces.find((p) => p.id === pieceId);
  if (!piece || piece.placed || !piece.orientationOptions || !piece.orientationOptions.includes(orientationKey)) {
    return state;
  }
  const pieces = state.pieces.map((p) => (p.id === pieceId ? { ...p, orientation: orientationKey } : p));
  return { ...state, pieces };
}

// Returns { state, placed, pieceId, voidId, filledVoidIds, reason } --
// `placed` false means the tap was rejected and the caller should show
// reject feedback rather than a placement. `reason` distinguishes *why*
// ('nothing-selected', 'already-filled', 'wrong-orientation', 'group-
// partially-filled') since Stage 2's own "Done when" criterion is
// specifically that a wrong orientation is "visibly rejected", not just
// any rejection. `filledVoidIds` is every void actually filled by a
// successful placement -- always length 1 for a loose piece (the
// tapped void itself), but every member of the group for a fused piece
// (Stage 5), so callers don't need to special-case which kind of piece
// just fired.
export function placeSelected(state, voidId) {
  const voidEntry = state.voids.find((v) => v.id === voidId);
  const pieceId = state.selectedPieceId;
  const piece = state.pieces.find((p) => p.id === pieceId);

  if (!pieceId || !piece || !voidEntry) {
    return { state, placed: false, pieceId, voidId, reason: 'nothing-selected' };
  }

  if (piece.fillsGroup) {
    const targetGroupId = resolveTargetGroupId(state, piece, voidEntry);
    if (!targetGroupId || !voidEntry.groupIds.includes(targetGroupId)) {
      return { state, placed: false, pieceId, voidId, reason: 'nothing-selected' };
    }
    const groupVoids = state.voids.filter((v) => v.groupIds.includes(targetGroupId));
    if (groupVoids.some((v) => v.filled)) {
      return { state, placed: false, pieceId, voidId, reason: 'group-partially-filled' };
    }
    const groupVoidIds = groupVoids.map((v) => v.id);
    const fillSet = new Set(groupVoidIds);
    const pieces = state.pieces.map((p) => (p.id === pieceId ? { ...p, placed: true } : p));
    const voids = state.voids.map((v) => (fillSet.has(v.id) ? { ...v, filled: true, filledBy: pieceId } : v));
    return {
      state: { pieces, voids, selectedPieceId: null },
      placed: true,
      pieceId,
      voidId,
      filledVoidIds: groupVoidIds,
      // The group ACTUALLY filled -- same as `piece.fillsGroup` for a
      // fixed-group piece, but for an interchangeable one (fillsGroup
      // === ANY_SINGLE_CELL_GROUP) this is the real resolved id, not
      // the sentinel. Callers need this (not `piece.fillsGroup`) to
      // look up the group's own position/quaternion for visual snapping.
      targetGroupId,
    };
  }

  if (voidEntry.filled) {
    return { state, placed: false, pieceId, voidId, reason: 'already-filled' };
  }
  if (voidEntry.requiredOrientation && piece.orientation !== voidEntry.requiredOrientation) {
    return { state, placed: false, pieceId, voidId, reason: 'wrong-orientation' };
  }

  const pieces = state.pieces.map((p) => (p.id === pieceId ? { ...p, placed: true } : p));
  const voids = state.voids.map((v) => (v.id === voidId ? { ...v, filled: true, filledBy: pieceId } : v));
  return {
    state: { pieces, voids, selectedPieceId: null },
    placed: true,
    pieceId,
    voidId,
    filledVoidIds: [voidId],
  };
}

export function isSolved(state) {
  return state.voids.every((v) => v.filled);
}

// Classifies every unfilled void as valid (true) or invalid (false) for
// the given piece, at its CURRENT orientation -- direct instruction
// (2026-09-03): the skeleton itself should show green/red per-void
// while a piece is selected, not just react after a rejected tap.
// Surfaces the exact same rules placeSelected() itself enforces, so a
// void that reads green here is guaranteed to succeed if tapped next,
// and one that reads red is guaranteed to reject. Filled voids are
// omitted (the caller already renders those as "filled", not
// valid/invalid). For a fused piece (Stage 5), every void in ITS group
// reads valid together or not at all -- matches placeSelected()'s own
// all-or-nothing group check -- and a void outside that group always
// reads invalid for it. An interchangeable piece (`fillsGroup ===
// ANY_SINGLE_CELL_GROUP`) resolves its target group PER VOID (each
// void may belong to a different single-cell group), rather than once
// for the whole piece -- a fixed-group piece still resolves to the
// exact same single group for every void, so this changed nothing
// about its own result, just where the lookup happens.
export function voidValidityForPiece(state, pieceId) {
  const piece = state.pieces.find((p) => p.id === pieceId);
  const validByVoidId = {};
  const canAct = Boolean(piece && !piece.placed);

  for (const v of state.voids) {
    if (v.filled) continue;
    if (!canAct) {
      validByVoidId[v.id] = false;
    } else if (piece.fillsGroup) {
      const targetGroupId = resolveTargetGroupId(state, piece, v);
      const inGroup = Boolean(targetGroupId) && v.groupIds.includes(targetGroupId);
      validByVoidId[v.id] = inGroup && state.voids.filter((vv) => vv.groupIds.includes(targetGroupId)).every((vv) => !vv.filled);
    } else {
      validByVoidId[v.id] = !v.requiredOrientation || v.requiredOrientation === piece.orientation;
    }
  }
  return validByVoidId;
}
