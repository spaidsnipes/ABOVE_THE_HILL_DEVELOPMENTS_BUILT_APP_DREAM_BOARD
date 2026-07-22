-- Book Architect: real multi-chapter structure for book-like projects.
-- Run after dreamboard-core-schema.sql (and project-model).

create table if not exists public.dreamboard_chapters (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.dreamboard_projects(id) on delete set null,
  part text not null default '',
  title text not null check (char_length(title) between 1 and 200),
  purpose text not null default '',
  notes text not null default '',
  status text not null default 'outline' check (status in ('outline', 'drafting', 'revising', 'complete')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dreamboard_chapters_owner_order_idx
  on public.dreamboard_chapters (owner_id, sort_order asc);
alter table public.dreamboard_chapters enable row level security;
create policy "Creators manage their own chapters" on public.dreamboard_chapters
  for all to authenticated using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
grant select, insert, update, delete on public.dreamboard_chapters to authenticated;
