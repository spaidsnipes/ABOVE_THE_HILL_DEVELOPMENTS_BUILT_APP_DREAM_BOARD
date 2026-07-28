# ACTIVE TASK QUEUE — DREAMBOARD

**Owner:** Sentinel · **Last updated:** 2026-07-28 · **Base commit:** `2049bdd`
**Scope: Dreamboard only.** Do not mix WM Pro or WOW World tickets into this queue.

## Valid statuses

`BACKLOG` · `READY FOR FORGE` · `FORGE ACTIVE` · `READY FOR NOAH` · `NOAH ACTIVE` ·
`READY FOR VERIFICATION` · `SENTINEL VERIFYING` · `VERIFIED` · `PARTIALLY VERIFIED` ·
`BLOCKED` · `DEFERRED`

## Claim protocol

1. **Pull** — this repository has already lost one implementation to a stale clone
   (DB-RISK-001). 2. Read `ATH_COMMAND_CENTER.md` and this file. 3. Read your latest role
   handoff. 4. Confirm repo/branch/HEAD/working tree. 5. Claim exactly one primary task.
6. Commit the claim before starting.

---

## Namespace reconciliation — read before creating a ticket ID

A concurrent Forge session is using a **`DB-P0-00N`** series (e.g. `DB-P0-002 — Deployment,
Auth, Data & Persistence Contracts`, drafted at `docs/DB-P0-002-CONTRACTS.md`). This queue
uses a **`DB-<AREA>-P<n>-<nn>`** series. **Both are valid; neither is being renamed
retroactively**, because renaming live ticket IDs mid-flight is how references rot.

Rule going forward: **use the `DB-<AREA>-P<n>-<nn>` form in this queue**, and when a ticket
corresponds to a Forge `DB-P0-00N` document, name that document in its *Evidence source*
field. Sentinel will map the two as they land.

**Convergent finding worth recording:** the Forge session independently established that the
local clone was 17 commits behind and that the untracked WIP duplicates `8e71195`, reaching
the same conclusion from the same evidence without coordination. Two independent employees,
same verdict — that materially raises confidence in DB-RISK-001, and it is also the first
demonstration that the repository-as-bus actually works.

**Forge's open question, now answered:** Forge asked what "Command Center" refers to, noting
that no such file existed in Dreamboard. It exists as of this commit —
`docs/operations/ATH_COMMAND_CENTER.md`, this product's own bus, separate from WM Pro's per
DB-DEC-002.

---

## DB-OPS-P0-01 — Resolve the superseded local WIP

| Field | Value |
|---|---|
| **Ticket ID** | DB-OPS-P0-01 |
| **Product** | Dreamboard |
| **Priority** | P0 |
| **Owner** | **Founder** |
| **Status** | **BLOCKED — Founder decision** |
| **Objective** | Decide the fate of `app/memory.tsx`, `lib/creative-health.ts`, `supabase/dreamboard-project-memory.sql` — 164 untracked lines that duplicate the feature shipped in `8e71195`. |
| **Dependencies** | None |
| **Evidence source** | DB-RISK-001 — **VERIFIED by Sentinel**: shipped version is larger, wired into `app/page.tsx`, backed by a preferences table, and covered by a passing test; the local version is wired into nothing and tested by nothing. |
| **Files / subsystems** | The three untracked files above |
| **Acceptance criteria** | Working tree is clean of superseded duplicates, **or** the files are deliberately retained with a written reason in `DECISIONS.md`. Either outcome is acceptable; leaving it undecided is not. |
| **Verification requirements** | `git status` clean of those paths, or a DECISIONS entry naming them. |
| **Claimed by** | — |
| **Claim timestamp** | — |
| **Latest commit** | — |
| **Handoff location** | `docs/operations/handoffs/sentinel/` |
| **Blockers** | Sentinel will not delete another person's work unilaterally. |
| **Next action** | **Founder: discard or keep.** Sentinel recommends discard. `docs/research/world-class-study.md` is a separate, unrelated decision. |

---

## DB-DOC-P0-01 — Re-audit `docs/STATUS.md` against `2049bdd`

| Field | Value |
|---|---|
| **Ticket ID** | DB-DOC-P0-01 |
| **Product** | Dreamboard |
| **Priority** | P0 |
| **Owner** | — |
| **Status** | **BACKLOG — unblocked, high value** |
| **Objective** | Make the "honest map" honest again. It is 17 commits stale and wrong in both directions. |
| **Dependencies** | None |
| **Evidence source** | DB-RISK-002 — **VERIFIED**: STATUS lists tests beyond the smoke suite as *not yet started*; there are 9 test files and 24 passing tests. Growth Rings, public front door, Passport device-code sign-in, WOW handoff bridge and project memory + Creative Health are all shipped and unlisted. |
| **Files / subsystems** | `docs/STATUS.md` |
| **Acceptance criteria** | Header cites `2049bdd`. Every system shipped since `4bbd51c` appears in the correct tier. Nothing is listed as missing that exists. **Every tier claim traceable to a file, a test, or a commit — no tier assigned from memory.** |
| **Verification requirements** | Sentinel spot-checks five claims at random against the repository; any single unsupported claim returns the ticket. |
| **Claimed by** | — |
| **Claim timestamp** | — |
| **Latest commit** | — |
| **Handoff location** | `docs/operations/handoffs/` |
| **Blockers** | None |
| **Next action** | Best unblocked ticket in this queue. Start with `git log 4bbd51c..2049bdd` and work forward. |

