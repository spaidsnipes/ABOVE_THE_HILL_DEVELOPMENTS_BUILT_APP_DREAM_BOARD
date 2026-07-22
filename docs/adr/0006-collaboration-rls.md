# ADR-0006: Collaboration access is enforced by RLS, not client state

Date: 2026-07-22 · Status: Accepted

## Context

Collaboration is the first system where a second person can read or write
another creator's data. The non-negotiable rule (directive + ADR-0002/privacy)
is that no collaborator may gain access through client-side state alone. Two
hazards had to be solved in Postgres:

1. **Policy recursion.** If the `dreamboard_projects` policy asks "is the
   caller a member?" by querying `dreamboard_project_members`, and the members
   policy asks "does the caller own/manage the project?" by querying
   `dreamboard_projects`, the two policies recurse.
2. **Self role-escalation.** An invitee accepting an invitation must not be
   able to write themselves a higher role while updating their membership row.

## Decision

- Membership and manager checks live in `SECURITY DEFINER` helper functions
  (`dreamboard_is_collaborator`, `dreamboard_is_manager`) that bypass RLS,
  breaking the recursion. Policies call the helpers instead of cross-querying.
- Access rules: owner (via `projects.owner_id`) and accepted members can read a
  project; owner + `admin` members can update; only the owner can delete
  (existing owner-only "for all" policy is untouched, new permissive policies
  are OR'd on top). Comments and activity are readable/writable by accepted
  collaborators; members and invitations are managed only by managers.
- Invitation acceptance goes through a `SECURITY DEFINER` RPC
  (`dreamboard_respond_invitation`) that only flips `status` and links the
  caller's `member_id` — it never touches `role`, so escalation is impossible.
  Invitees get no direct UPDATE policy on the members table.
- Roles: owner, admin, editor, contributor, reviewer, viewer. Managers may
  assign everything except owner; ownership transfer is deliberately out of
  scope for this milestone.

## Consequences

- The UI (`app/collaboration.tsx`) is a convenience over policies that already
  forbid unauthorized access; a tampered client cannot read or escalate.
- Helper functions must keep `search_path = public` pinned (done) to stay safe
  as `SECURITY DEFINER`.
- Ownership transfer, per-field role capabilities enforced in SQL (currently
  role capabilities are advisory in the UI), and threaded comment replies are
  future work.
