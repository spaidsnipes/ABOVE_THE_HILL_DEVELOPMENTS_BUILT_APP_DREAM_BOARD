-- Project isolation: each project carries its own AI instructions and writing
-- voice. Material is scoped via the existing project_id columns on
-- dreamboard_vision_entries, dreamboard_vault_entries, dreamboard_chapters,
-- and dreamboard_writing_documents. Run after dreamboard-project-model.sql.
alter table public.dreamboard_projects
  add column if not exists ai_instructions text not null default '';
alter table public.dreamboard_projects
  add column if not exists writing_voice text not null default '';
