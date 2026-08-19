// Cultivation Mode's Full-Cyborg backend (RHOMBIVERSE_UIUX_BUILD_PLAN.md
// B5), mirroring api/sculpt-intent.js's exact shape -- same AI Gateway
// setup, same reasoning for why this exists server-side (never expose a
// provider key client-side) and why it returns a small structured
// decision rather than raw seed coordinates (growth.js's own plantSeed
// math stays the one source of truth for actual planting geometry).
import { generateText, Output } from 'ai';
import { z } from 'zod';

const IntentSchema = z.object({
  species: z.enum(['fern', 'moss', 'fungus', 'shrub', 'conifer', 'sapling', 'nautilus', 'scallop', 'none']),
  count: z.number().int().min(1).max(8),
  description: z.string().max(140),
});

const SYSTEM_PROMPT = `You translate a player's plain-language planting/growing request in a voxel-building game (Rhombiverse) into a small structured plan.

Pick the closest matching species from: fern, moss, fungus, shrub, conifer, sapling, nautilus, scallop -- or "none" if the request isn't about planting/growing anything at all.

count is how many seeds to plant (1 for a single plant, more for "forest"/"garden"/"cluster"/"grove" style requests) -- default to 1 if unclear, max 8.

description is a short (<140 char) friendly confirmation of what you're about to plant.`;

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  if (!text || text.length > 300) {
    return Response.json({ error: 'Missing or invalid "text" (1-300 chars)' }, { status: 400 });
  }

  try {
    const result = await generateText({
      model: 'anthropic/claude-haiku-4.5',
      output: Output.object({ schema: IntentSchema }),
      system: SYSTEM_PROMPT,
      prompt: `Player said: "${text}"`,
    });
    return Response.json(result.output);
  } catch (err) {
    console.error('cultivate-intent: AI Gateway call failed', err);
    return Response.json({ error: 'AI Gateway request failed' }, { status: 502 });
  }
}
