# Dreamboard — Universal Creator Intelligence OS

Dreamboard is a **universal** Creator Intelligence Operating System: a place to
capture, organize, connect, research, write, visualize, build, and publish
ideas. It is not a book-only, spiritual, or founder-private app. The founder's
own frameworks, worlds, inventions, and research will live as ordinary private
**projects** inside Dreamboard — never hard-coded into the product.

This document is the durable plan for evolving the existing (already generic)
architecture toward that vision. It complements [CLAUDE.md](../CLAUDE.md)
(rules), [STATUS.md](STATUS.md) (reality), and [DATA_MODEL.md](DATA_MODEL.md).

## Authoritative source & resolved conflicts

The July-2026 implementation directive is the newest authoritative source; where
older docs conflict, it wins. Resolved conflicts: (1) personas — 25 master
personas + a separate composable skill registry (not 30 overlapping personas),
implemented in M20; (2) appearance — the two headline modes are **Dawn Paper**
and **Midnight Garden** with a Reduce Motion setting (visual-polish pass), while
the older `midnight-gold/violet-gold/blue-gold` themes remain as secondary
options for back-compat. Reduce-motion persists localStorage-first; cloud
persistence needs `dreamboard-appearance.sql`.

## Guiding principles (condensed)

Learn the creator, not just their prose · preserve source + provenance · never
silently overwrite · separate fact / interpretation / hypothesis / fiction /
metaphor / belief · encourage imagination without passing invention off as
research · never fabricate sources or completed work · private by default ·
AI is assistant, never owner · keep project boundaries clear, cross only on
explicit user intent · remain fully usable without WOW World/Passport.

## Preserve, don't rebuild

The data layer is already generic (projects, vaults, graph, chapters, docs).
Wisdom mode and WOW World stay as **optional** layers — nothing of the
founder's specific work is hard-coded, so universality needs additive work, not
a teardown. WOW World remains an optional iframe/integration; Dreamboard runs
without it.

## Universal project architecture

- **Typed templates** (`lib/project-types.ts`): 19 built-in types + custom,
  each mapping to a tool/view set. `dreamboard_projects.kind` holds the type
  slug; `custom_type_label` names custom types. Templates configure which
  workspace tools show — they never silo data into incompatible shapes.
- **Isolation**: every workspace hook filters by the active project; an
  active-context set of up to 7 projects; per-project AI instructions, writing
  voice, and privacy. Cross-project use only on explicit link/select.

## Persona & skill architecture

Extend `lib/companion.ts` into a typed registry of 25 master personas — each a
transparent config (role, domain, reasoning style, tone, tool access,
permissions, output format, safety boundaries, memory scope), composable, with
the active persona always visible — plus a skill registry (input/output schema,
permissions, provenance, model selection, confidence/uncertainty).

## Research workspace

Per-project `dreamboard_research_questions`, `dreamboard_claims` (evidence
class, sources, objections, alternatives, confidence, verification, revision
history), `dreamboard_corrections` (permanent ledger), `dreamboard_equations`
(Equation Lab: variables, units, dimensional analysis, assumptions, validation
status — calculable never implies validated). Evidence classes: Established,
Emerging, Hypothesis, Interpretation, Personal Observation, Testimony,
Historical Claim, Philosophical Argument, Theological Claim, Fictional/Creative,
Analogy/Metaphor, Needs Verification, Rejected/Superseded (customizable).

## Project memory

`dreamboard_project_memory`: inspectable, correctable, pinnable, exportable —
never invisible or uncontrollable. Users select active context and restrict
sensitive items.

## Privacy & permissions

Private by default (RLS). Project-level permissions via `SECURITY DEFINER`
helpers (see ADR-0006). No automatic cross-project blending. Explicit
active-context selection. No training on private content.

## Phased plan (milestones 18–30)

| # | Milestone | Core deliverable |
| --- | --- | --- |
| 18 | Project Templates | 19 typed templates + custom; tool-set per type |
| 19 | Project Isolation + Active Context | workspace scoped to active project(s); per-project AI instructions/voice/privacy |
| 20 | Persona & Skill Architecture | 25 master personas + skill registry, composable, active-persona shown |
| 21 | Research Workspace | questions, claims, evidence classes, sources, objections |
| 22 | Correction Ledger + Equation Lab | permanent corrections; equations with units/validation status |
| 23 | Constellation View | navigable multi-project graph, ecosystem→note zoom |
| 24 | Time Machine + Legacy Library | On This Day / evolution; finished-work archive |
| 25 | Time Machine + Legacy Library | On This Day / evolution; finished-work archive |
| 26 | Project Memory + Creative Health | inspectable/editable memory; gentle patterns, disable-able — implemented in `supabase/dreamboard-project-memory-health.sql` + `app/memory-health.tsx` |
| 27 | Imagination Mode + Reality Check + mode switch | Imagine/Build/Research/Challenge/Refine/Publish, labeled outputs — implemented in `lib/companion.ts` + `app/ai-studio.tsx` |
| 28 | Voice Learning | Voice Guardian samples, source-coverage (not a fake confidence score), quote vs imitation — implemented in `app/voice-guardian.tsx` + `supabase/dreamboard-voice-guardian.sql` |
| 29 | Guest→Passport migration + accessibility pass | explicit migration preview/confirmation, safe retry protection, skip link/focus visibility, route scroll reset — implemented in `app/passport.tsx` + `app/page.tsx` |
| 30 | Completion audit + polish | completed baseline: production shell test rejects sample/placeholder creative content; readiness screen shows connection state rather than inventing it |
| 31 | Archive Scale | implemented: 7,000-file staging plan, durable private batches, 500-file resumable extraction windows, source-preserving extraction |
| 32 | Creator Ownership Export | implemented: portable current-device workspace archive (notes, draft, versions) with explicit cloud-original limitations |
| 33 | WOW World Bridge | implemented boundary: Lounge/Shop/Radio open only route URLs; no Passport handle, email, token, or private work is silently sent across apps |
| 34 | Launch Readiness | implemented: service-connection and privacy checks before release, with direct Passport/import/export actions |
| 35 | Production Journey Audit | automated core-flow audit covers clean server render, no sample creative content, archive-scale boundaries, creator-export scope, and WOW handoff privacy; signed-in Supabase replay remains a release checklist item |

