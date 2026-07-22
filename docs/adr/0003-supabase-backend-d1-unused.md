# ADR-0003: Supabase is the backend; Drizzle/D1 starter scaffolding stays unused

Date: 2026-07-22 · Status: Accepted (retroactive)

## Context

The repo began from the vinext starter, which ships optional Cloudflare D1 +
Drizzle scaffolding (`db/`, `drizzle/`, `examples/d1`). Dreamboard needs auth,
row-level-secured Postgres, and private file storage — Supabase provides all
three with one client, and Passport auth already lives there (shared with WOW
World).

## Decision

Supabase (Postgres + Auth + Storage, RLS on `owner_id`) is the single backend.
The SQL files in `supabase/` are the schema's source of truth. Drizzle/D1
remain intentionally unused; `db/schema.ts` stays empty.

## Consequences

- Data access happens from the browser client with the publishable key; RLS is
  the security boundary. Service-role keys never ship in app code.
- Every feature degrades to local mode when Supabase env vars are absent.
- Adopting D1/Drizzle (or server-side data access) later requires a new ADR.
