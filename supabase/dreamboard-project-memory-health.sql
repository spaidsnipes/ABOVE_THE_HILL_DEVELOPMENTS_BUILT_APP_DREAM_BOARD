-- Inspectable project memory and Creative Health preferences.
-- Run after dreamboard-core-schema.sql and dreamboard-project-model.sql.
-- All records remain private to the Passport owner. Sensitive memory cannot be
-- inserted without an explicit consent timestamp.

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

create index if not exists dreamboard_project_memory_owner_project_updated_idx
  on public.dreamboard_project_memory (owner_id, project_id, updated_at desc);
alter table public.dreamboard_project_memory enable row level security;
create policy "Creators manage their own project memory" on public.dreamboard_project_memory
  for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
grant select, insert, update, delete on public.dreamboard_project_memory to authenticated;

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
create policy "Creators manage their own Creative Health preferences" on public.dreamboard_creative_health_preferences
  for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
grant select, insert, update, delete on public.dreamboard_creative_health_preferences to authenticated;
