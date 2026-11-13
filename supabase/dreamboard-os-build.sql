-- Dream Board OS · "Build" group (Projects, Constellation, Writing Studio, Voice Guardian) · 2026-11-12
-- Ported from ~/dreamboard/supabase/dreamboard-project-model.sql, -project-types.sql, -project-isolation.sql,
-- -project-memory-health.sql, -constellation.sql and -voice-guardian.sql.
-- dreamboard_projects, dreamboard_writing_documents and dreamboard_document_versions already exist (owner RLS on);
-- this file never alters them. The extra project columns live in a side table (dreamboard_project_settings).
-- Safe to re-run: create ... if not exists only. Never drops anything.

-- 1) Project settings: lifecycle, purpose, definition of done, custom type, per-project AI instructions + writing voice.
create table if not exists public.dreamboard_project_settings (
  project_id uuid primary key references public.dreamboard_projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  description text not null default '' check (char_length(description) <= 4000),
  status text not null default 'idea'
    check (status in ('idea', 'incubating', 'planning', 'active', 'paused', 'blocked', 'review', 'ready_to_publish', 'published', 'completed', 'archived')),
  mission text not null default '' check (char_length(mission) <= 4000),
  intended_outcome text not null default '' check (char_length(intended_outcome) <= 4000),
  completion_definition text not null default '' check (char_length(completion_definition) <= 4000),
  custom_type_label text check (char_length(custom_type_label) <= 60),
  ai_instructions text not null default '' check (char_length(ai_instructions) <= 4000),
  writing_voice text not null default '' check (char_length(writing_voice) <= 4000),
  privacy text not null default 'private' check (privacy in ('private')),
  -- next_action, remaining_work[], blockers[], deferred_ideas[], version_target, book_id (a Book Studio book the creator linked)
  metadata jsonb not null default '{}'::jsonb,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists dreamboard_project_settings_owner_idx on public.dreamboard_project_settings (owner_id, status, updated_at desc);
alter table public.dreamboard_project_settings enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'dreamboard_project_settings' and policyname = 'Creators manage their own project settings') then
    create policy "Creators manage their own project settings" on public.dreamboard_project_settings
      for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
  end if;
end $$;
revoke all on public.dreamboard_project_settings from anon;
grant select, insert, update, delete on public.dreamboard_project_settings to authenticated;

-- A settings row may only point at a project owned by the same Passport.
create or replace function public.dreamboard_project_child_check() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.project_id is not null and not exists (select 1 from public.dreamboard_projects p where p.id = new.project_id and p.owner_id = new.owner_id) then
    raise exception 'project not found for this Passport' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists dreamboard_project_settings_parent on public.dreamboard_project_settings;
create trigger dreamboard_project_settings_parent before insert or update on public.dreamboard_project_settings
  for each row execute function public.dreamboard_project_child_check();

-- 2) Active context: which projects are "in focus" (max 7) and the primary one. One row per Passport.
create table if not exists public.dreamboard_active_context (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  project_ids uuid[] not null default '{}' check (coalesce(array_length(project_ids, 1), 0) <= 7),
  primary_id uuid references public.dreamboard_projects(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.dreamboard_active_context enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'dreamboard_active_context' and policyname = 'Creators manage their own active context') then
    create policy "Creators manage their own active context" on public.dreamboard_active_context
      for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
  end if;
end $$;
revoke all on public.dreamboard_active_context from anon;
grant select, insert, update, delete on public.dreamboard_active_context to authenticated;

-- 3) Inspectable project memory (newest original: dreamboard-project-memory-health.sql).
create table if not exists public.dreamboard_project_memory (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.dreamboard_projects(id) on delete cascade,
  scope text not null check (scope in ('conversation', 'workspace_item', 'project', 'active_context', 'creator')),
  workspace_item_id text,
  category text not null check (category in ('purpose', 'preference', 'voice', 'person', 'place', 'canon_fact', 'research_conclusion', 'unresolved_question', 'sensitive_exclusion', 'ai_preference', 'collaboration_rule')),
  content text not null check (char_length(trim(content)) between 1 and 4000),
  source_label text not null check (char_length(trim(source_label)) between 1 and 240),
  source_type text not null check (source_type in ('creator', 'import', 'companion', 'workspace')),
  inferred boolean not null default false,
  sensitive boolean not null default false,
  sensitive_consent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((sensitive = false and sensitive_consent_at is null) or (sensitive = true and sensitive_consent_at is not null)),
  check ((scope = 'creator' and project_id is null) or (scope <> 'creator' and project_id is not null))
);
create index if not exists dreamboard_project_memory_owner_project_updated_idx on public.dreamboard_project_memory (owner_id, project_id, updated_at desc);
alter table public.dreamboard_project_memory enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'dreamboard_project_memory' and policyname = 'Creators manage their own project memory') then
    create policy "Creators manage their own project memory" on public.dreamboard_project_memory
      for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
  end if;
