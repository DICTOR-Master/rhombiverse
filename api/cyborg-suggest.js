// Cyborg Mode's creative-suggestion backend. Cyborg Mode itself stays
// exactly what B3 says it is -- "listens and narrates, NEVER calls
// world.addCell/removeCell" (see cyborg.js's own header comment) -- this
// only generates a TEXT suggestion for the player to build themselves,
// same non-mutating boundary as the guided walkthrough it sits inside.
// Same Vercel AI Gateway / OIDC setup as sculpt-intent.js and
// cultivate-intent.js; falls back client-side (render.js's
// getCyborgSuggestion) to a local canned list if this route isn't
// reachable or AI Gateway hasn't been enabled for the project yet.
import { generateText, Output } from 'ai';
import { z } from 'zod';

const SuggestionSchema = z.object({
  suggestion: z.string().max(160),
});

const SYSTEM_PROMPT = `You are a creative building companion for Rhombiverse, a spatial editor where every block is a rhombic dodecahedron.

Given a short description of what someone has already built, suggest ONE small, concrete, achievable next thing for them to build or plant -- something more interesting than "place another block", but still doable in a few minutes. Name a shape, direction, or technique (e.g. "try a mirrored arch to the east", "plant a conifer near your fern for a mixed grove", "hollow out the center and add windows"). Keep it under 140 characters, friendly, and specific to what they've actually built so far -- don't suggest something they've clearly already done. Never mention that you are an AI.`;

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const summary = typeof body?.summary === 'string' ? body.summary.trim() : '';
  if (!summary || summary.length > 500) {
    return Response.json({ error: 'Missing or invalid "summary" (1-500 chars)' }, { status: 400 });
  }

  try {
    const result = await generateText({
      model: 'anthropic/claude-haiku-4.5',
      output: Output.object({ schema: SuggestionSchema }),
      system: SYSTEM_PROMPT,
      prompt: `Here's what the player has built so far: ${summary}`,
    });
    return Response.json(result.output);
  } catch (err) {
    console.error('cyborg-suggest: AI Gateway call failed', err);
    return Response.json({ error: 'AI Gateway request failed' }, { status: 502 });
  }
}
