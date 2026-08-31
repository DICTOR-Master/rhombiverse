// core/instance.js: geometry-layer instance primitives (RHOMBIVERSE_
// CLAUDE_CODE_IMPLEMENTATION_PLAN.md section 3/6). Zero npm dependencies,
// same as growth.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plantInstance, growInstance, phenotypeFromSliders } from '../../src/core/instance.js';
import { growSeed } from '../../src/geometry-extensions/growth.js';

test('plantInstance: a fresh instance is never invisible (at least one tile immediately)', () => {
  const instance = plantInstance({ species: 'amoeba', origin: [1, 2, 3], now: 1000 });
  assert.equal(instance.species, 'amoeba');
  assert.deepEqual(instance.origin, [1, 2, 3]);
  assert.equal(instance.generation, 0);
  assert.equal(instance.plantedAt, 1000);
  assert.equal(instance.lastGrowthAt, 1000);
  assert.equal(instance.tiles.length, 1);
});

test('growInstance is growth.js\'s own growSeed, not a reimplementation', () => {
  assert.equal(growInstance, growSeed);
});

test('phenotypeFromSliders: growthRate maps to facesPerTick within the real coherence-safe range (1..6)', () => {
  assert.equal(phenotypeFromSliders({ growthRate: 0, maturitySize: 5 }).facesPerTick, 1);
  assert.equal(phenotypeFromSliders({ growthRate: 1, maturitySize: 5 }).facesPerTick, 6);
});

test('phenotypeFromSliders: maturitySize maps directly to maxGeneration', () => {
  assert.equal(phenotypeFromSliders({ growthRate: 0.5, maturitySize: 8 }).maxGeneration, 8);
  assert.equal(phenotypeFromSliders({ growthRate: 0.5, maturitySize: 3.4 }).maxGeneration, 3);
});

test('phenotypeFromSliders: preferType passes through untouched, defaults to null (Balanced)', () => {
  assert.equal(phenotypeFromSliders({ growthRate: 0.5, maturitySize: 5 }).preferType, null);
  assert.equal(phenotypeFromSliders({ growthRate: 0.5, maturitySize: 5, preferType: 'acute' }).preferType, 'acute');
});
