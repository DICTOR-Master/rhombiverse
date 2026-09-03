// Rhombis puzzle state machine (src/rhombis/puzzle-state.js). Covers
// the spec's own "Done when" criteria per stage: one placement, wrong/
// empty taps rejected with feedback, clear solved state (Stage 1);
// wrong orientation visibly rejected, both pieces placeable in either
// order (Stage 2); 6 identical pieces placeable in any order (Stage 3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPuzzleState, selectPiece, deselect, flipPiece, placeSelected, isSolved, voidValidityForPiece } from '../../src/rhombis/puzzle-state.js';

function stage1State() {
  return createPuzzleState({
    pieces: [{ id: 'p0' }],
    voids: [{ id: 'v0' }],
  });
}

// Stage 2's real shape: two 'y+' (apex up) pieces, one void wants 'y+'
// as-is, the other wants 'y-' -- so solving genuinely requires flipping
// at least one piece, matching buildStage2()'s own tray setup (see
// src/rhombis/stages.js).
function stage2State() {
  const orientationOptions = ['y+', 'y-'];
  return createPuzzleState({
    pieces: [
      { id: 'p0', orientation: 'y+', orientationOptions },
      { id: 'p1', orientation: 'y+', orientationOptions },
    ],
    voids: [
      { id: 'v-up', requiredOrientation: 'y+' },
      { id: 'v-down', requiredOrientation: 'y-' },
    ],
  });
}

// Stage 3's real shape: 6 identical, non-flippable pieces (auto-orient
// on placement, see stages.js's buildStage3) and 6 voids with no
// orientation gate at all.
function stage3State() {
  return createPuzzleState({
    pieces: [0, 1, 2, 3, 4, 5].map((i) => ({ id: `p${i}` })),
    voids: ['x+', 'x-', 'y+', 'y-', 'z+', 'z-'].map((axis) => ({ id: `v-${axis}` })),
  });
}

// Stage 4's real shape (manual-orientation prototype, 2026-09-03: "feel
// out" whether requiring real orientation work at Stage 4 makes the
// puzzle read as a genuine jigsaw rather than "revolve one big shape
// until it fits"). 12 flippable pieces, all starting at the SAME wrong
// orientation ('x+:in', matching Stage 1's own "starts wrong" design),
// cycling through RD_ORIENTATIONS (see stages.js) to match whichever
// void they're headed for -- no auto-snap. Each void now has exactly
// one correct `requiredOrientation` (12 voids, 12 distinct required
// orientations, a real 1:1).
const RD_ORIENTATIONS = ['x+', 'x-', 'y+', 'y-', 'z+', 'z-'].flatMap((axis) => [`${axis}:in`, `${axis}:out`]);

function stage4State() {
  return createPuzzleState({
    pieces: Array.from({ length: 12 }, (_, i) => ({
      id: `p${i}`,
      orientation: 'x+:in',
      orientationOptions: RD_ORIENTATIONS,
    })),
    voids: RD_ORIENTATIONS.map((orientation) => {
      const [axis, dir] = orientation.split(':');
      return { id: `v-${dir}-${axis}`, requiredOrientation: orientation };
    }),
  });
}

test('placing into a void with no piece selected is rejected', () => {
  const state = stage1State();
  const result = placeSelected(state, 'v0');
  assert.equal(result.placed, false);
  assert.equal(isSolved(result.state), false);
});

test('select then place fills the void and clears the selection', () => {
  let state = stage1State();
  state = selectPiece(state, 'p0');
  assert.equal(state.selectedPieceId, 'p0');

  const result = placeSelected(state, 'v0');
  assert.equal(result.placed, true);
  assert.equal(result.state.selectedPieceId, null);
  assert.equal(result.state.pieces[0].placed, true);
  assert.equal(result.state.voids[0].filled, true);
  assert.equal(isSolved(result.state), true);
});

