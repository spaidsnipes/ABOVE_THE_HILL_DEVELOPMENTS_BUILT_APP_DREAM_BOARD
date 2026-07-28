# HANDOFFS

One directory per role. One file per session:
`docs/operations/handoffs/<role>/YYYY-MM-DD-<role>.md`
(add `-2`, `-3` for multiple sessions in a day).

A handoff is the only thing that carries context between sessions. Chat memory does not
survive; this file does. Write it for someone who was not there.

## Required sections

```markdown
# <ROLE> HANDOFF — YYYY-MM-DD

**Role:** · **Product:** · **Repo / branch:** · **Start commit:** · **End commit:**
**Tickets claimed:** · **Tickets advanced:**

## 1. What I did
## 2. Commits created            (hash + one line each; "none" is a valid answer)
## 3. What I verified            (name the command, record the output)
## 4. What I did NOT verify      (be specific; this section is the most valuable one)
## 5. Blockers hit
## 6. Risks or decisions raised  (cross-reference RISKS_AND_BLOCKERS.md / DECISIONS.md)
## 7. Exact next action for whoever picks this up
```

## Rules

- **Evidence labels are mandatory:** VERIFIED / PARTIALLY VERIFIED / NOT VERIFIED / UNKNOWN.
- §4 is not optional and "none" is almost never true. A handoff with an empty §4 gets
  returned.
- Never claim another employee completed work unless its commit **and** handoff exist.
- Never record a secret value, account number, balance, or position.
- Do not fabricate activity to fill a session. "I was blocked for the whole block and here
  is exactly why" is a complete and useful handoff.
- Update `ACTIVE_TASK_QUEUE.md` and `EMPLOYEE_STATUS.md` in the same commit as the handoff.
