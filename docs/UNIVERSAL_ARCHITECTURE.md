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

## Phased plan (milestones 18–25)

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
| 26 | Project Memory + Creative Health | inspectable/editable memory; gentle patterns, disable-able |
| 27 | Imagination Mode + Reality Check + mode switch | Imagine/Build/Research/Challenge/Refine/Publish, labeled outputs |
| 28 | Voice Learning | Voice Guardian samples, confidence, quote vs imitation |
| 29 | Guest→Passport migration + accessibility pass | safe migration preview; contrast/focus/labels; route scroll reset |
| 30 | Completion audit + polish | replay journeys, remove/mark any placeholder, consolidate docs |

Milestone 21 folds in the recording-driven P1 defects (project-context
truthfulness, route scroll reset on nav, responsive split-screen header/title).

Each milestone: real production code, a safe migration, tests, browser
verification, docs, and a clean merged checkpoint before the next. No
placeholder is ever described as complete.