test('selecting an already-placed piece is a no-op', () => {
  let state = stage1State();
  state = selectPiece(state, 'p0');
  state = placeSelected(state, 'v0').state;

  const reselected = selectPiece(state, 'p0');
  assert.equal(reselected.selectedPieceId, null);
});

test('placing into an already-filled void is rejected', () => {
  let state = stage1State();
  state = selectPiece(state, 'p0');
  state = placeSelected(state, 'v0').state;

  // No second piece to select in Stage 1, but a stray tap on the same
  // void with nothing selected must still reject cleanly, not throw.
  const result = placeSelected(state, 'v0');
  assert.equal(result.placed, false);
});

test('deselect clears the current selection without placing anything', () => {
  let state = stage1State();
  state = selectPiece(state, 'p0');
  state = deselect(state);
  assert.equal(state.selectedPieceId, null);
  assert.equal(isSolved(state), false);
});

test('selecting a nonexistent piece id is a no-op', () => {
  const state = stage1State();
  const result = selectPiece(state, 'does-not-exist');
  assert.equal(result.selectedPieceId, null);
});

test('flipping a piece with no orientationOptions (Stage 1 and Stage 3) is a no-op', () => {
  let state = stage1State();
  state = selectPiece(state, 'p0');
  const flipped = flipPiece(state, 'p0');
  assert.equal(flipped.pieces[0].orientation, undefined);

  let cubeState = stage3State();
  cubeState = selectPiece(cubeState, 'p0');
  const flippedCube = flipPiece(cubeState, 'p0');
  assert.equal(flippedCube.pieces[0].orientation, undefined);
});

test('placing a y+ piece into the y- void is rejected as wrong-orientation, not placed', () => {
  let state = stage2State();
  state = selectPiece(state, 'p0');
  const result = placeSelected(state, 'v-down');
  assert.equal(result.placed, false);
  assert.equal(result.reason, 'wrong-orientation');
  assert.equal(result.state.voids.find((v) => v.id === 'v-down').filled, false);
  // rejection must not silently consume the selection either
  assert.equal(result.state.selectedPieceId, 'p0');
});

test('flipping the selected piece then placing succeeds', () => {
  let state = stage2State();
  state = selectPiece(state, 'p0');
  state = flipPiece(state, 'p0');
  assert.equal(state.pieces.find((p) => p.id === 'p0').orientation, 'y-');

  const result = placeSelected(state, 'v-down');
  assert.equal(result.placed, true);
  assert.equal(result.state.voids.find((v) => v.id === 'v-down').filled, true);
});

test('flipping twice returns to the original orientation', () => {
  let state = stage2State();
  state = flipPiece(state, 'p0');
  state = flipPiece(state, 'p0');
  assert.equal(state.pieces.find((p) => p.id === 'p0').orientation, 'y+');
});

test('either piece can fill either void once oriented correctly -- order does not matter', () => {
  let state = stage2State();
  // Place p1 (flipped to y-) into v-down first...
  state = flipPiece(selectPiece(state, 'p1'), 'p1');
  state = placeSelected(state, 'v-down').state;
  // ...then p0 (still y+) into v-up.
  state = selectPiece(state, 'p0');
  const result = placeSelected(state, 'v-up');
  assert.equal(result.placed, true);
  assert.equal(isSolved(result.state), true);
});

test('a placed piece can no longer be flipped', () => {
  let state = stage2State();
  state = selectPiece(state, 'p0');
  state = placeSelected(state, 'v-up').state;
  const flipped = flipPiece(state, 'p0');
  assert.equal(flipped.pieces.find((p) => p.id === 'p0').orientation, 'y+');
});

test('Stage 3: all 6 identical pieces placeable in any order, filling all 6 voids solves it', () => {
  let state = stage3State();
  const voidOrder = ['v-z-', 'v-x+', 'v-y-', 'v-z+', 'v-x-', 'v-y+']; // deliberately shuffled
  const pieceIds = state.pieces.map((p) => p.id);

  voidOrder.forEach((voidId, i) => {
    state = selectPiece(state, pieceIds[i]);
    const result = placeSelected(state, voidId);
    assert.equal(result.placed, true, `placing ${pieceIds[i]} into ${voidId} should succeed`);
    state = result.state;
  });

  assert.equal(isSolved(state), true);
});

