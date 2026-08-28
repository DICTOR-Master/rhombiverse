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

Rhombiverse has two tiers today: a static, `localStorage`-only local
World (no accounts, no backend — client-side issues like XSS via
imported world JSON or rendered text are the main realistic surface
there), and an opt-in Shared World backed by Supabase (anonymous
sign-in, Postgres with row-level security keyed off `auth.uid()`, a
per-identity rate limit, and daily snapshot backups — see
`supabase/schema.sql` and `RHOMBIVERSE_PLAN.md` Phase 5). Reports
touching Shared World's backend, RLS policies, or rate limiting are in
scope too, not just the client.

## Supported versions

Only the latest commit on `master` is supported. There are no
maintained release branches yet.
