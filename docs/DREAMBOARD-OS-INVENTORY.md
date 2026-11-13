# Dream Board OS — one board, nothing lost (2026-11-13)

Founder, 2026-11-12: "what happened to everything else that was in the original Dream Board? Don't have split brain."
The original Next.js app (`~/dreamboard`, app/*.tsx) never had a live host and its tables were empty (1 growth entry, 3 shop rows),
so there is no data to migrate. Every feature now lives in the one static Dream Board, on the one WOW Passport. The directory is `#/rooms`.

| Original (app/…) | Now lives at | Notes |
|---|---|---|
| creator-home.tsx (Creator Home) | `#/home` (Golden board) + `#/rooms` | quick capture → Vision Vault |
| vision-vault.tsx | `#/r/vision` | lifecycle, capture types, make-it-a-project, Spaidbot questions (suggestion only) |
| page.tsx Knowledge Vault + import-pipeline.tsx + organize.tsx | `#/r/knowledge` | txt/md/docx import, Organize My Notes (deterministic) |
| creative-graph.tsx | `#/r/graph` | golden-angle layout, provenance columns, confirm/reject suggestions |
| search.tsx | `#/r/search` | across vision, knowledge, writing, projects, graph, Book Studio |
| projects.tsx + project types/isolation/finishing/memory/memory-health | `#/r/projects` | 19 types + custom, active context, Finishing Engine, Project Memory, Creative Health |
| constellation.tsx | `#/r/constellation` | stars sized by real material, user-drawn links only |
| writing-studio.tsx + page.tsx writer | `#/r/writing` | autosave, focus, versions, compare, Send to Book Studio, Spaidbot (insert only on click) |
| voice-guardian.tsx | `#/r/voice` | samples + deterministic fingerprint + draft check |
| book-architect.tsx | `#/book` (Book Studio) | chapters/outline/placement, import, themes, export |
| reader.tsx | `#/r/reader` | reads Book Studio manuscripts; 6×9 proof; print |
| audiobook.tsx | `#/r/audiobook` | private storage, chapter links, signed playback; TTS honestly "not connected" |
| publishing.tsx + lib/epub.ts | `#/r/publishing` + Book Studio export | EPUB3; .docx/.md stay in Book Studio (one exporter per format) |
| ai-studio.tsx + lib/companion.ts | `#/r/companion` | 30 personas + 30 skills via Spaidbot; "Suggestion · not your words" |
| research.tsx + corrections-equations.tsx | `#/r/research` | 13 evidence classes, append-only Correction Ledger, Equation Lab (hypothesis until sourced) |
| legacy.tsx | `#/r/legacy` | On This Day, evolution, earlier drafts, finished work |
| growth-rings.tsx | `#/r/growth` | rings + WOW Academy link |
| collaboration.tsx | `#/r/collaboration` | share a book/project as reader/editor; definer RPCs; margin notes |
| passport.tsx + appearance | `#/r/settings` | display name, season, wisdom mode, Dawn Paper / Midnight Garden, Reduce Motion |
| lounge.tsx, Radio, Music, TV | WOW dock (one Lounge, no second copy) | `data-wow-dock` buttons on `#/rooms` |
| Shop | WOW Marketplace link | |
| drive-import.tsx | Book Studio + Knowledge importers | Google Drive OAuth was never configured; not ported as a dead button |
| Golden inventions (new) | `#/tree` `#/orchard` `#/quantum` `#/belief` `#/today` | Money Tree roots also show the Founder-only Today's calls card |

Left out on purpose (with reason): device-only/guest modes (every room uses the Passport); "append AI text to draft" (the author's voice leads);
the old /api/ai and Drive routes (no server on IONOS; Spaidbot replaces /api/ai); biography/disciplines (profile columns not yet added).
SQL: supabase/dreamboard-os-{know,build,grow,grow-fix,publish}.sql — all applied (dry-run first), owner RLS, anon revoked.