test('Stage 3: placing into an already-filled face is rejected, and does not consume a second piece', () => {
  let state = stage3State();
  state = selectPiece(state, 'p0');
  state = placeSelected(state, 'v-x+').state;

  state = selectPiece(state, 'p1');
  const result = placeSelected(state, 'v-x+');
  assert.equal(result.placed, false);
  assert.equal(result.reason, 'already-filled');
  // p1 must still be available to place elsewhere
  assert.equal(state.pieces.find((p) => p.id === 'p1').placed, false);
});

test('voidValidityForPiece: reports green/red exactly matching what placeSelected would do', () => {
  const state = stage2State();
  const validity = voidValidityForPiece(state, 'p0'); // p0 is 'y+'
  assert.equal(validity['v-up'], true);
  assert.equal(validity['v-down'], false);

  // After flipping, the valid void should flip too.
  const flipped = flipPiece(state, 'p0');
  const flippedValidity = voidValidityForPiece(flipped, 'p0');
  assert.equal(flippedValidity['v-up'], false);
  assert.equal(flippedValidity['v-down'], true);
});

test('voidValidityForPiece: a void with no requiredOrientation (Stage 3) is always valid for an unplaced piece', () => {
  const state = stage3State();
  const validity = voidValidityForPiece(state, 'p0');
  for (const axis of ['x+', 'x-', 'y+', 'y-', 'z+', 'z-']) {
    assert.equal(validity[`v-${axis}`], true);
  }
});

test('voidValidityForPiece: filled voids are omitted, and no piece selected reports nothing valid', () => {
  let state = stage2State();
  state = selectPiece(state, 'p0');
  state = placeSelected(state, 'v-up').state;

  const validity = voidValidityForPiece(state, 'p1');
  assert.equal('v-up' in validity, false); // filled -- omitted, not false
  assert.equal(validity['v-down'], false); // p1 is still 'y+', v-down wants 'y-'

  const noSelection = voidValidityForPiece(state, 'does-not-exist');
  assert.equal(noSelection['v-down'], false);
});

// Cycles the given piece (flipPiece) until it reaches targetOrientation,
// bounded by the piece's own orientationOptions length so a real bug
// (never reaching the target) fails loudly instead of looping forever.
function flipUntilOriented(state, pieceId, targetOrientation) {
  const options = state.pieces.find((p) => p.id === pieceId).orientationOptions;
  for (let i = 0; i < options.length; i++) {
    const piece = state.pieces.find((p) => p.id === pieceId);
    if (piece.orientation === targetOrientation) return state;
    state = flipPiece(state, pieceId);
  }
  throw new Error(`${pieceId} never reached ${targetOrientation} within ${options.length} flips`);
}

test('Stage 4: all 12 identical pieces placeable in any order, once flipped to each void\'s own required orientation', () => {
  let state = stage4State();
  const voidIds = state.voids.map((v) => v.id);
  // Deliberately shuffle (reverse plus an interior swap) rather than
  // filling in construction order.
  const shuffled = [...voidIds].reverse();
  [shuffled[2], shuffled[9]] = [shuffled[9], shuffled[2]];
  const pieceIds = state.pieces.map((p) => p.id);

  shuffled.forEach((voidId, i) => {
    const pieceId = pieceIds[i];
    const requiredOrientation = state.voids.find((v) => v.id === voidId).requiredOrientation;
    state = selectPiece(state, pieceId);
    state = flipUntilOriented(state, pieceId, requiredOrientation);
    const result = placeSelected(state, voidId);
    assert.equal(result.placed, true, `placing ${pieceId} into ${voidId} should succeed once oriented`);
    state = result.state;
  });

  assert.equal(isSolved(state), true);
});

