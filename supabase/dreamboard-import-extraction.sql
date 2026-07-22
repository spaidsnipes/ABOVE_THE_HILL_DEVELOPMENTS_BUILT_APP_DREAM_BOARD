-- Import text extraction: understand the contents of preserved originals.
-- Run after dreamboard-import-foundation.sql and dreamboard-creator-workspace.sql.

alter table public.dreamboard_source_documents
  add column if not exists extraction_status text not null default 'uploaded'
    check (extraction_status in ('uploaded', 'queued', 'processing', 'processed', 'partially_processed', 'failed', 'unsupported'));
alter table public.dreamboard_source_documents
  add column if not exists extracted_text text;
alter table public.dreamboard_source_documents
  add column if not exists extracted_chars integer;
alter table public.dreamboard_source_documents
  add column if not exists extraction_error text;
alter table public.dreamboard_source_documents
  add column if not exists extracted_at timestamptz;

create index if not exists dreamboard_source_documents_batch_status_idx
  on public.dreamboard_source_documents (batch_id, extraction_status);

-- Citation anchor: a processed source becomes exactly one Knowledge Vault entry.
alter table public.dreamboard_vault_entries
  add column if not exists source_document_id uuid references public.dreamboard_source_documents(id) on delete set null;
create unique index if not exists dreamboard_vault_entries_source_document_idx
  on public.dreamboard_vault_entries (owner_id, source_document_id)
  where source_document_id is not null;
