// Bring-Your-Own-AI-Key: a visitor's key lives ONLY in their own
// browser's localStorage (settings.js), used ONLY for a direct
// client-side call to their chosen provider -- never sent to this
// site's own server. Full rationale/history: docs/code-notes/app/byok.md
import { getSettings } from './settings.js';

// Model name is a real Settings field the visitor fills in themselves
// -- see docs/code-notes/app/byok.md for why.
async function callAnthropic(apiKey, model, systemPrompt, userPrompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 300,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API returned ${res.status}`);
  const data = await res.json();
  return data.content?.[0]?.text ?? '';
}

async function callOpenAI(apiKey, model, systemPrompt, userPrompt) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 300,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI API returned ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

export async function requestBYOKJson(systemPrompt, userPrompt) {
  const { byokProvider, byokApiKey, byokModel } = getSettings();
  if (!byokProvider || byokProvider === 'none' || !byokApiKey || !byokModel) return null;

  const jsonInstruction = `${systemPrompt}\n\nRespond with ONLY a single valid JSON object matching the shape described above -- no markdown fences, no other text.`;
  const raw =
    byokProvider === 'anthropic'
      ? await callAnthropic(byokApiKey, byokModel, jsonInstruction, userPrompt)
      : await callOpenAI(byokApiKey, byokModel, jsonInstruction, userPrompt);

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Personal AI response was not valid JSON');
  return JSON.parse(match[0]);
}

export function hasBYOKConfigured() {
  const { byokProvider, byokApiKey, byokModel } = getSettings();
  return !!(byokProvider && byokProvider !== 'none' && byokApiKey && byokModel);
}