test('Stage 4: placing an un-flipped piece into a void that needs a different orientation is rejected', () => {
  let state = stage4State();
  state = selectPiece(state, 'p0'); // starts at 'x+:in'
  const result = placeSelected(state, 'v-out-x+'); // wants 'x+:out'
  assert.equal(result.placed, false);
  assert.equal(result.reason, 'wrong-orientation');
});

test('Stage 4: the inward and outward void on the same axis are independent -- filling one leaves the other open', () => {
  let state = stage4State();
  state = selectPiece(state, 'p0'); // already 'x+:in', matches v-in-x+ with no flip needed
  state = placeSelected(state, 'v-in-x+').state;

  assert.equal(state.voids.find((v) => v.id === 'v-in-x+').filled, true);
  assert.equal(state.voids.find((v) => v.id === 'v-out-x+').filled, false);
  assert.equal(isSolved(state), false);
});

test('Stage 4: flipping cycles through all 12 orientations and wraps back to the start', () => {
  let state = stage4State();
  for (let i = 0; i < 12; i++) state = flipPiece(state, 'p0');
  assert.equal(state.pieces.find((p) => p.id === 'p0').orientation, 'x+:in');
});

// Stage 5's real shape: the same 6-void cube as Stage 3, but the tray
// also has one pre-fused piece that fills the whole group in a single
// placement -- see stages.js's buildStage5. Both are real, independent
// decompositions of the identical volume.
function stage5State() {
  return createPuzzleState({
    pieces: [
      ...[0, 1, 2, 3, 4, 5].map((i) => ({ id: `p${i}` })),
      { id: 'fused', fillsGroup: 'cube' },
    ],
    voids: ['x+', 'x-', 'y+', 'y-', 'z+', 'z-'].map((axis) => ({ id: `v-${axis}`, groupIds: ['cube'] })),
  });
}

test('Stage 5: the fused piece fills every void in its group from a single tap', () => {
  let state = stage5State();
  state = selectPiece(state, 'fused');
  const result = placeSelected(state, 'v-y+');
  assert.equal(result.placed, true);
  assert.deepEqual(
    result.filledVoidIds.sort(),
    ['v-x+', 'v-x-', 'v-y+', 'v-y-', 'v-z+', 'v-z-'],
  );
  assert.equal(isSolved(result.state), true);
  assert.equal(result.state.pieces.find((p) => p.id === 'fused').placed, true);
  // The 6 loose pieces were never individually used.
  for (let i = 0; i < 6; i++) {
    assert.equal(result.state.pieces.find((p) => p.id === `p${i}`).placed, false);
  }
});

test('Stage 5: the cube is ALSO solvable the loose way, one pyramid at a time (the other valid decomposition)', () => {
  let state = stage5State();
  const voidIds = state.voids.map((v) => v.id);
  voidIds.forEach((voidId, i) => {
    state = selectPiece(state, `p${i}`);
    const result = placeSelected(state, voidId);
    assert.equal(result.placed, true);
    state = result.state;
  });
  assert.equal(isSolved(state), true);
  assert.equal(state.pieces.find((p) => p.id === 'fused').placed, false);
});

test('Stage 5: the fused piece is rejected once any loose piece has claimed part of the group', () => {
  let state = stage5State();
  state = selectPiece(state, 'p0');
  state = placeSelected(state, 'v-x+').state;

  state = selectPiece(state, 'fused');
  const result = placeSelected(state, 'v-y+');
  assert.equal(result.placed, false);
  assert.equal(result.reason, 'group-partially-filled');
  // The 5 still-open voids must be untouched by the rejected attempt.
  assert.equal(state.voids.filter((v) => v.filled).length, 1);
});

