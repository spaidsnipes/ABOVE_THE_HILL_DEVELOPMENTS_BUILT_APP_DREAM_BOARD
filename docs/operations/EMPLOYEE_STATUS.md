# EMPLOYEE STATUS — DREAMBOARD

**Last updated:** 2026-07-28 · Update your own row at session start and before your handoff.

| Employee | Role | Active task | Status | Branch | Last commit | Last handoff | Updated |
|---|---|---|---|---|---|---|---|
| **Sentinel** | COO — operations, verification, prioritization. **No production code.** | Dreamboard audit + ops bus | ACTIVE | `feature/project-memory-health` (== `main`) | `2049bdd` (verified, not authored) | `handoffs/sentinel/2026-07-28-sentinel.md` | 2026-07-28 |
| **Forge** | Research, architecture, tickets, and production engineering on approved tickets | — | UNASSIGNED | — | — | none | — |
| **Noah** | Implementation engineer | — | UNASSIGNED | — | — | none | — |
| **Atlas** | Knowledge indexing — **verified findings only** | — | UNASSIGNED | — | — | none | — |
| **Research Lab** | Documentation. **No production code.** | — | UNASSIGNED | — | — | none | — |

**No employee has claimed Dreamboard work in this block.** Every ticket in
`ACTIVE_TASK_QUEUE.md` is unclaimed or awaiting the Founder.

## Operating loop

1. **Pull.** Non-negotiable here — this repository has already lost an implementation to a
   stale clone (DB-RISK-001).
2. Read `ATH_COMMAND_CENTER.md` → `ACTIVE_TASK_QUEUE.md` → your latest role handoff.
3. Confirm repository, branch, HEAD, working tree.
4. Claim exactly one primary task; commit the claim before starting.
5. Do the work → verify → commit → push → handoff → update the queue and this file → record
   new risks or decisions.

## No duplicate work

Before starting, check the owner, status, latest commit, existing branch, and handoff. If
someone is already implementing it, take a supporting audit, test, research, or
documentation task instead.

**This is not theoretical here.** The Memory & Creative Health feature was built twice
because a stale clone hid the first implementation. Step 1 exists because of it.

## Standing prohibitions

- Never fabricate data to fill a UI. If it is not computed, say *unavailable*. Dreamboard's
  test suite already enforces this — keep it that way.
- Never record a secret value, credential, or personal data in a document or commit.
- Never change live database policy without a backup and Founder approval — **the Supabase
  project is shared with WM Pro** (DB-RISK-003).
- Never claim another employee completed work unless its commit **and** handoff exist.
- Never work from an unpulled clone.
