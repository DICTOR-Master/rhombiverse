# Security Policy

Rhombiverse is a small, single-developer project. There is no bug
bounty and no dedicated security team — reports are handled directly
by the maintainer.

## Reporting a vulnerability

Please report security issues privately, not as a public GitHub issue:

- **Email:** jamesbaker08@gmail.com
- **Or:** open a [GitHub private security advisory](https://github.com/DICTOR-Master/rhombiverse/security/advisories/new) on this repo.

Include what you found, how to reproduce it, and its impact if you can.
You should get an acknowledgment within a few days.

## Scope

At the current stage (static site, `localStorage`-only persistence, no
accounts, no backend), the realistic attack surface is small — mainly
client-side issues like XSS via imported world JSON or rendered text.
That will expand once a shared/multiplayer backend exists (see the
project's `RHOMBIVERSE_PLAN.md` Phase 5); this policy will be updated
when it does.

## Supported versions

Only the latest commit on `master` is supported. There are no
maintained release branches yet.
