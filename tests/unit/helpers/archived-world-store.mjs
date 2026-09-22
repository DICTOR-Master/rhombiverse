// Test-only helper, not shipped and not imported by any production code.
//
// src/core/worldstate-core.js's createWorldStore() dropped seeds/
// organisms/planetoidEvolution entirely on 2026-09-22 (second
// world-building removal pass) -- growth/evolution/cultivation were
// archived, and nothing live can create a seed anymore. The archived
// growth-engine/evolution/animals code (src/world-systems-archived/) is
// kept intact "for reference," per this repo's own archival convention,
// and its existing regression tests are worth keeping meaningful rather
// than deleted outright or left broken -- this wraps the live
// createWorldStore() (for cells/claims/etc., unchanged) and layers the
// removed methods back on top, locally, so those tests can still
// exercise the archived math/logic in isolation. This file has no
// bearing on the live app's actual schema.
//
// Memoized (real bug found live 2026-08-14/2026-08-24, see the original
// worldstate-core.js history): resolveCatchUp's own perf regression test
// (evolution.test.mjs) calls getOrganisms() repeatedly inside O(n^2)
// per-generation proximity/mating checks -- an unmemoized `{...organisms}`
// spread on every call reproduces that exact historical hang (35s+ vs.
// the test's 5s budget), confirmed by running it uncached first.
import { createWorldStore } from '../../../src/core/worldstate-core.js';

export function createArchivedWorldStore(worldJSON, hooks = {}) {
  const base = createWorldStore(worldJSON, hooks);
  let seeds = { ...(worldJSON.seeds ?? {}) };
  let organisms = { ...(worldJSON.organisms ?? {}) };
  let planetoidEvolution = { ...(worldJSON.planetoidEvolution ?? {}) };
  let seedsCache = null;
  let organismsCache = null;
  let planetoidEvolutionCache = null;
  return {
    ...base,
    getSeeds() {
      if (seedsCache === null) seedsCache = { ...seeds };
      return seedsCache;
    },
    setSeed(seedId, seedData) {
      seeds = { ...seeds, [seedId]: seedData };
      seedsCache = null;
      hooks.onSeedSet?.(seedId, seedData);
    },
    removeSeed(seedId) {
      const { [seedId]: _removed, ...rest } = seeds;
      seeds = rest;
      seedsCache = null;
      hooks.onSeedClear?.(seedId);
    },
    getOrganisms() {
      if (organismsCache === null) organismsCache = { ...organisms };
      return organismsCache;
    },
    setOrganism(organismId, organismData) {
      organisms = { ...organisms, [organismId]: organismData };
      organismsCache = null;
    },
    removeOrganism(organismId) {
      const { [organismId]: _removed, ...rest } = organisms;
      organisms = rest;
      organismsCache = null;
    },
    getPlanetoidEvolution() {
      if (planetoidEvolutionCache === null) planetoidEvolutionCache = { ...planetoidEvolution };
      return planetoidEvolutionCache;
    },
    setPlanetoidEvolution(planetoidKey, data) {
      planetoidEvolution = { ...planetoidEvolution, [planetoidKey]: data };
      planetoidEvolutionCache = null;
    },
  };
}
