# Privacy Policy

## Short version

Rhombiverse has no accounts, no analytics, no tracking and no cookies.
Everything you build stays in your own browser. The only time anything
you type or build leaves your device is when **you** use one of the
optional AI helpers, or share a world link.

## What data exists, and where

- **Your builds** (the cells and pieces you place, their colors, your
  view and settings) are stored only in your browser's `localStorage`,
  on your own device. They are never sent to a server.
- **Exported files** are created and downloaded on your device; the app
  never uploads them.
- **Shared world links.** "Share" encodes your world into the link
  itself (the `?w=` part of the address). Nothing is stored on a server,
  but whoever opens the link loads the page with that address, so the
  encoded world passes through the hosting provider's ordinary request
  handling (see "Hosting logs" below). Only share a link with people you
  want to see that build.
- **Optional AI helpers** (Sculpt's AI-assisted tier and Cyborg Mode's
  "suggest something to build") send a short text description — your
  request, or a one-line summary such as how many blocks you've built and
  in which colors — to an AI model, and get text back. Nothing else from
  your world is sent. Two ways this can happen:
  - **Using the shared AI (default):** the text goes to this site's own
    small serverless function, which passes it to Anthropic's Claude
    through Vercel's AI Gateway. The request is not stored by this
    project.
  - **Using your own AI key (Settings → Your Own AI):** your key is stored
    only in your browser's `localStorage`, and requests go directly from
    your browser to the provider you chose (Anthropic or OpenAI) — never
    to this site's server.

  The AI provider's own privacy policy governs what it does with a
  request. If you never use Sculpt's AI tier or Cyborg suggestions, no AI
  request is ever made.
- **Hosting logs.** The site is served by Vercel, which may log ordinary
  access data (IP address, time, requested address) as part of normal
  web hosting. This project has no access to or control over those
  infrastructure-level logs.

## Third parties

- **Vercel** — hosts the site and runs the shared-AI function (including
  its AI Gateway).
- **Anthropic** — the model behind the shared AI helpers, and optionally
  your own key.
- **OpenAI** — only if you choose to use your own OpenAI key.

This project adds no tracking, analytics or third-party scripts beyond
what's needed to serve the page and answer the AI helpers you choose to
use.

## Data deletion

Nothing you build is stored server-side, so there is nothing to request
deletion of: clearing this site's data in your browser settings removes
everything, including any saved AI key.

## Children's privacy

The app does not knowingly collect personal information from anyone,
including children. It has no accounts and asks for no names, emails or
other identifiers.

## Changes

If a future version adds accounts, analytics, or anything else that
collects data, this policy will be updated to say exactly what is
collected and why, before that ships.

## Contact

jamesbaker08@gmail.com
