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
- **Reader** (2026-07-22) — `app/reader.tsx`: chapter-aware (real chapter
  select), reading-progress bar, typography controls, print/proof preview.
  Honestly notes it shows the working draft until per-chapter manuscripts
  exist.
- **Audiobook Studio** (2026-07-22) — `app/audiobook.tsx` +
  `supabase/dreamboard-audiobook.sql`: narrations upload to private storage
  with persisted records, chapter links, pronunciation notes, signed-URL
  playback, delete with confirm; session-only fallback when signed out.
  Voice generation explicitly unavailable until a TTS provider is connected.
- **Organize My Notes** (2026-07-22) — `lib/organize.ts` + `app/organize.tsx`:
  deterministic word-recurrence clustering (labeled in-app as "no AI ran"),
  possible-duplicate detection, open-question surfacing, and a review screen
  where the creator approves theme groups before anything is applied.
  Approved themes are added alongside original tags (never replacing them)
  and synced to cloud vault entries where possible.
- **Correction Ledger + Equation Lab** (2026-07-23, Milestone 23) —
  `app/corrections-equations.tsx` + `supabase/dreamboard-corrections-equations.sql`,
  as tabs inside the Research Workspace. Correction Ledger is permanent and
  append-only (original preserved, revised/reason/evidence/affected locations,
  private-or-published visibility). Equation Lab records expression, variables,
  units/dimensions, assumptions, limitations, and a creator-set validation
  status — with an explicit in-UI statement that being calculable is not the
  same as being validated. Both project-scoped.
- **Research Workspace** (2026-07-23, Milestone 22) — `app/research.tsx` +
  `lib/research.ts` + `supabase/dreamboard-research-workspace.sql`: per-project
  research questions (open/investigating/answered/parked) and a claim system
  with the directive's full 13-class evidence taxonomy (established → …
  → needs_verification → rejected, humble-first), claim type, sources (real
  only), supporting evidence, objections, alternatives, confidence, and
  verification status. Scoped to the active project (never blends across work);
  a claim's evidence class is only ever what the creator set — nothing is
  upgraded automatically. New "Research" nav item. Unit-tested taxonomy.
- **Persona & Skill Architecture** (2026-07-23, Milestone 20) — `lib/companion.ts`
  now defines the **25 master personas** (each a transparent config: role,
  domain, reasoning style, tone, skills, safety) + a **30-skill registry**,
  composable (pin up to 3, or keyword-routed), with the active personas always
  shown and per-persona safety carried into the system prompt. Resolves the
  older Bible's "30 skills/30 personas" against this directive's "25 personas +
  skill registry" in favor of the newer spec (25 + registry). Output stays
  category-labeled; voice protection unchanged. Unit-tested
  (`tests/companion.test.mjs`).
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
- **Writing Studio** — extracted to `app/writing-studio.tsx` (2026-07-22):
  live autosave status, named versions (optional label on save), restore
  confirmation, side-by-side version compare in Version History, read-only
  source panel beside the page, focus mode, ⌘S saves a version. Cloud
  document + version history unchanged (`dreamboard_writing_documents`,
  `dreamboard_document_versions`), Markdown export preserved.
- **AI route** (`app/api/ai/route.ts`) — OpenAI-compatible chat proxy; honest
  503 until `AI_BASE_URL`/`AI_API_KEY`/`AI_MODEL` are set. Companion runs are
  logged to `dreamboard_companion_runs` either way.
- **Shop / Radio (data layer)** — product catalog and station rows in
  Supabase; WOW World live surfaces embedded via iframe. Radio audio playback
  of a pasted licensed stream works. (Lounge is now a full native layer.)
- **Settings / Creator Compass** — theme, season, wisdom mode persist to the
  profile.
- **Lounge** (2026-07-22) — native Dreamboard community layer in
  `app/lounge.tsx` + `supabase/dreamboard-lounge-community.sql`: real posts
  (with optional project reference), threaded comments, private reporting,
  per-user blocking (client-filtered + stored), and a moderation-hide flag.
  The WOW World iframe remains but is explicitly the secondary surface, not
  the whole feature. Honest setup/empty states.
- **Collaboration foundation** (2026-07-22) — `app/collaboration.tsx` +
  `supabase/dreamboard-collaboration.sql` (ADR-0006): project members,
  invitations by email, six roles (owner/admin/editor/contributor/reviewer/
  viewer), comments + review requests, and an activity feed — all enforced by
  row-level security via SECURITY DEFINER helpers (no policy recursion) and an
  RPC for invitation acceptance (no self role-escalation). Managers invite and
  set roles; invitees accept/decline; access is a database policy, not client
  state. Panel lives inside each project's detail.
- **Publishing foundation** (2026-07-22) — `app/publishing.tsx` +
  `lib/epub.ts` + `supabase/dreamboard-publishing.sql`: real Markdown and
  EPUB 3 exports built in-browser from the actual manuscript (jszip, lazy),
  readiness summary fed by the Finishing Engine, versioned export history
  under the Passport. PDF, public preview pages, and external destinations
  are explicitly listed as not available — no pretend buttons.
- **Finishing Engine** (2026-07-22) — inside each project's detail:
  deterministic readiness rules over real data (definition of done, mission,
  chapters complete, words present, remaining-work list empty, no blockers),
  creator-managed remaining-work / blockers / deferred-ideas lists, version
  target, and a "ready to publish" action that unlocks only when every rule
  passes. Labeled "transparent rules, no AI judgment."
- **Shell truthfulness & responsive fixes** (2026-07-23, Milestone 21) —
  addresses the recording's P1 defects: primary navigation now resets scroll
  to the top of the new page (window + stage); split-screen widths get fluid
  heading/title sizing (no more 6-line Writing Studio title) and wrapping
  header/toolbar actions; and the Writing Studio breadcrumb reads "Local
  draft — not in a project" instead of falsely implying an "Untitled Project"
  when none exists. Also removed the stale 10-skill Companion STATUS note.
- **Project Isolation + Active Context** (2026-07-23, Milestone 19) —
  `lib/active-context.ts`: an active-context set of up to 7 projects (with a
  primary), persisted, with a header switcher. New Vision Vault and Knowledge
  Vault captures are stamped with the primary project; both vaults filter to
  the active context with an explicit "Show all projects" escape hatch.
  Per-project AI instructions + writing voice
  (`supabase/dreamboard-project-isolation.sql`) are editable in the project
  detail and fed into the Companion's system prompt. Default (no active
  project) preserves the prior global behavior — nothing blends automatically.
- **Project Templates** (2026-07-23, Milestone 18) — `lib/project-types.ts`:
  19 universal typed templates (Book, Research, Invention, Device, Film,
  Series, Podcast, Game, Virtual World, Comic, Music, Visual Art, Business,
  Nonprofit, Course, Personal Archive, Family Legacy, Poetry, General) plus
  custom types with a label. Each maps to a tool/view set (base tools +
  type-specific). Create form is a template picker; project detail shows its
  workspace tools. `custom_type_label` column
  (`supabase/dreamboard-project-types.sql`); legacy slugs resolve to valid
  templates. Unit-tested (`tests/project-types.test.mjs`).
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
- Organizations/teams (project-level collaboration now exists); ownership
  transfer; threaded comment replies.
- PDF export, public preview pages, external publishing destinations;
  Marketplace checkout, creator economy.
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
