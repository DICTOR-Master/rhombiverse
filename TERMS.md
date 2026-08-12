# Terms of Service

Effective for the public playable link described in `RHOMBIVERSE_PLAN.md`
Phase 4. This is a minimal terms document for a small hobby project — it
will need real legal review before this project takes on real accounts,
payments, or a larger user base (see `docs/RHOMBIVERSE_COMPLIANCE.md`).

## What this is

Rhombiverse is a free, browser-based building toy. By default it runs in
**local mode**: there is no account system, no server-side storage, and
your content is not visible to anyone else. Everything you build is
saved only in your own browser's local storage, or in a JSON file you
explicitly export.

Rhombiverse also offers an optional, opt-in **Shared World** mode (the
"Enable Shared World" button). Turning it on connects you to a single
world that other Shared World players can see and build in at the same
time — see "Shared World and your content" and "Land claims" below for
what that actually means.

## Use at your own risk

The app is provided "as is," with no warranty of any kind, express or
implied — including no guarantee of uptime, data durability, or
fitness for any particular purpose. Your browser's local storage can be
cleared by you, your browser, or your OS at any time; export JSON
regularly if you want to keep a build. The Shared World is likewise not
guaranteed to be backed up, permanent, or free of resets — it is a work
in progress and may be wiped, migrated, or taken offline without notice
(see the "under construction" notice shown in the app itself).

## Acceptable use

Don't attempt to disrupt, attack, scrape, or overload the hosting
infrastructure or the Shared World database/realtime connection (this
includes automated flooding of builds, claims, or connections). Don't
use the app for anything unlawful.

In Shared World specifically: don't attempt to grief, deface, or destroy
other players' builds or claimed land outside of what the game's own
rules and protections (right-click removal, claim `destructible`
settings, Black Hole/Supernova mechanics, etc.) actually allow. Don't
try to create multiple identities to get around the one-claim-per-player
limit. Shared World currently uses a lightweight anonymous identity per
browser rather than verified accounts, so this rule is enforced as best
effort, not guaranteed — see `docs/RHOMBIVERSE_SPEC_LOOPHOLES.md`'s own
note that multi-identity abuse has no full technical fix yet.

## A note on cooperation

Shared World is meant to work as an open commons, not a competition.
Claims, `destructible` protections, and the Report tool exist so people
*can* protect what they've built, but the world works best when most
players never need to reach for them: build generously, leave room
around other people's work, ask before building right up against
something someone else clearly cared about, and extend the same good
faith you'd want extended to you. That spirit — open, cooperative,
good-practice-by-default — is the actual design goal behind Shared
World; the rules above are a backstop for when it breaks down, not the
main mechanism.

## Shared World and your content

Content you build while Shared World is **off** stays local to your own
browser or your own exported JSON files, exactly as described above.

Content you place while Shared World is **on** is sent to and stored on
a shared backend and becomes part of a single world that every Shared
World player can see, and in most cases build on or near — this is the
whole point of Shared World, not an accidental side effect. By enabling
Shared World and placing content, you agree that:

- Other players may see, build adjacent to, or (subject to the game's
  own mechanics — e.g. a claim's `destructible` setting, Black Hole/
  Supernova consumption of *foreign* matter only, never a protected or
  claimed cell without consent) interact with what you place.
- Content you place in the Shared World may remain part of it, visible
  to others, even after you stop playing — other players' structures or
  claims may end up adjacent to or dependent on it, the same way a
  Wikipedia edit or a block placed in a shared Minecraft server doesn't
  simply disappear because the original placer left.
- You grant Rhombiverse a license to store, transmit, and display what
  you place in the Shared World to other players, for as long as the
  Shared World exists, so that the game can function as designed.

You still retain the right to remove your own individual cells
yourself (right-click, in any mode) while they exist, subject to the
same claim/protection rules everyone else's removals are subject to.

## Land claims

Shared World includes an optional "Claim Land" tool
(`docs/RHOMBIVERSE_SPEC_REGIONS.md`). Claiming land reserves a
fixed-size plot (currently a 2-shell region, ~55 cells) around a
location for your anonymous Shared World identity. Plain-language
summary of how it actually works:

- **One claim per identity**, enforced by the database itself, not just
  the app.
- **Claims are fixed-size and permanent once granted** — a claim can
  never be resized, moved, or reassigned to someone else. The only
  thing you can change afterward is its `destructible` protection
  toggle (whether Black Hole/Supernova mechanics are allowed to consume
  foreign matter that drifts into it, and whether gravity pulls
  entities standing inside it).
- A claim is a gameplay reservation within Rhombiverse, not a real-world
  asset — it has no monetary value, isn't transferable, isn't a
  blockchain token, and confers no rights outside the game.
- Because Shared World identities are anonymous and not tied to a
  verified account, the "one claim per identity" rule can, in practice,
  be worked around by starting a new anonymous session (e.g. a fresh
  browser profile). This is a known, acknowledged limitation — see
  `docs/RHOMBIVERSE_SPEC_LOOPHOLES.md` — not a promise of strict
  scarcity.

## Changes

These terms may change as the project moves through later phases
(verified accounts, moderation, monetization if any). Material changes
will be noted in this file's git history.

## Contact

jamesbaker08@gmail.com
