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

export function createPuzzleState({ pieces, voids }) {
  return {
    pieces: pieces.map((p) => ({ ...p, placed: false })),
    voids: voids.map((v) => ({ ...v, filled: false })),
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

// Returns { state, placed, pieceId, voidId, reason } -- `placed` false
// means the tap was rejected and the caller should show reject
// feedback rather than a placement. `reason` distinguishes *why*
// ('nothing-selected', 'already-filled', 'wrong-orientation') since
// Stage 2's own "Done when" criterion is specifically that a wrong
// orientation is "visibly rejected", not just any rejection.
export function placeSelected(state, voidId) {
  const voidEntry = state.voids.find((v) => v.id === voidId);
  const pieceId = state.selectedPieceId;
  const piece = state.pieces.find((p) => p.id === pieceId);

  if (!pieceId || !piece || !voidEntry) {
    return { state, placed: false, pieceId, voidId, reason: 'nothing-selected' };
  }
  if (voidEntry.filled) {
    return { state, placed: false, pieceId, voidId, reason: 'already-filled' };
  }
  if (voidEntry.requiredOrientation && piece.orientation !== voidEntry.requiredOrientation) {
    return { state, placed: false, pieceId, voidId, reason: 'wrong-orientation' };
  }

  const pieces = state.pieces.map((p) => (p.id === pieceId ? { ...p, placed: true } : p));
  const voids = state.voids.map((v) => (v.id === voidId ? { ...v, filled: true } : v));
  return {
    state: { pieces, voids, selectedPieceId: null },
    placed: true,
    pieceId,
    voidId,
  };
}

export function isSolved(state) {
  return state.voids.every((v) => v.filled);
}

// Classifies every unfilled void as valid (true) or invalid (false) for
// the given piece, at its CURRENT orientation -- direct instruction
// (2026-09-03): the skeleton itself should show green/red per-void
// while a piece is selected, not just react after a rejected tap.
// Surfaces the exact same rule placeSelected()'s own orientation check
// enforces, so a void that reads green here is guaranteed to succeed if
// tapped next, and one that reads red is guaranteed to hit
// 'wrong-orientation'. Filled voids are omitted (the caller already
// renders those as "filled", not valid/invalid).
export function voidValidityForPiece(state, pieceId) {
  const piece = state.pieces.find((p) => p.id === pieceId);
  const validByVoidId = {};
  for (const v of state.voids) {
    if (v.filled) continue;
    validByVoidId[v.id] = Boolean(
      piece && !piece.placed && (!v.requiredOrientation || v.requiredOrientation === piece.orientation),
    );
  }
  return validByVoidId;
}
