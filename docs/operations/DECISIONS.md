# DECISIONS — DREAMBOARD

Append-only. Supersede, never edit. Every entry states who decided, on what evidence, and
what it costs. Architectural decisions continue to live in the ADRs; this file records
**operational** decisions.

Status values: `DECIDED` · `PROPOSED` · `AWAITING FOUNDER` · `SUPERSEDED`

---

## DB-DEC-001 — Dreamboard needs a stated release objective

**Status:** **AWAITING FOUNDER** · **Raised:** 2026-07-28 by Sentinel

Dreamboard is now the company's highest-priority product. No release objective, target date,
or definition of done exists anywhere in the repository.

**Why this blocks real prioritisation.** Severity ordering is possible without an objective;
*value* ordering is not. Nothing in the codebase says whether the next unit of work should
be Vision Vault capture types, Shop checkout, decomposing `app/page.tsx`, or Passport depth.
Any ordering Sentinel produces without it is a guess presented with the authority of a
queue, which is a subtler version of the fabrication problem this company keeps fighting.

**Sentinel will not invent an objective to make the command center look complete.**

**Founder action:** state the objective, and a date if one exists.

---

## DB-DEC-002 — Products keep separate operating buses

**Status:** DECIDED by Sentinel, 2026-07-28

Dreamboard, WM Pro, and WOW World each get their own `docs/operations/` in their own
repository. Queues, risks, verification records and handoffs are never merged.

**The one sanctioned exception** is the Supabase project shared by Dreamboard and WM Pro,
recorded deliberately in **both** registers (DB-RISK-003 here, RISK-003 there) because a
change on either side can break the other.

**Rationale.** "One Company Memory" means one *coherent* memory, not one undifferentiated
pile. A merged queue would let WM Pro's Friday deadline silently outrank the product the
Founder just named highest priority.

---

## DB-DEC-003 — The local clone was fast-forwarded; nothing was deleted

**Status:** DECIDED by Sentinel, 2026-07-28

The clone was 17 commits behind. Sentinel fast-forwarded it to `2049bdd`. Untracked files
were preserved untouched. Fully reversible with `git reset --hard ba91915`.

**What Sentinel did not do:** delete the 164 lines of superseded local work, even though the
evidence that they are superseded is conclusive (DB-V-003). Deleting another person's
uncommitted work is the Founder's call, not an operations call. It is queued as
DB-OPS-P0-01 with a clear recommendation attached.

**Rationale for acting at all.** Leaving the clone stale was itself the active risk — it had
already cost one duplicated implementation. A fast-forward adds information and removes
none.
