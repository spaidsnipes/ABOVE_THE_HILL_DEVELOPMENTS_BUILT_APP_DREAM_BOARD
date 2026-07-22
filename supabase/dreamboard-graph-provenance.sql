-- Creative Graph edge provenance: distinguish user-confirmed relationships
-- from system/import/AI-suggested ones. Run after dreamboard-creator-workspace.sql.

alter table public.dreamboard_graph_edges
  add column if not exists origin text not null default 'user'
    check (origin in ('user', 'system', 'ai_suggestion', 'import'));
alter table public.dreamboard_graph_edges
  add column if not exists confidence numeric check (confidence between 0 and 1);
alter table public.dreamboard_graph_edges
  add column if not exists evidence text;
alter table public.dreamboard_graph_edges
  add column if not exists confirmed_by_user boolean not null default true;

create index if not exists dreamboard_graph_edges_owner_origin_idx
  on public.dreamboard_graph_edges (owner_id, origin, confirmed_by_user);
