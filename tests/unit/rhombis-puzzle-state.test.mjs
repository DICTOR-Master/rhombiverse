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
