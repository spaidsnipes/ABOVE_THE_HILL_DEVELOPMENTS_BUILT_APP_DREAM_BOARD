# ADR-0004: Vision Vault and Knowledge Vault are separate stores

Date: 2026-07-22 · Status: Accepted

## Context

The Bible defines two distinct vaults: Vision Vault (the creator's own
emerging material — ideas, dreams, goals, sparks) and Knowledge Vault
(external/reference material — research, documents, imports). The foundation
release had a single `dreamboard_vault_entries` table serving both.

## Decision

Vision Vault gets its own table, `dreamboard_vision_entries`
(supabase/dreamboard-vision-vault.sql), with capture types, an idea lifecycle
(`inbox → developing/incubating → ready_for_project → archived`), owner RLS,
and a localStorage fallback (`dreamboard-vision-entries`) when Supabase is
unavailable.

`dreamboard_vault_entries` remains the Knowledge Vault store. Existing mixed
entries are **not** auto-migrated — silently reclassifying a creator's
material would violate the truthfulness rule (ADR-0002). Local device entries
can be promoted to the cloud with an explicit "Secure to cloud" action
(`source_type: migration`); a reviewed move tool between vaults can come
later if needed.

## Consequences

- Ideas and research stop blurring together; each vault can grow its own
  lifecycle and UI.
- Two tables to keep in sync with graph nodes later (vision entries do not
  create graph nodes yet — that's Creative Graph work).
- Old idea-like entries stay in Knowledge Vault until the user moves them.
