# ADR-0002: Truthfulness — no fake data, no overclaiming UI

Date: 2026-07-22 · Status: Accepted (retroactive — decision reflected across
the foundation release: empty initial states, honest "how it works today"
panels, disclosed unconnected payments/AI)

## Context

Early drafts of creative tools often ship with sample manuscripts, fake
community posts, invented graph links, and buttons that pretend to do things.
Dreamboard's entire promise is trust: "your material, nothing invented."

## Decision

The app never fabricates content or claims capability it doesn't have:

- Vaults, lounges, shops, and graphs start empty with honest, welcoming empty
  states.
- Features that need a connection (Supabase, AI provider, payments) say so
  plainly instead of simulating results.
- AI output labels its provenance and never silently modifies user work.
- Placeholder mechanics (e.g., today's "Organize my notes" relabeling) must be
  disclosed in-app as suggestions/foundations, and are tracked in
  docs/STATUS.md until real.

## Consequences

- Demos look emptier than competitors' — accepted trade-off.
- Every new feature ships with a truthful degraded mode (no env vars → local
  mode, not fake cloud mode).
- docs/STATUS.md is the ledger separating working, placeholder, and missing.
