-- Voice Guardian references are private project-scoped excerpts supplied by
-- the creator. This is not a voice-cloning or training table.
create table if not exists public.dreamboard_voice_references (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.dreamboard_projects(id) on delete cascade,
  label text not null check (char_length(trim(label)) between 2 and 240),
  excerpt text not null check (char_length(trim(excerpt)) between 20 and 5000),
  consented_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists dreamboard_voice_references_owner_project_created_idx
  on public.dreamboard_voice_references (owner_id, project_id, created_at desc);
alter table public.dreamboard_voice_references enable row level security;
create policy "Creators manage their own Voice Guardian references" on public.dreamboard_voice_references
  for all to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = owner_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = owner_id);
grant select, insert, update, delete on public.dreamboard_voice_references to authenticated;
