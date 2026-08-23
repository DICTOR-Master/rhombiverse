// Cultivation Mode (RHOMBIVERSE_UIUX_BUILD_PLAN.md B5). "Reuse the
// Assistance Spectrum tiers and Full-Cyborg scoping rules from B4
// exactly -- do not redefine them" -- canFullCyborgEditAt is imported
// straight from sculpture.js, not reimplemented. Manual tier's
// growthParameters and the prune-triggers-reroute mechanic live in
// growth.js itself (growSeed/pruneTile) since they're real changes to
// the growth algorithm, not this module's concern -- this module only
// covers session state and the two Assistance-tier behaviors that are
// genuinely specific to Cultivation: Semi-Cyborg's planting-site
// suggestion and Full-Cyborg's natural-language planting.
import { plantSeed } from './growth.js';
import { canFullCyborgEditAt } from '../core/sculpture.js';
import { nearestValidCell } from '../core/lattice.js';
import { requestBYOKJson } from '../app/byok.js';

export function createCultivationSession(playerId, assistanceTier = 'manual') {
  return { playerId, assistanceTier, pendingSuggestion: null };
}

// Semi-Cyborg: "this spot has strong hydrosphere permeation, likely a
// good planting site" -- reuses hydrosphere.js's REAL field name,
// `hydrospherePermeated` (the build plan calls it `hydrosphereActive`,
// which doesn't exist anywhere in this codebase; same kind of naming
// mismatch as B4's symmetry-group claim, honored by using the real
// name instead of inventing a field that isn't there).
export function proposeCultivationSite(session, world, hitCell, species, growthParameters) {
  if (session.assistanceTier !== 'semi-cyborg') return null;
  const wet = hitCell.hydrospherePermeated === true;
  session.pendingSuggestion = {
    location: [hitCell.x, hitCell.y, hitCell.z],
    species,
    growthParameters,
    reason: wet ? 'strong hydrosphere permeation here -- a good planting site' : 'open ground -- should grow fine',
  };
  return session.pendingSuggestion;
}

export function acceptCultivationSuggestion(session, world, playerId) {
  const s = session.pendingSuggestion;
  if (!s) return null;
  const seedId = `seed_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const seed = plantSeed(world, seedId, s.species, s.location);
  world.setSeed(seedId, { ...seed, growthParameters: s.growthParameters, assistanceTier: 'semi-cyborg', authorId: playerId });
  session.pendingSuggestion = null;
  return seedId;
}

export function dismissCultivationSuggestion(session) {
  session.pendingSuggestion = null;
}

// --- Full-Cyborg: natural-language planting/tending ---------------
// Same two-path shape as sculpture.js's Full-Cyborg (a real AI-Gateway
// call with a bounded local parser as fallback) -- see api/
// cultivate-intent.js for the server side.
const SPECIES_WORDS = {
  forest: 'conifer', tree: 'conifer', trees: 'conifer', pine: 'conifer',
  garden: 'fern', fern: 'fern', moss: 'moss', fungus: 'fungus', mushroom: 'fungus',
  shrub: 'shrub', bush: 'shrub', reef: 'nautilus', coral: 'nautilus', shell: 'scallop',
};
function detectSpecies(text) {
  for (const [word, species] of Object.entries(SPECIES_WORDS)) {
    if (text.includes(word)) return species;
  }
  return 'fern';
}
function detectCount(text) {
  return /\b(forest|garden|cluster|patch|grove)\b/.test(text) ? 4 : 1;
}

function seedsAround(origin, species, count) {
  const seeds = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const r = count > 1 ? 2.5 : 0;
    seeds.push({ x: origin.x + Math.cos(angle) * r, y: origin.y, z: origin.z + Math.sin(angle) * r, species });
  }
  return seeds;
}

export function parseCultivationIntent(text, origin) {
  const lower = text.toLowerCase();
  const species = detectSpecies(lower);
  const count = detectCount(lower);
  return {
    seeds: seedsAround(origin, species, count),
    description: `Planting ${count > 1 ? `a ${count}-seed cluster of` : 'a'} ${species}${count > 1 ? 's' : ''}.`,
    unrecognized: false,
  };
}

const CULTIVATE_SYSTEM_PROMPT = `You translate a player's plain-language planting/growing request in a voxel-building game (Rhombiverse) into a small structured plan.

Pick the closest matching species from: fern, moss, fungus, shrub, conifer, sapling, nautilus, scallop -- or "none" if the request isn't about planting/growing anything at all.

Respond with a JSON object with exactly these fields: species (one of the above), count (integer 1-8, how many seeds -- 1 for a single plant, more for "forest"/"garden"/"cluster"/"grove" requests), description (a short friendly confirmation, <140 chars).`;

function decisionToIntent(decision, origin, viaAI) {
  if (decision.species === 'none') {
    return { seeds: [], description: decision.description, unrecognized: true };
  }
  return {
    seeds: seedsAround(origin, decision.species, decision.count),
    description: decision.description,
    unrecognized: false,
    viaAI,
  };
}

// Same three-tier fallback as sculpture.js's Full-Cyborg: the player's
// own AI key, then this site's shared AI Gateway, then the local parser.
export async function requestCultivationIntent(text, origin) {
  try {
    const decision = await requestBYOKJson(CULTIVATE_SYSTEM_PROMPT, `Player said: "${text}"`);
    if (decision) return decisionToIntent(decision, origin, true);
  } catch (err) {
    console.warn('Rhombiverse: personal AI key call failed, trying the shared AI Gateway instead', err);
  }
  try {
    const res = await fetch('/api/cultivate-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error(`cultivate-intent API returned ${res.status}`);
    const decision = await res.json();
    return decisionToIntent(decision, origin, true);
  } catch (err) {
    console.warn('Rhombiverse: Cultivation AI Gateway call failed, using local parser instead', err);
    return parseCultivationIntent(text, origin);
  }
}

// Scoped and gated identically to B4a's Full-Cyborg (B5's own explicit
// requirement) -- canFullCyborgEditAt is coordinate-based (claims are
// defined over integer lattice cells), so a seed's real-valued origin
// is snapped to its nearest lattice cell before the check, same bridge
// nearestValidCell already exists for elsewhere in this codebase.
export function executeCultivationIntent(world, intent, claims, playerId, growthParameters) {
  const applied = [];
  const skipped = [];
  for (const s of intent.seeds) {
    const [cx, cy, cz] = nearestValidCell(s.x, s.y, s.z);
    if (!canFullCyborgEditAt(claims, playerId, cx, cy, cz)) {
      skipped.push(s);
      continue;
    }
    const seedId = `seed_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const seed = plantSeed(world, seedId, s.species, [s.x, s.y, s.z]);
    world.setSeed(seedId, { ...seed, growthParameters, assistanceTier: 'full-cyborg', authorId: playerId });
    applied.push(seedId);
  }
  return { applied, skipped };
}