test('voidValidityForPiece: the fused piece reads all-green when the group is fully open, and turns all-red once any member is claimed', () => {
  let state = stage5State();
  let validity = voidValidityForPiece(state, 'fused');
  for (const axis of ['x+', 'x-', 'y+', 'y-', 'z+', 'z-']) {
    assert.equal(validity[`v-${axis}`], true);
  }

  state = selectPiece(state, 'p0');
  state = placeSelected(state, 'v-x+').state;
  validity = voidValidityForPiece(state, 'fused');
  // v-x+ is now filled -- omitted entirely, not just false.
  assert.equal('v-x+' in validity, false);
  for (const axis of ['x-', 'y+', 'y-', 'z+', 'z-']) {
    assert.equal(validity[`v-${axis}`], false);
  }
});

// Stage 6's real shape: two independent 12-void cells (Stage 4's own
// RD, repeated), each with its own fused-whole-RD alternate -- see
// stages.js's buildStage6. groupIds/fillsGroup already generalize to
// more than one simultaneous group for free (no puzzle-state.js
// changes were needed to build this stage).
function stage6State() {
  const axes = ['x+', 'x-', 'y+', 'y-', 'z+', 'z-'];
  const cellVoidIds = (cellId) => axes.flatMap((axis) => [`v-${cellId}-in-${axis}`, `v-${cellId}-out-${axis}`]);
  const voids = [
    ...cellVoidIds('cell-0').map((id) => ({ id, groupIds: ['cell-0'] })),
    ...cellVoidIds('cell-1').map((id) => ({ id, groupIds: ['cell-1'] })),
  ];
  return createPuzzleState({
    pieces: [
      ...Array.from({ length: 24 }, (_, i) => ({ id: `p${i}` })),
      { id: 'fused-cell-0', fillsGroup: 'cell-0' },
      { id: 'fused-cell-1', fillsGroup: 'cell-1' },
    ],
    voids,
  });
}

test('Stage 6: solvable with both cells fused (one tap each)', () => {
  let state = stage6State();
  state = selectPiece(state, 'fused-cell-0');
  state = placeSelected(state, 'v-cell-0-in-x+').state;
  state = selectPiece(state, 'fused-cell-1');
  const result = placeSelected(state, 'v-cell-1-out-z-');
  assert.equal(result.placed, true);
  assert.equal(isSolved(result.state), true);
});

test('Stage 6: solvable with one cell fused and the other built loose (a genuinely different combination)', () => {
  let state = stage6State();
  state = selectPiece(state, 'fused-cell-0');
  state = placeSelected(state, 'v-cell-0-in-x+').state;

  const cell1VoidIds = state.voids.filter((v) => v.groupIds.includes('cell-1')).map((v) => v.id);
  cell1VoidIds.forEach((voidId, i) => {
    state = selectPiece(state, `p${i}`);
    const result = placeSelected(state, voidId);
    assert.equal(result.placed, true);
    state = result.state;
  });

  assert.equal(isSolved(state), true);
});

test('Stage 6: fusing one cell does not affect the other cell\'s own fused option', () => {
  let state = stage6State();
  state = selectPiece(state, 'fused-cell-0');
  state = placeSelected(state, 'v-cell-0-in-x+').state;

  const validity = voidValidityForPiece(state, 'fused-cell-1');
  for (const v of state.voids.filter((vv) => vv.groupIds.includes('cell-1'))) {
    assert.equal(validity[v.id], true);
  }
});

test('Stage 6: all 24 loose pieces (no fused pieces at all) is a third valid combination', () => {
  let state = stage6State();
  const voidIds = state.voids.map((v) => v.id);
  voidIds.forEach((voidId, i) => {
    state = selectPiece(state, `p${i}`);
    const result = placeSelected(state, voidId);
    assert.equal(result.placed, true);
    state = result.state;
  });
  assert.equal(isSolved(state), true);
  assert.equal(state.pieces.find((p) => p.id === 'fused-cell-0').placed, false);
  assert.equal(state.pieces.find((p) => p.id === 'fused-cell-1').placed, false);
});

