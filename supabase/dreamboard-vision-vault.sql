-- Dreamboard Vision Vault: the creator's own emerging material (ideas, dreams,
-- goals, sparks, private plans) — distinct from the Knowledge Vault, which
-- holds external and reference material (dreamboard_vault_entries).
-- Run after dreamboard-core-schema.sql. Private to each signed-in creator.

create table if not exists public.dreamboard_vision_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.dreamboard_projects(id) on delete set null,
  title text not null check (char_length(title) between 1 and 240),
  content text not null default '',
  capture_type text not null default 'text' check (capture_type in ('text', 'voice', 'image', 'file', 'link', 'sketch', 'quick_capture')),
  status text not null default 'inbox' check (status in ('inbox', 'developing', 'incubating', 'ready_for_project', 'archived')),
  privacy text not null default 'private' check (privacy in ('private')),
  source_type text not null default 'manual' check (source_type in ('manual', 'quick_capture', 'voice', 'import', 'migration')),
  original_source text,
  tags text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists dreamboard_vision_entries_owner_updated_idx
  on public.dreamboard_vision_entries (owner_id, updated_at desc);
create index if not exists dreamboard_vision_entries_owner_status_idx
  on public.dreamboard_vision_entries (owner_id, status, updated_at desc);
alter table public.dreamboard_vision_entries enable row level security;
create policy "Creators manage their own vision entries" on public.dreamboard_vision_entries
  for all to authenticated using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
grant select, insert, update, delete on public.dreamboard_vision_entries to authenticated;
