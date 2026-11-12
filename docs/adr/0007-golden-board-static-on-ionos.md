# ADR-0007: Golden board ships as a static Passport app on IONOS

Date: 2026-11-12 · Status: accepted (Founder directive "get Dream Board built")

## Context
- The vinext/Next app in `app/` needs a Worker runtime. Its Vercel host is 402 and the
  `dream-board` Worker serves nothing (workers.dev disabled, error 1042).
- Founder rulings: IONOS is the host for every ATH app (webspace = static + PHP only),
  one WOW Passport login (Supabase `zrzaifaxecwgpfrqctkp`), tier sets access, no fake data.
- Myron Golden's frameworks (credited, summarized in our own words) are to be built into
  Dream Board: Money Tree, Quantum-ply, Belief Chain journal, Orchard, Start-before-ready.

## Decision
- `board/` is a dependency-free static client (HTML/CSS/JS + vendored supabase-js 2.108.2)
  that talks to Supabase directly under RLS. No server code, so IONOS webspace serves it.
- Schema: `supabase/dreamboard-golden-inventions.sql` (7 owner-only tables, parent-ownership
  triggers, `dreamboard_my_access()` tier read, tree-limit trigger enforced in the DB).
- Tier: founder (ath_private.founder_grants) / partner / premium (passport_entitlement_grants
  for dreamboard|passport|world_pass) = unlimited Orchard; basic Passport = 1 Money Tree.
- Live at https://spaidbot.cloud/dreamboard/ (IONOS webspace /spaidbot/dreamboard).
  Planned canonical: dreamboard.spaidbot.cloud pointed at the SAME folder (one copy of files),
  then 301 the path to the subdomain.

## Consequences
- The older views in `app/` are not on this host yet; porting them is follow-up work.
- Upload = IONOS Webspace Explorer (flat folder; no build step).
