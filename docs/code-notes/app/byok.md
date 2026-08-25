# Notes: `src/app/byok.js`

Full design rationale/history for this file, moved out of the source so
the code itself stays lite and readable — nothing here is new, it's the
exact commentary that used to sit inline. See `CONTRIBUTING.md`'s
"Ground rules" for why this split exists.

## File overview

Bring-Your-Own-AI-Key (requested directly by the project owner mid-B5:
"a visitor should be able to power Full-Cyborg with their OWN API key
instead of the site's shared AI Gateway budget"). A visitor's key lives
ONLY in their own browser's localStorage (`settings.js`) and is used
ONLY for a direct client-side call to their chosen provider — it is
never sent to this site's own server/serverless functions.

Anthropic's official stance (verified live against platform.claude.com
before writing this, not assumed from memory): direct browser calls are
supported via the TypeScript SDK's `dangerouslyAllowBrowser` flag,
which exists to make a deliberate, informed choice explicit — it is a
client-side safety rail, not a special required HTTP header. This
project has no build step for local dev (see `CONTRIBUTING.md`), so
rather than adding the `@anthropic-ai/sdk` package just for one call
shape, this uses plain `fetch()` directly against the same Messages API
the SDK itself wraps. If a browser-origin call is ever actually
rejected (CORS or otherwise), the caller's own existing fallback chain
(personal key -> this site's server route -> local keyword parser)
absorbs it cleanly — this is deliberately NOT the only path a feature
depends on.

No structured-output tool-calling here (that's a heavier SDK feature)
— the prompt asks for raw JSON matching a described shape, parsed
defensively. Good enough for the small decisions Full-Cyborg needs
(shape/action/radius/mirror, or species/count), consistent with this
module's own "minimalist" scope.

## `callAnthropic` (the model-name param)

Model naming is genuinely different per provider and per account tier
(which models a given key can even reach) — rather than this module
guessing a model string that might not exist for a given visitor's own
key, the model name is a real Settings field they fill in themselves
(with a placeholder EXAMPLE, not a silently-assumed default). See
`index.html`'s `#byok-model` input.

## `requestBYOKJson`

Returns the parsed JSON object, or null if no personal key is set, or
throws if the call itself failed (callers should catch and fall back to
this site's own `/api` route, same as when no key is set at all).
