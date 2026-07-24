-- Constellation: manual, user-confirmed relationships between whole projects.
-- No relationship is ever invented — the creator draws these. Run after
-- dreamboard-project-model.sql.
create table if not exists public.dreamboard_project_links (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  from_project_id uuid not null references public.dreamboard_projects(id) on delete cascade,
  to_project_id uuid not null references public.dreamboard_projects(id) on delete cascade,
  relationship text not null default 'related' check (relationship in ('related', 'inspires', 'depends_on', 'part_of', 'contrasts')),
  created_at timestamptz not null default now(),
  check (from_project_id <> to_project_id),
  unique (owner_id, from_project_id, to_project_id, relationship)
);
create index if not exists dreamboard_project_links_owner_idx on public.dreamboard_project_links (owner_id);
alter table public.dreamboard_project_links enable row level security;
create policy "Creators manage their own project links" on public.dreamboard_project_links
  for all to authenticated using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
grant select, insert, delete on public.dreamboard_project_links to authenticated;
