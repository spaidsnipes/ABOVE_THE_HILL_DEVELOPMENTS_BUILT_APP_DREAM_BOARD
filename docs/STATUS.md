# Dreamboard — Implementation Status

Audit of the actual codebase as of 2026-07-22 (commit `4bbd51c`). This is the
honest map: what works, what is placeholder, what does not exist yet. Update it
whenever a system changes tier.

## Working (real, wired to Supabase when connected)

- **Vision Vault** (2026-07-22) — distinct from Knowledge Vault (ADR-0004):
  own table `dreamboard_vision_entries` with idea lifecycle (inbox →
  developing/incubating → ready_for_project → archived), capture types,
  owner RLS; full CRUD with archive/restore, delete-with-confirm, search and
  status filters; quick capture from Creator Home; localStorage fallback with
  explicit "Secure to cloud" promotion; honest setup notice when the table
  isn't provisioned yet. View lives in `app/vision-vault.tsx` (first
  extraction from page.tsx).

- **Passport** — magic-link sign-in, handle claim (`wm_id` table), profile
  (display name, wisdom mode, creator season, theme) in `dreamboard_profiles`.
  UX fully says "Passport". View extracted to `app/passport.tsx`
  (2026-07-22) with a creator-identity profile section (biography,
  disciplines — `supabase/dreamboard-passport-foundation.sql`) and a truthful
  roadmap card for future Passport systems. Internal state renamed
  passportUser/passportHandle/etc.; only the `wm_id` table keeps its legacy
  name for WOW World compatibility (ADR-0001).
- **Knowledge Vault** — notes/journal/imports persist to
  `dreamboard_vault_entries` with localStorage fallback; search works.
- **Creative Graph** (2026-07-22) — real visualization in
  `app/creative-graph.tsx`: stored nodes rendered on a deterministic
  golden-angle layout (no invented positions of meaning), stored edges drawn
  with relationship labels, pan/zoom/selection, node-type and relationship
  filters, manual connect/remove, and edge provenance
  (`supabase/dreamboard-graph-provenance.sql`: origin, confidence, evidence,
  confirmed_by_user). AI-suggested edges render dashed gold and require
  explicit confirm/reject. Honest fallback when the provenance migration
  hasn't been run. Each Knowledge Vault entry still creates a `source` node.
- **Google Drive import (foundation)** (2026-07-22) — read-only OAuth
  connector fully built: `app/api/drive/*` (consent, callback with state
  check, file list, file/Google-Doc export download; session token in an
  HttpOnly cookie only) and `app/drive-import.tsx` (browse/search Drive,
  select, secure into a private import batch feeding the extraction
  pipeline). Shows exact setup instructions until GOOGLE_DRIVE_CLIENT_ID /
  _CLIENT_SECRET / _REDIRECT_URI are set — the only missing piece is those
  credentials.
- **Import text extraction** (2026-07-22) — `app/import-pipeline.tsx` +
  `supabase/dreamboard-import-extraction.sql` (ADR-0005): browser-side
  pipeline extracts txt/md/docx from preserved originals, tracks per-file
  states (uploaded → processing → processed / failed / unsupported) with
  specific reasons, supports retry, dedupes via a unique source-document
  index, and lands extracted text as Knowledge Vault entries (searchable via
  Universal Search) plus graph source nodes. PDFs/images/audio honestly
  marked unsupported until their extractors ship.
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
- **Projects** (2026-07-22) — real multi-project support in
  `app/projects.tsx`: create/edit/archive/restore/delete-with-confirm,
  full lifecycle statuses (idea → … → completed/archived), mission /
  intended outcome / definition of done / next action
  (`supabase/dreamboard-project-model.sql`), attached-material counts
  (vision, knowledge, documents), attach current writing document. Honest
  fallback when the migration hasn't run; Passport required (no local mode
  promised).
- **Universal Search** (2026-07-22) — `app/search.tsx`: keyword search
  (honestly labeled — not semantic) across Vision Vault, Knowledge Vault,
  projects, writing documents, chapters, and graph nodes with domain
  filters, excerpts, and open actions. Cloud queries are RLS-scoped per
  Passport; signed-out mode searches this device's stores and says so.
- **Book Architect** (2026-07-22) — real multi-chapter outline in
  `app/book-architect.tsx` + `supabase/dreamboard-book-architect.sql`:
  add/edit (title, purpose, notes, status)/duplicate/delete-with-confirm,
  controlled reorder, completion states, localStorage fallback when signed
  out. Writing Studio, Reader, exports, and snapshots use the real chapter
  titles. No chapters are generated for the user.
- **Creator Home** (2026-07-22) — extracted to `app/creator-home.tsx`; shows
  real data only: recent Vision Vault captures, Knowledge Vault sources,
  recent versions, imports needing retry, and a deterministic, explained
  "next meaningful step" (imports needing action → inbox ideas → active
  draft → unorganized sources → first capture). No fabricated insights.

## Placeholder / partial (UI exists, substance thin)

- **"Organize my notes"** — relabels "Unsorted" tags to "Emerging thread";
  no real clustering or AI organization.
- **Local Companion** — regex keyword routing to skill/persona names with
  templated output. The 30 skills / 30 personas are lists, not behaviors.
- **Reader** — renders the current draft only; fine as a preview.
- **Audiobook Studio** — session-only object-URL playback; no cloud storage.
- **Shop cart** — local cart math only; no checkout/payments (disclosed).
- **Creative Timeline / Creation Journal** — thin views over the single
  writing document and local notes. `dreamboard_timeline_events` still
  unused by the UI. `dreamboard_projects` and
  `dreamboard_timeline_events` tables exist but the UI doesn't use them.
- **ChatGPT workspace auth** (`app/chatgpt-auth.ts`) — starter-template
  leftover; unused by the app.

## Missing (in the vision, not yet started)

- Voice/image/file/link capture types for Vision Vault (model supports them;
  UI captures text only so far). Vision entries don't create graph nodes yet.
- PDF text extraction and image OCR for imports (txt/md/docx now supported).
- Embeddings / semantic graph links; real graph exploration UI.
- Project tasks, milestones, collaborators. Linking chapters to specific
  writing documents (Writing Studio still holds one document). Attaching vision/knowledge entries to projects from their
  vault views.
- Collaboration: shared workspaces, comments, permissions, organizations.
- Publishing pipeline (book/site/newsletter outputs), Marketplace checkout,
  creator economy.
- Passport depth: Creative DNA, skills, reputation, timeline, legacy.
- Tests beyond the rendered-HTML smoke suite (rewritten 2026-07-22 to test
  the real Dreamboard shell; the stale starter-template test was removed).

## Structural debt

- `app/page.tsx` holds all 19 views (~400 dense lines). Decompose
  incrementally per CLAUDE.md.
- WM naming remnants: `wm_id` table (kept, ADR-0001), `app/wm-id.css`
  classnames, `supabase/wm-id-schema.sql`.
- Unused starter scaffolding: Drizzle/D1 (`db/`, `drizzle/`, `examples/d1`),
  `.openai/hosting.json`, `app/chatgpt-auth.ts`.
