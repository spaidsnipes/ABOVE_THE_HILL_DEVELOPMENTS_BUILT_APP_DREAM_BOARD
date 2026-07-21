-- Dreamboard creator workspace: private vault, graph, companion history, and cloud writing.
-- Every table is private to its signed-in creator. No service or secret keys are used in the browser.

create table if not exists public.dreamboard_vault_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.dreamboard_projects(id) on delete set null,
  title text not null check (char_length(title) between 1 and 240),
  content text not null default '',
  source_type text not null default 'manual' check (source_type in ('manual', 'import', 'voice', 'google-drive', 'research', 'journal')),
  status text not null default 'inbox' check (status in ('inbox', 'organized', 'archived')),
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dreamboard_vault_entries_owner_updated_idx
  on public.dreamboard_vault_entries (owner_id, updated_at desc);
create index if not exists dreamboard_vault_entries_owner_status_idx
  on public.dreamboard_vault_entries (owner_id, status, created_at desc);
alter table public.dreamboard_vault_entries enable row level security;
create policy "Creators manage their own vault entries" on public.dreamboard_vault_entries
  for all to authenticated using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
grant select, insert, update, delete on public.dreamboard_vault_entries to authenticated;

create table if not exists public.dreamboard_graph_nodes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.dreamboard_projects(id) on delete set null,
  vault_entry_id uuid references public.dreamboard_vault_entries(id) on delete set null,
  node_type text not null check (node_type in ('source', 'theme', 'project', 'chapter', 'insight', 'person', 'place', 'question')),
  label text not null check (char_length(label) between 1 and 160),
  description text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dreamboard_graph_nodes_owner_type_idx
  on public.dreamboard_graph_nodes (owner_id, node_type, updated_at desc);
create unique index if not exists dreamboard_graph_nodes_one_source_per_entry
  on public.dreamboard_graph_nodes (owner_id, vault_entry_id)
  where vault_entry_id is not null;
alter table public.dreamboard_graph_nodes enable row level security;
create policy "Creators manage their own graph nodes" on public.dreamboard_graph_nodes
  for all to authenticated using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
grant select, insert, update, delete on public.dreamboard_graph_nodes to authenticated;

create table if not exists public.dreamboard_graph_edges (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  from_node_id uuid not null references public.dreamboard_graph_nodes(id) on delete cascade,
  to_node_id uuid not null references public.dreamboard_graph_nodes(id) on delete cascade,
  relationship text not null default 'supports' check (relationship in ('supports', 'belongs_to', 'inspires', 'contradicts', 'follows', 'references')),
  created_at timestamptz not null default now(),
  check (from_node_id <> to_node_id),
  unique (owner_id, from_node_id, to_node_id, relationship)
);

create index if not exists dreamboard_graph_edges_owner_created_idx
  on public.dreamboard_graph_edges (owner_id, created_at desc);
alter table public.dreamboard_graph_edges enable row level security;
create policy "Creators manage their own graph edges" on public.dreamboard_graph_edges
  for all to authenticated using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
grant select, insert, update, delete on public.dreamboard_graph_edges to authenticated;

create table if not exists public.dreamboard_companion_runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.dreamboard_projects(id) on delete set null,
  prompt text not null check (char_length(prompt) between 1 and 12000),
  selected_skills text[] not null default '{}',
  selected_persona text not null default 'The Humble Guide',
  wisdom_enabled boolean not null default false,
  output jsonb not null default '{}'::jsonb,
  provider text not null default 'local-framework',
  model text,
  status text not null default 'complete' check (status in ('draft', 'complete', 'needs-model', 'failed')),
  created_at timestamptz not null default now()
);

create index if not exists dreamboard_companion_runs_owner_created_idx
  on public.dreamboard_companion_runs (owner_id, created_at desc);
alter table public.dreamboard_companion_runs enable row level security;
create policy "Creators manage their own companion runs" on public.dreamboard_companion_runs
  for all to authenticated using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
grant select, insert, update, delete on public.dreamboard_companion_runs to authenticated;

create table if not exists public.dreamboard_writing_documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.dreamboard_projects(id) on delete set null,
  title text not null check (char_length(title) between 1 and 240),
  chapter_number smallint not null default 1 check (chapter_number between 1 and 999),
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dreamboard_writing_documents_owner_updated_idx
  on public.dreamboard_writing_documents (owner_id, updated_at desc);
alter table public.dreamboard_writing_documents enable row level security;
create policy "Creators manage their own writing documents" on public.dreamboard_writing_documents
  for all to authenticated using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
grant select, insert, update, delete on public.dreamboard_writing_documents to authenticated;

create table if not exists public.dreamboard_document_versions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid not null references public.dreamboard_writing_documents(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 240),
  body text not null,
  word_count integer not null default 0 check (word_count >= 0),
  created_at timestamptz not null default now()
);

create index if not exists dreamboard_document_versions_owner_created_idx
  on public.dreamboard_document_versions (owner_id, created_at desc);
alter table public.dreamboard_document_versions enable row level security;
create policy "Creators manage their own writing versions" on public.dreamboard_document_versions
  for all to authenticated using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
grant select, insert, update, delete on public.dreamboard_document_versions to authenticated;