end $$;
revoke all on public.dreamboard_project_memory from anon;
grant select, insert, update, delete on public.dreamboard_project_memory to authenticated;
drop trigger if exists dreamboard_project_memory_parent on public.dreamboard_project_memory;
create trigger dreamboard_project_memory_parent before insert or update on public.dreamboard_project_memory
  for each row execute function public.dreamboard_project_child_check();

-- 4) Creative Health preferences (per project; can be turned off; dismissed observations stay dismissed).
create table if not exists public.dreamboard_creative_health_preferences (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.dreamboard_projects(id) on delete cascade,
  enabled boolean not null default true,
  dismissed_signal_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, project_id)
);
alter table public.dreamboard_creative_health_preferences enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'dreamboard_creative_health_preferences' and policyname = 'Creators manage their own Creative Health preferences') then
    create policy "Creators manage their own Creative Health preferences" on public.dreamboard_creative_health_preferences
      for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
  end if;
end $$;
revoke all on public.dreamboard_creative_health_preferences from anon;
grant select, insert, update, delete on public.dreamboard_creative_health_preferences to authenticated;
drop trigger if exists dreamboard_creative_health_preferences_parent on public.dreamboard_creative_health_preferences;
create trigger dreamboard_creative_health_preferences_parent before insert or update on public.dreamboard_creative_health_preferences
  for each row execute function public.dreamboard_project_child_check();

-- 5) Constellation: manual, creator-drawn relationships between whole projects. Nothing is invented.
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
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'dreamboard_project_links' and policyname = 'Creators manage their own project links') then
    create policy "Creators manage their own project links" on public.dreamboard_project_links
      for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
  end if;
end $$;
revoke all on public.dreamboard_project_links from anon;
grant select, insert, delete on public.dreamboard_project_links to authenticated;
create or replace function public.dreamboard_project_link_check() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.dreamboard_projects p where p.id = new.from_project_id and p.owner_id = new.owner_id)
     or not exists (select 1 from public.dreamboard_projects p where p.id = new.to_project_id and p.owner_id = new.owner_id) then
    raise exception 'project not found for this Passport' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists dreamboard_project_links_parent on public.dreamboard_project_links;
create trigger dreamboard_project_links_parent before insert or update on public.dreamboard_project_links
  for each row execute function public.dreamboard_project_link_check();

-- 6) Voice Guardian: the writer's own excerpts. Not a voice-cloning or training table.
-- project_id is optional here (null = a sample for all of this Passport's writing); the original required one.
create table if not exists public.dreamboard_voice_references (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.dreamboard_projects(id) on delete cascade,
  label text not null check (char_length(trim(label)) between 2 and 240),
  excerpt text not null check (char_length(trim(excerpt)) between 20 and 5000),
  consented_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists dreamboard_voice_references_owner_project_created_idx on public.dreamboard_voice_references (owner_id, project_id, created_at desc);
alter table public.dreamboard_voice_references enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'dreamboard_voice_references' and policyname = 'Creators manage their own Voice Guardian references') then
    create policy "Creators manage their own Voice Guardian references" on public.dreamboard_voice_references
      for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
  end if;
end $$;
revoke all on public.dreamboard_voice_references from anon;
grant select, insert, update, delete on public.dreamboard_voice_references to authenticated;
drop trigger if exists dreamboard_voice_references_parent on public.dreamboard_voice_references;
create trigger dreamboard_voice_references_parent before insert or update on public.dreamboard_voice_references
  for each row execute function public.dreamboard_project_child_check();
