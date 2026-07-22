# ADR-0001: The creator identity is "Passport," not "Profile" or "WM ID"

Date: 2026-07-22 · Status: Accepted (retroactive — decision made in commit
`0b4c47d`, "Rename creator identity to Passport and WOW World")

## Context

The identity system began as "WM ID" (WealthyMindsets ID) shared with the WOW
World ecosystem. "Profile" undersells what the identity holds: it is the root
that projects, vaults, graph, reputation, timeline, and legacy all branch
from, and it travels across the whole WOW World ecosystem.

## Decision

All user-facing language says **Passport**. "Profile" may only name one
section inside Passport. "WM ID" never appears in the UX.

Internal remnants (`wm_id` table, `wmUser`/`wmHandle` state, `wm-id.css`,
`supabase/wm-id-schema.sql`) are migrated opportunistically when the code
around them is touched — no dedicated rename migration until the schema needs
one for another reason.

## Consequences

- Copy, components, and new tables use Passport naming from now on.
- The `wm_id` table keeps its name for compatibility with existing rows and
  WOW World sign-in until a schema migration is warranted.
