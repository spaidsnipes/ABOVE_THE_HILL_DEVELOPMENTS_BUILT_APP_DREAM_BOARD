-- Real project model: lifecycle, purpose, and completion definition.
-- Run after dreamboard-core-schema.sql. Existing rows keep working: new
-- columns default sensibly and legacy stage/progress remain untouched.

alter table public.dreamboard_projects
  add column if not exists description text not null default '';
alter table public.dreamboard_projects
  add column if not exists status text not null default 'active'
    check (status in ('idea', 'incubating', 'planning', 'active', 'paused', 'blocked', 'review', 'ready_to_publish', 'published', 'completed', 'archived'));
alter table public.dreamboard_projects
  add column if not exists mission text not null default '';
alter table public.dreamboard_projects
  add column if not exists intended_outcome text not null default '';
alter table public.dreamboard_projects
  add column if not exists completion_definition text not null default '';
alter table public.dreamboard_projects
  add column if not exists privacy text not null default 'private' check (privacy in ('private'));
alter table public.dreamboard_projects
  add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.dreamboard_projects
  add column if not exists archived_at timestamptz;

create index if not exists dreamboard_projects_owner_status_idx
  on public.dreamboard_projects (owner_id, status, updated_at desc);
