-- Correction Ledger (permanent, append-only) and Equation Lab. Project-scoped.
-- Run after dreamboard-project-model.sql and dreamboard-research-workspace.sql.

create table if not exists public.dreamboard_corrections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.dreamboard_projects(id) on delete cascade,
  original_statement text not null check (char_length(original_statement) between 1 and 2000),
  issue text not null default '',
  revised_statement text not null default '',
  reason text not null default '',
  evidence text not null default '',
  affected_locations text not null default '',
  author_label text not null default '',
  visibility text not null default 'private' check (visibility in ('private', 'published')),
  created_at timestamptz not null default now()
);
create index if not exists dreamboard_corrections_owner_project_idx
  on public.dreamboard_corrections (owner_id, project_id, created_at desc);
alter table public.dreamboard_corrections enable row level security;
-- Append-only ledger: insert + read own; visibility is the only mutable field.
create policy "Creators read their own corrections" on public.dreamboard_corrections
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "Creators file their own corrections" on public.dreamboard_corrections
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "Creators set correction visibility" on public.dreamboard_corrections
  for update to authenticated using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
grant select, insert, update on public.dreamboard_corrections to authenticated;

create table if not exists public.dreamboard_equations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.dreamboard_projects(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  expression text not null default '',
  variables text not null default '',
  units text not null default '',
  assumptions text not null default '',
  limitations text not null default '',
  validation_status text not null default 'unvalidated' check (validation_status in ('unvalidated', 'dimensions_checked', 'reviewed', 'empirically_tested', 'rejected')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists dreamboard_equations_owner_project_idx
  on public.dreamboard_equations (owner_id, project_id, updated_at desc);
alter table public.dreamboard_equations enable row level security;
create policy "Creators manage their own equations" on public.dreamboard_equations
  for all to authenticated using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
grant select, insert, update, delete on public.dreamboard_equations to authenticated;
