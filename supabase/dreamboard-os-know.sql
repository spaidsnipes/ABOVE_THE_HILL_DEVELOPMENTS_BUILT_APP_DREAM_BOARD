-- Dream Board OS · "Know" group (Vision Vault, Knowledge Vault, Creative Graph, Universal Search) · 2026-11-12
-- Ported from ~/dreamboard/supabase/dreamboard-vision-vault.sql and dreamboard-graph-provenance.sql.
-- Knowledge Vault, graph nodes/edges, projects, writing and Book Studio tables already exist (owner RLS on).
-- Safe to re-run: create/add ... if not exists only. Never drops anything.

-- 1) Vision Vault: the creator's own emerging material (ideas, dreams, goals, sparks).
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
create index if not exists dreamboard_vision_entries_owner_updated_idx on public.dreamboard_vision_entries (owner_id, updated_at desc);
create index if not exists dreamboard_vision_entries_owner_status_idx on public.dreamboard_vision_entries (owner_id, status, updated_at desc);
alter table public.dreamboard_vision_entries enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'dreamboard_vision_entries' and policyname = 'Creators manage their own vision entries') then
    create policy "Creators manage their own vision entries" on public.dreamboard_vision_entries
      for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
  end if;
end $$;
revoke all on public.dreamboard_vision_entries from anon;
grant select, insert, update, delete on public.dreamboard_vision_entries to authenticated;

-- 2) Creative Graph edge provenance: user-made vs suggested relationships (additive columns only).
alter table public.dreamboard_graph_edges add column if not exists origin text not null default 'user'
  check (origin in ('user', 'system', 'ai_suggestion', 'import'));
alter table public.dreamboard_graph_edges add column if not exists confidence numeric check (confidence between 0 and 1);
alter table public.dreamboard_graph_edges add column if not exists evidence text;
alter table public.dreamboard_graph_edges add column if not exists confirmed_by_user boolean not null default true;
create index if not exists dreamboard_graph_edges_owner_origin_idx on public.dreamboard_graph_edges (owner_id, origin, confirmed_by_user);

notify pgrst, 'reload schema';
