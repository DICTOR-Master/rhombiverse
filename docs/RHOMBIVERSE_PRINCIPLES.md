# Rhombiverse — Principles

The design law behind every decision in this repo. Short on purpose.

## 1. Grounded in real geometry

Nothing is invented where real mathematics or crystallography already
answers the question. Every lattice is a real one (FCC, BCC, the
parallelohedra, Kagome and Pyrochlore, Z4, D4, the A4 hyper-pyrochlore),
every piece is a real solid or a real decomposition of one (RD's four
rhombohedra, its hemispheres and pyramids), and every placement rule
follows from that geometry. Coordinates are exact, and the `verify:*`
scripts check them numerically, not by eye.

When a choice has no real-world anchor (a colour, a default angle, a
tuning constant), say so in a comment rather than presenting it as
derived.

## 2. The simplest version that works

Prefer the smallest rule a user or contributor can hold in their head.
One piece at a time, tap to add, long-press to remove. A control that
doesn't apply is hidden, not greyed out. A feature earns its place by
being needed, not by being possible.

## 3. The world is data

A build is plain JSON, one store per lattice, with no baked geometry.
Anything that renders or edits a world reads and writes that data, and
a change extends it rather than breaking what's saved (old saves are
migrated on load).

## 4. Local problems stay local

Each lattice and each dimension keeps its own store and its own undo
history; a change or a fault in one never reaches another. A new
feature should fail inside its own boundary, not take the app down.
