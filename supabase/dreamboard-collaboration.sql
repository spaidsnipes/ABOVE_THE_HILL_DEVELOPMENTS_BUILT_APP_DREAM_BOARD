-- Collaboration foundation: project members, roles, invitations, comments,
-- and activity. RLS is the only security boundary — no collaborator gains
-- access through client state alone.
--
-- The projects <-> members relationship would recurse if each table's policy
-- queried the other, so membership checks live in SECURITY DEFINER helpers
-- that bypass RLS. Invitation acceptance goes through an RPC so an invitee can
-- never escalate their own role by writing to their membership row directly.
-- Run after dreamboard-core-schema.sql and dreamboard-project-model.sql.

create table if not exists public.dreamboard_project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.dreamboard_projects(id) on delete cascade,
  member_id uuid references auth.users(id) on delete cascade,
  invited_email text,
  role text not null default 'viewer' check (role in ('owner', 'admin', 'editor', 'contributor', 'reviewer', 'viewer')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'revoked')),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, member_id),
  check (member_id is not null or invited_email is not null)
);
create index if not exists dreamboard_project_members_project_idx on public.dreamboard_project_members (project_id);
create index if not exists dreamboard_project_members_member_idx on public.dreamboard_project_members (member_id);

create table if not exists public.dreamboard_project_comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.dreamboard_projects(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  author_label text not null default '',
  body text not null check (char_length(body) between 1 and 4000),
  is_review_request boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists dreamboard_project_comments_project_idx on public.dreamboard_project_comments (project_id, created_at);

create table if not exists public.dreamboard_project_activity (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.dreamboard_projects(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  actor_label text not null default '',
  action text not null,
  detail text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists dreamboard_project_activity_project_idx on public.dreamboard_project_activity (project_id, created_at desc);

-- SECURITY DEFINER membership checks (break policy recursion).
create or replace function public.dreamboard_is_collaborator(pid uuid, uid uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.dreamboard_projects p where p.id = pid and p.owner_id = uid)
      or exists (select 1 from public.dreamboard_project_members m where m.project_id = pid and m.member_id = uid and m.status = 'accepted');
$$;

create or replace function public.dreamboard_is_manager(pid uuid, uid uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.dreamboard_projects p where p.id = pid and p.owner_id = uid)
      or exists (select 1 from public.dreamboard_project_members m where m.project_id = pid and m.member_id = uid and m.status = 'accepted' and m.role = 'admin');
$$;

grant execute on function public.dreamboard_is_collaborator(uuid, uuid) to authenticated;
grant execute on function public.dreamboard_is_manager(uuid, uuid) to authenticated;

-- Accept or decline an invitation without any ability to change the assigned
-- role — the invitee only flips status and links their user id.
create or replace function public.dreamboard_respond_invitation(pid uuid, accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := (select auth.uid());
  uemail text := (select auth.jwt() ->> 'email');
begin
  update public.dreamboard_project_members
     set member_id = uid,
         status = case when accept then 'accepted' else 'declined' end,
         updated_at = now()
   where project_id = pid
     and status = 'pending'
     and (member_id = uid or invited_email = uemail);
end;
$$;
grant execute on function public.dreamboard_respond_invitation(uuid, boolean) to authenticated;

-- Projects: existing owner-only "for all" policy stays; add collaborator read
-- and manager update as additional permissive policies (OR'd together).
alter table public.dreamboard_projects enable row level security;
create policy "Collaborators read shared projects" on public.dreamboard_projects
  for select to authenticated using (public.dreamboard_is_collaborator(id, (select auth.uid())));
create policy "Managers update shared projects" on public.dreamboard_projects
  for update to authenticated
  using (public.dreamboard_is_manager(id, (select auth.uid())))
  with check (public.dreamboard_is_manager(id, (select auth.uid())));

-- Members.
alter table public.dreamboard_project_members enable row level security;
create policy "See members and own invitations" on public.dreamboard_project_members
  for select to authenticated using (
    public.dreamboard_is_collaborator(project_id, (select auth.uid()))
    or member_id = (select auth.uid())
    or invited_email = (select auth.jwt() ->> 'email')
  );
create policy "Managers add members" on public.dreamboard_project_members
  for insert to authenticated with check (public.dreamboard_is_manager(project_id, (select auth.uid())));
create policy "Managers update members" on public.dreamboard_project_members
  for update to authenticated
  using (public.dreamboard_is_manager(project_id, (select auth.uid())))
  with check (public.dreamboard_is_manager(project_id, (select auth.uid())));
create policy "Managers remove members" on public.dreamboard_project_members
  for delete to authenticated using (public.dreamboard_is_manager(project_id, (select auth.uid())));
grant select, insert, update, delete on public.dreamboard_project_members to authenticated;

-- Comments.
alter table public.dreamboard_project_comments enable row level security;
create policy "Collaborators read comments" on public.dreamboard_project_comments
  for select to authenticated using (public.dreamboard_is_collaborator(project_id, (select auth.uid())));
create policy "Collaborators write comments" on public.dreamboard_project_comments
  for insert to authenticated with check (
    public.dreamboard_is_collaborator(project_id, (select auth.uid())) and author_id = (select auth.uid())
  );
create policy "Authors or managers delete comments" on public.dreamboard_project_comments
  for delete to authenticated using (
    author_id = (select auth.uid()) or public.dreamboard_is_manager(project_id, (select auth.uid()))
  );
grant select, insert, delete on public.dreamboard_project_comments to authenticated;

-- Activity.
alter table public.dreamboard_project_activity enable row level security;
create policy "Collaborators read activity" on public.dreamboard_project_activity
  for select to authenticated using (public.dreamboard_is_collaborator(project_id, (select auth.uid())));
create policy "Collaborators write activity" on public.dreamboard_project_activity
  for insert to authenticated with check (
    public.dreamboard_is_collaborator(project_id, (select auth.uid())) and actor_id = (select auth.uid())
  );
grant select, insert on public.dreamboard_project_activity to authenticated;
