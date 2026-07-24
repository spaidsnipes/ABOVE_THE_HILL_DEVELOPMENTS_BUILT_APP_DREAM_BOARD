# Dreamboard Data Model

Source of truth: the SQL files in `supabase/`. All tables are RLS-protected,
private to their `owner_id` unless noted. Run order: core → workspace →
community → import → vision-vault.

| Table | Script | Purpose |
| --- | --- | --- |
| `wm_id` | wm-id-schema.sql | Legacy Passport handle (user_id → handle), shared with WOW World |
| `dreamboard_profiles` | core (+ passport-foundation) | Passport profile: display name, wisdom mode, season, theme, bio, disciplines, avatar_url |
| `dreamboard_projects` | core (+ project-model) | Project containers: kind, lifecycle status, mission, intended outcome, completion definition, next action (metadata), custom_type_label (project-types), ai_instructions + writing_voice (project-isolation) |
| `dreamboard_timeline_events` | core | Timeline events (schema present; UI pending) |
| `dreamboard_lounge_posts` | core (+ lounge-community) | Shared Lounge posts: body, topic, project_ref, hidden flag |
| `dreamboard_lounge_comments` | lounge-community | Lounge post comments |
| `dreamboard_lounge_reports` | lounge-community | Private content reports (moderation queue) |
| `dreamboard_lounge_blocks` | lounge-community | Per-user block list (private to blocker) |
| `dreamboard_shop_products` | core | Shared shop catalog |
| `dreamboard_radio_stations` | core | Shared radio stations |
| `dreamboard_vault_entries` | creator-workspace | **Knowledge Vault**: external/source material; `source_document_id` links processed imports |
| `dreamboard_graph_nodes` | creator-workspace | Creative Graph nodes (source/theme/…) |
| `dreamboard_graph_edges` | creator-workspace (+ graph-provenance) | Creative Graph relationships with provenance (origin/confidence/evidence/confirmed_by_user) |
| `dreamboard_companion_runs` | creator-workspace | AI Companion request history + provenance |
| `dreamboard_writing_documents` | creator-workspace | Writing Studio documents |
| `dreamboard_document_versions` | creator-workspace | Writing Studio version history |
| `dreamboard_import_batches` | import-foundation | Bulk import batch records |
| `dreamboard_source_documents` | import-foundation (+ import-extraction) | Per-file import records: storage path, extraction status/text/chars/error |
| `dreamboard_research_questions` | research-workspace | Per-project research questions + status |
| `dreamboard_corrections` | corrections-equations | Permanent append-only correction ledger |
| `dreamboard_equations` | corrections-equations | Equation Lab: expression, variables, units, assumptions, validation status |
| `dreamboard_claims` | research-workspace | Claims with evidence class, sources, objections, confidence, verification |
| `dreamboard_chapters` | book-architect | Real chapter outline: part, title, purpose, notes, status, sort order |
| `dreamboard_project_links` | constellation | Manual user-drawn relationships between projects |
| `dreamboard_project_members` | collaboration | Members/invitations: role, status, invited_email (RLS via SECURITY DEFINER helpers, ADR-0006) |
| `dreamboard_project_comments` | collaboration | Project comments + review requests |
| `dreamboard_project_activity` | collaboration | Per-project activity feed |
| `dreamboard_exports` | publishing | Versioned export history (format, title, word count) |
| `dreamboard_audio_narrations` | audiobook | Narration records: storage path, chapter link, pronunciation notes |
| `dreamboard_vision_entries` | vision-vault | **Vision Vault**: the creator's own ideas/dreams/goals (ADR-0004) |

Storage buckets: `dreamboard-private` (import originals, path
`{owner_id}/{batch_id}/{n}-{name}`).

Local-fallback keys (browser localStorage): `dreamboard-notes-v2`,
`dreamboard-draft-v2`, `dreamboard-lounge`, `dreamboard-cart`,
`dreamboard-radio-stream`, `dreamboard-snapshots`,
`dreamboard-vision-entries`, `dreamboard-chapters`.
