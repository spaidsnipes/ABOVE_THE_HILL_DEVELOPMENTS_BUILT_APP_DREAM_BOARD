# Dreamboard — Implementation Status

Audit of the actual codebase as of 2026-07-22 (commit `4bbd51c`). This is the
honest map: what works, what is placeholder, what does not exist yet. Update it
whenever a system changes tier.

## Working (real, wired to Supabase when connected)

- **Passport** — magic-link sign-in, handle claim (`wm_id` table), profile
  (display name, wisdom mode, creator season, theme) in `dreamboard_profiles`.
  UX fully says "Passport"; internals still use WM naming.
- **Knowledge Vault** — notes/journal/imports persist to
  `dreamboard_vault_entries` with localStorage fallback; search works.
- **Creative Graph (storage)** — each vault entry creates a `source` node in
  `dreamboard_graph_nodes`; nodes/edges load per owner.
- **Bulk Import** — real batched uploads to the `dreamboard-private` storage
  bucket with batch + per-file records (`dreamboard_import_batches`,
  `dreamboard_source_documents`), 3-way concurrency, partial-failure states.
- **Writing Studio** — draft editor with local persistence, cloud document +
  version history (`dreamboard_writing_documents`, `dreamboard_document_versions`),
  Markdown export, restore.
- **AI route** (`app/api/ai/route.ts`) — OpenAI-compatible chat proxy; honest
  503 until `AI_BASE_URL`/`AI_API_KEY`/`AI_MODEL` are set. Companion runs are
  logged to `dreamboard_companion_runs` either way.
- **Lounge / Shop / Radio (data layer)** — shared posts, product catalog, and
  station rows in Supabase; WOW World live surfaces embedded via iframe. Radio
  audio playback of a pasted licensed stream works.
- **Settings / Creator Compass** — theme, season, wisdom mode persist to the
  profile.

## Placeholder / partial (UI exists, substance thin)

- **Creative Graph (visualization)** — decorative layout: first 8 source nodes
  in fixed orbit positions, tags shown as themes; edges are stored but not
  rendered as connections. No semantic linking (honestly disclosed in-app).
- **"Organize my notes"** — relabels "Unsorted" tags to "Emerging thread";
  no real clustering or AI organization.
- **Local Companion** — regex keyword routing to skill/persona names with
  templated output. The 30 skills / 30 personas are lists, not behaviors.
- **Book Architect** — single hardcoded "Untitled chapter"; no real outline or
  multi-chapter model.
- **Reader** — renders the current draft only; fine as a preview.
- **Audiobook Studio** — session-only object-URL playback; no cloud storage.
- **Shop cart** — local cart math only; no checkout/payments (disclosed).
- **Projects / Creative Timeline / Creation Journal** — thin views over the
  single writing document and local notes. `dreamboard_projects` and
  `dreamboard_timeline_events` tables exist but the UI doesn't use them.
- **ChatGPT workspace auth** (`app/chatgpt-auth.ts`) — starter-template
  leftover; unused by the app.

## Missing (in the vision, not yet started)

- Vision Vault as distinct from Knowledge Vault (private ideas/dreams vs.
  external sources) — today one vault serves both.
- Text extraction, indexing, and search over imported files (imports are
  preserved originals only).
- Google Drive import.
- Embeddings / semantic graph links; real graph exploration UI.
- Multi-project, multi-chapter data model; project containers with tasks,
  milestones, collaborators.
- Collaboration: shared workspaces, comments, permissions, organizations.
- Publishing pipeline (book/site/newsletter outputs), Marketplace checkout,
  creator economy.
- Passport depth: Creative DNA, skills, reputation, timeline, legacy.
- Tests beyond the single rendered-HTML smoke test.

## Structural debt

- `app/page.tsx` holds all 19 views (~400 dense lines). Decompose
  incrementally per CLAUDE.md.
- WM naming remnants: `wm_id` table, `wmUser`/`wmHandle`/`wmStatus` state,
  `app/wm-id.css`, `supabase/wm-id-schema.sql`.
- Unused starter scaffolding: Drizzle/D1 (`db/`, `drizzle/`, `examples/d1`),
  `.openai/hosting.json`, `app/chatgpt-auth.ts`.
