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

Rhombiverse is a static, `localStorage`-only app: no accounts and no
backend. Client-side issues, such as XSS via an imported World file or
rendered text, are the main realistic surface.

## Supported versions

Only the latest commit on `master` is supported. There are no
maintained release branches yet.
