// Full-Cyborg's real natural-language backend (RHOMBIVERSE_UIUX_BUILD_PLAN.md
// B4). Runs as a Vercel serverless function so the LLM call happens
// server-side -- never expose a provider API key to the browser. Uses
// Vercel's AI Gateway with its default OIDC auth (no manual API key
// needed once "AI Gateway" is enabled for this project in the Vercel
// dashboard -- a one-time step only the project owner can do; see
// LESSONS.md/CLAUDE.md for the note on this). If that step hasn't been
// done yet, or the call fails for any other reason, this returns a
// non-2xx response and sculpture.js's requestFullCyborgIntent falls back
// to its own local keyword parser -- the feature still works either way.
//
// Deliberately returns a SMALL structured decision (shape/action/radius/
// mirror), not raw cell coordinates -- turning that into actual FCC-
// lattice cells is exact, deterministic math (sculpture.js's own
// intentToCells), which an LLM has no business inventing itself.
import { generateText, Output } from 'ai';
import { z } from 'zod';

const IntentSchema = z.object({
  shape: z.enum(['dome', 'sphere', 'wall', 'mirror-wing', 'none']),
  action: z.enum(['add', 'remove']),
  radius: z.number().int().min(1).max(8),
  useMirror: z.boolean(),
  description: z.string().max(140),
});

const SYSTEM_PROMPT = `You translate a player's plain-language building request in a voxel-building game (Rhombiverse) into a small structured plan.

The game has exactly two basic sculpting modes: "Model" (adds material -- action "add") and "Chisel" (removes/carves away material -- action "remove"). Pick whichever the player's words imply; default to "add" if unclear.

Shapes you can produce: "dome" (a mound/hemisphere), "sphere" (a full round cluster), "wall" (a straight line/ridge), "mirror-wing" (build one side, meant to be mirrored), or "none" if the request doesn't describe a buildable shape at all.

radius is a rough size from 1 (tiny) to 8 (huge); default to 3 if no size is implied.
useMirror is true if the player mentions symmetry, mirroring, or "the other side".
description is a short (<140 char), friendly confirmation of what you're about to do, using the words "Model" or "Chisel" naturally (e.g. "Modeling a small dome here." / "Chiseling out a wide sphere.").`;

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
    console.error('sculpt-intent: AI Gateway call failed', err);
    return Response.json({ error: 'AI Gateway request failed' }, { status: 502 });
  }
}
