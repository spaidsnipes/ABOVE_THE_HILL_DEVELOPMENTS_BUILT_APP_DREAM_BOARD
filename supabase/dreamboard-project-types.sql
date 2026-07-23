-- Universal project templates: a custom type label alongside the type slug in
-- dreamboard_projects.kind (built-in types are resolved in code via
-- lib/project-types.ts). Run after dreamboard-project-model.sql.
alter table public.dreamboard_projects
  add column if not exists custom_type_label text;
