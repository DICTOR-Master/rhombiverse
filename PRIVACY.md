# Privacy Policy

Effective for the public playable link described in `RHOMBIVERSE_PLAN.md`
Phase 4.

## Short version

By default, Rhombiverse does not collect, transmit, or store any
personal data on a server — there are no accounts, no analytics, and no
cookies, and everything you build stays in your own browser.

If you turn on the optional **Shared World** mode, that changes in one
specific way: the app creates an anonymous, unnamed identity for your
browser (no email, password, or name required) and sends your builds
and land claims to a shared backend database so other Shared World
players can see and build alongside you. That's still the only data
involved — no analytics or tracking are added by enabling it.

## What data exists, and where

- **World data in local mode** (the cells you place, their materials,
  undo history) is stored only in your browser's `localStorage`, on
  your own device. It is never sent to any server in this mode.
- **Exported JSON files** are created and downloaded locally when you
  use "Export JSON"; they are not uploaded anywhere by the app.
- **Shared World data** (only if you enable it): the cells you place or
  remove, any land claim you grant, and asteroid-mining state are sent
  to and stored on a shared backend database (Supabase), tagged with
  your anonymous Shared World identity (see below) and a timestamp.
  This data is visible to every Shared World player, by design — it's
  how the shared world works, not a leak. See `TERMS.md`'s "Shared
  World and your content" section for what that means for content you
  place there.
- **Anonymous Shared World identity.** The first time you enable Shared
  World, the app creates a random anonymous identifier (via Supabase's
  anonymous sign-in) and stores it in your browser so your builds and
  claims stay associated with "you" across visits on that device. This
  identifier is a random ID, not your name, email address, or any other
  real-world identifier — the app never asks for or collects those.
  Clearing your browser's storage or using a different browser/device
  starts a new, unlinked anonymous identity.
- **Standard web server and database logs.** The static hosting
  provider (Vercel) may log ordinary access data (IP address,
  timestamp, requested file) as part of normal web hosting operation.
  If you use Shared World, the backend provider (Supabase) similarly
  logs ordinary request/connection data as part of normal database and
  realtime-connection operation. The app itself has no access to or
  control over either provider's own infrastructure-level logs.

## Third parties

The app is served as static files from a hosting provider (Vercel).
Shared World, when enabled, talks to a backend database and realtime
service (Supabase). Both providers' own privacy policies govern any
hosting/infrastructure-level logs their platforms generate — this
project does not add any additional tracking, analytics, or
third-party scripts on top of what those two providers need to serve
the page and (for Supabase) run Shared World.

## Data deletion

**Local mode:** since nothing is stored server-side, there is nothing
to request deletion of beyond your own browser — clearing this site's
data in your browser settings removes everything.

**Shared World:** this is a small hobby project without automated
self-service deletion tooling yet. Content you placed in the Shared
World may be part of a larger, collaboratively-built structure that
other players' builds or claims now depend on (see `TERMS.md`), so
individual cell-level deletion on request isn't always practical.
Email the contact below to request deletion or disassociation of your
anonymous identity's data, and it will be handled manually as best
effort. This will be revisited with real tooling and legal review
before Shared World scales beyond its current small, experimental
scope (see `docs/RHOMBIVERSE_COMPLIANCE.md`).

## Children's privacy

This app does not knowingly collect personal information from anyone,
including children — not even in Shared World, where the only
identifier created is an anonymous, unnamed random ID, never a name,
email, or other real-world identifier. If a future version links
anonymous identities to real accounts, or otherwise starts collecting
personal information, this policy will be revisited with real legal
review before that ships (see `docs/RHOMBIVERSE_COMPLIANCE.md`'s COPPA
note).

## Changes

If a future phase adds real accounts, analytics, or changes what
Shared World collects, this policy will be updated to disclose exactly
what's collected and why, before that ships.

## Contact

jamesbaker08@gmail.com
