# Rhombiverse — Compliance checklist

## Where things stand

Rhombiverse is a static site with no server side: no accounts, no
backend, no uploads, no sharing between users. Your builds stay in your
own browser (`localStorage`) unless you export them to a file.

In place, at the repo root and on the site (`/terms`, `/privacy`,
`/security`): `LICENSE`, `TERMS.md`, `PRIVACY.md`, `SECURITY.md`,
`CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`. The Content Security Policy
(`vercel.json` headers) allows only the site's own files, plus scripts
from unpkg.com for Three.js; it permits no outside connections.

## Re-check before adding any of these

Each would change what the legal documents and the CSP have to say, so
update them in the same change:

- a backend, accounts or sign-in (authentication, rate limiting,
  data-protection duties such as GDPR requests);
- anything that stores or shares user content off the device
  (moderation, takedown process, abuse reporting);
- analytics, cookies or third-party scripts (privacy policy, consent);
- anything aimed at children (COPPA and similar rules need a real
  review, not just a technical one);
- calls to an AI or any other external API (CSP, privacy policy, cost
  and key handling).
