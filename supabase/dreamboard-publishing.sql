-- Publishing foundation: versioned export history.
-- Run after dreamboard-core-schema.sql.

create table if not exists public.dreamboard_exports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.dreamboard_projects(id) on delete set null,
  format text not null check (format in ('markdown', 'epub')),
  title text not null default '',
  word_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists dreamboard_exports_owner_idx
  on public.dreamboard_exports (owner_id, created_at desc);
alter table public.dreamboard_exports enable row level security;
create policy "Creators manage their own exports" on public.dreamboard_exports
  for all to authenticated using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
grant select, insert, delete on public.dreamboard_exports to authenticated;
