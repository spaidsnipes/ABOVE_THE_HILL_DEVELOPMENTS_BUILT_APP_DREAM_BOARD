# RISKS AND BLOCKERS — DREAMBOARD

**Owner:** Sentinel · **Last updated:** 2026-07-28
**Scope: Dreamboard only.** WM Pro risks live in that repository's own register.

---

## DB-RISK-007 — The designated highest-priority product has had **zero commits in six days** · HIGH · **OPEN**

**Evidence — VERIFIED by Sentinel, 2026-08-03.**

| | Dreamboard | WM Pro |
|---|---|---|
| `origin/main` HEAD | `f37f635` — **2026-07-28 15:43** | `f1ca9cd` — **2026-08-02 17:29** |
| Last product commit | `2049bdd`, 2026-07-26 (`f37f635` is Sentinel's ops bus, not product work) | continuous through 2026-08-02 |
| Employees dispatched | **none** | Forge, Noah, Micah, Nehemiah, Atlas, Research, Video Intelligence |
| Open gates / tickets | 5 filed by Sentinel 07-28, **all untouched** | 7-gate map, 40 new Bible-derived tickets (`f20eb15`) |

**Dreamboard is designated the company's highest-priority product.** For six days, 100% of
company throughput has gone to WM Pro. Not a single Dreamboard ticket — including the two
P0s — has been claimed, and no employee row lists Dreamboard work.

**This is not a criticism of the WM Pro work**, which is real, well-evidenced, and driving
toward a launch gate. It is a statement that **the stated priority and the actual allocation
have been opposite for six days**, and nobody has recorded that as a decision. Priority that
is never scheduled is not priority; it is an unexamined intention.

**The three Dreamboard P0/P1 items still sit exactly where they were filed:**
- **DB-OPS-P0-01** — 164 lines of superseded WIP awaiting a discard/keep ruling.
- **DB-DOC-P0-01** — `docs/STATUS.md` now **12 days stale** (audit basis `4bbd51c`,
  2026-07-22), still listing shipped systems as "not yet started."
- **DB-RISK-005** — still no stated release objective for the top-priority product.

**Resolution is a Founder decision, not an operations one.** Either:
1. **Dreamboard genuinely is first** → dispatch at least one employee to it now, starting
   with DB-DOC-P0-01 (unblocked, and the document every new employee reads first); or
2. **WM Pro's launch gate is first until it clears** → say so in writing, and Dreamboard's
   "highest priority" designation is suspended rather than quietly ignored.

Either is defensible. **Drifting between them is the option that costs the most**, because
work gets planned against a priority nobody is actually serving.

---

## DB-RISK-008 — WM Pro's launch-blocking RLS fix mutates **Dreamboard's** database · HIGH · **OPEN**

**Evidence — VERIFIED, cross-referenced 2026-08-03.**

WM Pro's go-live gate (Gate 4) lists `WM-SEC-P0-02` — apply the staged Supabase RLS fixes —
as a hard launch blocker, recorded **"2 days silent — escalated."**

That work targets Supabase project `zrzaifaxecwgpfrqctkp`, **which Dreamboard shares**
(DB-RISK-003). The WM Pro gate presents it as a WM-Pro-only item. It is not.

**Both directions are live risks:**
- **If it stays unfixed:** always-true write/delete policies remain, and every
  `dreamboard_*` table sits in a project with known-permissive policies.
- **If it is fixed carelessly:** a policy change written for WM Pro's lounge tables lands in
  the same project Dreamboard's Passport, vault, graph and audiobook tables live in. **No
  Dreamboard employee is currently assigned to review it**, because no Dreamboard employee is
  currently assigned to anything (DB-RISK-007).

**Mitigation — binding, and it costs nothing to honour:** `WM-SEC-P0-02` must not be applied
until (a) a backup exists, (b) DB-SEC-P1-01 has enumerated which tables Dreamboard actually
owns and their live policies, and (c) a named reviewer signs off on the Dreamboard side.
Requirement (b) is still **UNKNOWN** — it has never been run.

This is the sanctioned cross-product exception under DB-DEC-002 and is recorded in both
registers deliberately.

---

## DB-RISK-001 — A duplicate-work incident has already happened · HIGH · **OPEN**

**Evidence — VERIFIED by Sentinel, 2026-07-28.**

The local clone was **17 commits behind** `origin/main` (local `ba91915`, 2026-07-23;
remote `2049bdd`, 2026-07-26) and carried three untracked files on a branch named
`feature/project-memory-health`:

| Local, untracked | Shipped on `origin/main` in `8e71195` (2026-07-24) |
|---|---|
| `app/memory.tsx` — 97 lines | `app/memory-health.tsx` — 126 lines |
| `lib/creative-health.ts` — 44 lines | `lib/memory-health.ts` — 105 lines |
| `supabase/dreamboard-project-memory.sql` — 23 lines | `supabase/dreamboard-project-memory-health.sql` — 50 lines |
| — | plus `tests/memory-health.test.mjs`, `app/dreamboard.css`, wiring into `app/page.tsx`, and doc updates |

Both implement the same feature. The local `app/memory.tsx` defines memory scopes and
categories and imports `creativeHealth`; the shipped `app/memory-health.tsx` defines
`MEMORY_SCOPES` / `MEMORY_CATEGORIES` and imports `deriveCreativeHealth`. The commit that
shipped it is literally titled *"feat: add inspectable project memory and creative health."*

**The shipped version is strictly more complete:** wired into `app/page.tsx`, backed by a
`dreamboard_creative_health_preferences` table with dismissible signals, and covered by a
passing test (*"Creative Health is explainable, gentle, and based only on supplied
activity"*). The local version is wired into nothing and tested by nothing.

**Impact.** This is not a hypothetical. Someone built this feature twice. The local clone
never pulled, so anyone opening that directory would branch from a five-day-old base and
could rebuild it a third time. **This is exactly the failure the operating loop exists to
prevent, and it already cost the company one implementation.**

**Correction to Sentinel's own earlier assessment.** I first recorded this (in WM Pro's
register, as RISK-008) as *"valuable unpushed work at risk of being lost."* **That was
wrong.** I had counted the untracked files without checking the clone against its remote.
The work is not at risk of being lost; it is superseded, and the real problem was a stale
clone. Recorded rather than quietly amended.

**Mitigation.**
- **Done:** the clone was fast-forwarded to `2049bdd`. Untracked files were preserved.
  Fully reversible with `git reset --hard ba91915` if the Founder wants the old base back.
- **Founder decision (DB-OPS-P0-01):** discard the three superseded files, or keep them for
  reference. **Sentinel recommends discard** — keeping a second, worse implementation of a
  shipped feature in the working tree is how this happens a third time. Sentinel will not
  delete another person's work unilaterally.
- **Standing:** step 1 of the operating loop is *pull*. This incident is the argument for it.

**Note:** `docs/research/world-class-study.md` is also untracked but is **not** part of this
duplication — it is unreviewed research, and is a separate keep-or-commit decision.

---

## DB-RISK-002 — `docs/STATUS.md` is stale and actively misleading · HIGH · **OPEN**

**Evidence — VERIFIED by Sentinel, 2026-07-28.** `docs/STATUS.md` opens with *"Audit of the
actual codebase as of 2026-07-22 (commit `4bbd51c`)."* The repository is at `2049bdd` — **17
commits and four days later.**

It is wrong in **both** directions, which is the dangerous kind of stale:

- **Understates what exists.** Its "Missing (in the vision, not yet started)" section lists
  *"Tests beyond the rendered-HTML smoke suite."* There are now **9 test files and 24
  passing tests**, including memory-health, growth-rings, voice-guardian, wow-bridge,
  companion, research, archive-scale and project-types. An employee reading STATUS would
  conclude Dreamboard has no real test coverage and might rebuild a suite that exists.
- **Omits shipped systems entirely.** Growth Rings, the public front door, Passport
  device-code sign-in, the WOW World handoff bridge, and project memory + Creative Health
  all shipped after the audit and appear nowhere in it.

**Impact.** STATUS.md is the document a new employee trusts first — it explicitly presents
itself as *"the honest map."* An honest map that is four days and seventeen commits out of
date produces confidently wrong decisions, and this repository has already demonstrated the
cost of that (DB-RISK-001).

**Mitigation.** DB-DOC-P0-01 — re-audit against `2049bdd`. The document's own instruction
(*"Update it whenever a system changes tier"*) is the right rule; it simply was not followed.
Consider making a STATUS refresh part of the definition of done for any milestone commit.

---

## DB-RISK-003 — Shared Supabase project with WM Pro · HIGH · **OPEN**

Dreamboard and WM Pro share Supabase project `zrzaifaxecwgpfrqctkp`. WM Pro's register
(RISK-003 there) records **always-true write/delete RLS policies** on its lounge tables plus
disabled leaked-password protection, unresolved.

**Impact, in both directions.**
- Dreamboard may inherit exposure from policies it does not own and cannot see from this
  repository.
- Conversely, anyone applying the WM Pro RLS fix could break Dreamboard tables in the same
  transaction.

**This is the one sanctioned cross-product dependency.** It is recorded in both registers
deliberately. Neither product may change shared policies without the other's verification
and a backup.

**Mitigation.** DB-SEC-P1-01 — enumerate which tables in that project Dreamboard actually
owns (`dreamboard_*`, `wm_id`), confirm each has owner-scoped RLS, and confirm none of the
always-true policies touch them. **Not yet done. Currently UNKNOWN, not "fine."**

---

## DB-RISK-004 — No runtime or visual verification has ever been recorded · MEDIUM · **OPEN**

Build and tests pass (24/24, VERIFIED). **Nobody has driven the running application and
recorded what they saw.** Every claim in this repository about how Dreamboard *behaves* —
as opposed to how it compiles — is inference from source.

This matters more for Dreamboard than for a typical codebase, because its documented
identity is built on honest states: localStorage fallbacks, "Secure to cloud" promotion,
explicit setup notices when a migration has not been run, AI-suggested graph edges requiring
confirmation. **Those are exactly the paths a passing build cannot exercise.** A test
asserting a component ships no placeholder content does not prove the fallback renders
correctly when Supabase is absent.

**Mitigation.** DB-VERIFY-P1-01 — run the dev server, drive one shipped feature end to end
(Memory & Creative Health is the natural candidate, being newest and most recently
duplicated), and record the first runtime evidence this product has. Capture the
signed-out/no-Supabase path specifically.

---

## DB-RISK-005 — The top-priority product has no stated release objective · MEDIUM · **OPEN**

Dreamboard has been designated the company's highest-priority product. There is no stated
release objective, target date, or definition of done anywhere in the repository.

**Impact.** Priority without a target cannot be acted on. Sentinel can order tickets by
severity, but cannot say whether shipping Growth Rings polish matters more than Vision Vault
capture types without knowing what the release is *for*. Any ordering produced without it is
Sentinel's guess wearing the authority of a queue.

**Sentinel will not invent an objective to make the document look complete.**

**Mitigation.** DB-DEC-001 — Founder states the objective and, if possible, a date.

---

## DB-RISK-006 — Empty branch masquerading as feature work · LOW · **OPEN**

`feature/project-memory-health` contains **zero commits of its own** — it is a label pointing
at `main`. Its name implies in-progress work on the very feature that already shipped
(DB-RISK-001), which is precisely the signal that would stop a careful employee from
duplicating it, pointing the wrong way.

**Mitigation.** DB-OPS-P1-01 — delete it, or rename it to something that does not imply
active work. Trivial, but it removes a false signal.