Milestone 21 folds in the recording-driven P1 defects (project-context
truthfulness, route scroll reset on nav, responsive split-screen header/title).

Each milestone: real production code, a safe migration, tests, browser
verification, docs, and a clean merged checkpoint before the next. No
placeholder is ever described as complete.

## Production path (milestones 36–65)

This is the delivery order after the universal foundation. A milestone is only
complete when its user journey, data boundary, and failure state are testable.

| # | Milestone | Completion condition |
| --- | --- | --- |
| 36 | Passport handoff | One-time, 90-second, server-only handoff opens Lounge, Shop, or Radio with a real shared Passport session. |
| 37 | Device code sign-in | A creator can enter a Supabase email OTP on the device they want to use; email template and redirect configuration are verified. |
| 38 | Identity audit log | Sign-in, handoff, consent, and revocation events have an owner-visible audit trail. |
| 39 | WOW community hardening | WM Pro Lounge uses owner UUIDs, restrictive RLS, and server-authenticated write APIs. |
| 40 | WOW radio roles | Station publishing/upload uses explicit owner/editor roles and private upload authorization. |
| 41 | WOW shop commerce boundary | Catalog remains real; checkout begins only with a selected, verified payment provider and webhooks. |
| 42 | Broker consent boundary | Every broker tile states its actual status; OAuth begins only with provider credentials, callback URLs, encryption, revocation, and compliance review. |
| 43 | Import session ledger | A 7,000-file archive survives browser refresh, resumes safely, and retains per-file receipts. |
| 44 | Private intake guardrails | File size/type limits, hashes, duplicate handling, retries, and quota messages are enforced. |
| 45 | Extraction workers | Text/document extraction records progress, failures, retry, and original provenance. |
| 46 | Private retrieval index | Creator-approved chunks become project-scoped, searchable private material. |
| 47 | Drive consent | Google Drive uses limited read-only consent, folder selection, disconnect, and token revocation. |
| 48 | Vault search | Search/filter/source views work across imported material without inventing relationships. |
| 49 | Source assignment | Captures and sources can be assigned to projects with reversible, audited links. |
| 50 | Book workflow | Outline, chapters, source links, manuscript revisions, and exports operate from one source of truth. |
| 51 | Voice consent | Voice references require creator ownership/permission, project scope, removal, and coverage reporting. |
| 52 | Companion provider | A provider-backed Companion has consent, active-context limits, provenance, and spend caps. |
| 53 | Companion safety ledger | Each model run has an owner-visible record, tool/data scope, and safe error/retry state. |
| 54 | Writing resilience | Offline drafts, conflict recovery, version restore, and export verification are end-to-end tested. |
| 55 | Audiobook media | Private audio uploads, playback, deletion, and chapter linkage are verified with signed URLs. |
| 56 | Publishing workflow | Release checklist, public preview, permissions, and destination-specific publishing are truthful and versioned. |
| 57 | Collaboration operations | Invitations, RBAC, comments, reviews, and activity are tested against unauthorized access. |
| 58 | Moderation operations | Reporting, blocking, moderation actions, retention, and appeals have real owner/admin data paths. |
| 59 | Creator ownership | Full private export, deletion, and retention controls are documented and tested. |
| 60 | Long-session design | Luminous glass visuals pass contrast, focus, reduced-motion, and extended writing/reading comfort review. |
| 61 | Mobile journey | Passport, capture, import staging, writing, and WOW handoff work on supported mobile browsers. |
| 62 | Accessibility audit | Keyboard, screen reader labels, focus order, and error messages pass a formal audit. |
| 63 | Observability | Error reporting and privacy-safe operational logs cover every critical server route. |
| 64 | Load/security test | Large imports, session expiry, RLS, rate limits, and failure recovery are exercised before launch. |
| 65 | Launch gate | A signed-in creator completes the critical journey; only then may the app be called publicly launch-ready. |