---

## DB-VERIFY-P1-01 — First runtime verification of a shipped feature

| Field | Value |
|---|---|
| **Ticket ID** | DB-VERIFY-P1-01 |
| **Product** | Dreamboard |
| **Priority** | P1 |
| **Owner** | — |
| **Status** | BACKLOG |
| **Objective** | Drive the running app and record what actually renders. No runtime evidence has ever been captured for this product. |
| **Dependencies** | None — `npm run dev` is available |
| **Evidence source** | DB-RISK-004 |
| **Files / subsystems** | Memory & Creative Health view (newest, and the feature that was duplicated) |
| **Acceptance criteria** | Feature driven end to end; **the signed-out / no-Supabase fallback path exercised specifically**, since honest-fallback behaviour is Dreamboard's core promise and a passing build cannot prove it; screenshots or page text recorded in the handoff. |
| **Verification requirements** | Evidence attached. "It looked fine" is not evidence. |
| **Claimed by** | — |
| **Claim timestamp** | — |
| **Latest commit** | — |
| **Handoff location** | `docs/operations/handoffs/` |
| **Blockers** | None known. Supabase credentials may be needed for the signed-in path; the signed-out path needs nothing. |
| **Next action** | Run `npm run dev`, open the Memory & Creative Health view signed out, record the fallback state. |

---

## DB-SEC-P1-01 — Confirm Dreamboard's exposure to the shared-Supabase RLS debt

| Field | Value |
|---|---|
| **Ticket ID** | DB-SEC-P1-01 |
| **Product** | Dreamboard (cross-product) |
| **Priority** | P1 |
| **Owner** | — |
| **Status** | BACKLOG |
| **Objective** | Establish whether WM Pro's open RLS debt touches Dreamboard-owned tables, and whether fixing it could break Dreamboard. |
| **Dependencies** | Supabase project access |
| **Evidence source** | DB-RISK-003; WM Pro `docs/PASSPORT_IDENTITY_AUDIT.md` |
| **Files / subsystems** | Supabase `zrzaifaxecwgpfrqctkp`; `supabase/*.sql` in this repo |
| **Acceptance criteria** | Every `dreamboard_*` table and `wm_id` enumerated with its actual RLS policy recorded; each confirmed owner-scoped or flagged. Status moves from UNKNOWN to a stated finding. |
| **Verification requirements** | Policy list captured from the live project, not inferred from migration files — **migrations show what was intended, not what is live.** |
| **Claimed by** | — |
| **Claim timestamp** | — |
| **Latest commit** | — |
| **Handoff location** | `docs/operations/handoffs/` |
| **Blockers** | Needs Supabase access. **Read-only inspection only — no policy is changed under this ticket.** |
| **Next action** | Enumerate and report. Any change is a separate, Founder-approved ticket with a backup. |

---

## DB-OPS-P1-01 — Remove the empty `feature/project-memory-health` branch

| Field | Value |
|---|---|
| **Ticket ID** | DB-OPS-P1-01 |
| **Product** | Dreamboard |
| **Priority** | P1 (trivial) |
| **Owner** | — |
| **Status** | BACKLOG |
| **Objective** | The branch has zero commits of its own and implies active work on an already-shipped feature. |
| **Dependencies** | DB-OPS-P0-01 (the untracked files currently sit on it) |
| **Evidence source** | DB-RISK-006 — **VERIFIED**: `git log main..feature/project-memory-health` is empty. |
| **Files / subsystems** | git refs only |
| **Acceptance criteria** | Branch deleted or renamed; no branch name implies work that is already shipped. |
| **Verification requirements** | `git branch` reviewed. |
| **Claimed by** | — |
| **Claim timestamp** | — |
| **Latest commit** | — |
| **Handoff location** | `docs/operations/handoffs/` |
| **Blockers** | Resolve DB-OPS-P0-01 first so nothing is lost with the branch. |
| **Next action** | Hold until the WIP decision lands. |

---

## Not yet ticketed — from `docs/STATUS.md`

`docs/STATUS.md` lists real placeholder and missing work (Shop cart has no checkout;
Creative Timeline is thin over unused tables; Vision Vault captures text only; no PDF/OCR
import; no embeddings or real graph exploration; no project tasks/milestones/collaborators;
`app/page.tsx` holds all 19 views in ~400 dense lines; unused Drizzle/D1 scaffolding and WM
naming remnants).

**These are deliberately not ticketed yet**, for two reasons: the source document is stale
and must be re-audited first (DB-DOC-P0-01), and **there is no stated release objective to
prioritise them against** (DB-RISK-005). Ordering them now would be Sentinel's guess wearing
the authority of a queue.