// The joined-pair stage's real shape (id 7 in STAGES, "Joined Pair" --
// not to be confused with this file's own older "Stage 7" comments
// below, which predate this and refer to the undo-feature milestone,
// not a playable puzzle level; see stages.js's buildStage7). Same
// 2-cell layout as Stage 6, but no loose pieces at all -- exactly two
// fused pieces: a genuine cross-cell "joined pair" (fillsGroup:
// 'joined-01') and a same-cell "decoy" (fillsGroup: 'cell-0'). This is
// the real reason `groupIds` had to become an array: a cell-0 void
// belongs to BOTH 'cell-0' (the decoy's group) and 'joined-01' (the
// joined pair's group) at once.
function joinedPairState() {
  const axes = ['x+', 'x-', 'y+', 'y-', 'z+', 'z-'];
  const cellVoidIds = (cellId) => axes.flatMap((axis) => [`v-${cellId}-in-${axis}`, `v-${cellId}-out-${axis}`]);
  const voids = [
    ...cellVoidIds('cell-0').map((id) => ({ id, groupIds: ['cell-0', 'joined-01'] })),
    ...cellVoidIds('cell-1').map((id) => ({ id, groupIds: ['cell-1', 'joined-01'] })),
  ];
  return createPuzzleState({
    pieces: [
      { id: 'decoy', fillsGroup: 'cell-0' },
      { id: 'joined-pair', fillsGroup: 'joined-01' },
    ],
    voids,
  });
}

test('joined pair: fills all 24 voids across both cells from a single tap', () => {
  let state = joinedPairState();
  state = selectPiece(state, 'joined-pair');
  const result = placeSelected(state, 'v-cell-0-in-x+');
  assert.equal(result.placed, true);
  assert.equal(result.filledVoidIds.length, 24);
  assert.equal(isSolved(result.state), true);
});

test('joined pair: the decoy correctly fills just its own cell, a real (not fake) placement', () => {
  let state = joinedPairState();
  state = selectPiece(state, 'decoy');
  const result = placeSelected(state, 'v-cell-0-in-x+');
  assert.equal(result.placed, true);
  assert.equal(result.filledVoidIds.length, 12);
  assert.equal(result.filledVoidIds.every((id) => id.startsWith('v-cell-0-')), true);
  assert.equal(isSolved(result.state), false); // cell-1 still open, no piece left to fill it
});

test('joined pair: the decoy is rejected against cell-1 (wrong group)', () => {
  let state = joinedPairState();
  state = selectPiece(state, 'decoy');
  const result = placeSelected(state, 'v-cell-1-in-x+');
  assert.equal(result.placed, false);
});

test('joined pair: using the decoy on cell-0 traps the joined pair (group-partially-filled)', () => {
  let state = joinedPairState();
  state = selectPiece(state, 'decoy');
  state = placeSelected(state, 'v-cell-0-in-x+').state;

  state = selectPiece(state, 'joined-pair');
  const result = placeSelected(state, 'v-cell-1-in-x+');
  assert.equal(result.placed, false);
  assert.equal(result.reason, 'group-partially-filled');

  const validity = voidValidityForPiece(state, 'joined-pair');
  for (const v of state.voids.filter((vv) => !vv.filled)) {
    assert.equal(validity[v.id], false);
  }
});

// Stage 7's undo needs a reverse mapping from a placed piece back to
// where it went, to resync the scene after popping a history snapshot.
test('filledBy: a fresh void starts with no owner, and a loose placement records which piece filled it', () => {
  let state = stage1State();
  assert.equal(state.voids[0].filledBy, null);
  state = selectPiece(state, 'p0');
  const result = placeSelected(state, 'v0');
  assert.equal(result.state.voids[0].filledBy, 'p0');
});

test('filledBy: a fused placement records the SAME piece id on every void it filled', () => {
  let state = stage5State();
  state = selectPiece(state, 'fused');
  const result = placeSelected(state, 'v-x+');
  for (const v of result.state.voids) {
    assert.equal(v.filledBy, 'fused');
  }
});
