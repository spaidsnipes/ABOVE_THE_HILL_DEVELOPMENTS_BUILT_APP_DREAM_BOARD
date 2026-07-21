-- Dreamboard import foundation: private source files plus resumable batch ledger.
-- Raw files stay in the private dreamboard-private bucket under <user-id>/<batch-id>/.

create table if not exists public.dreamboard_import_batches (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  source text not null default 'device' check (source in ('device', 'google-drive', 'dropbox', 'manual')),
  label text not null default 'Untitled import' check (char_length(label) between 1 and 180),
  status text not null default 'uploading' check (status in ('uploading', 'partial', 'uploaded', 'processing', 'ready', 'failed')),
  file_count integer not null default 0 check (file_count >= 0),
  uploaded_count integer not null default 0 check (uploaded_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  total_bytes bigint not null default 0 check (total_bytes >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dreamboard_import_batches_owner_created_idx
  on public.dreamboard_import_batches (owner_id, created_at desc);
alter table public.dreamboard_import_batches enable row level security;
create policy "Creators manage their own import batches" on public.dreamboard_import_batches
  for all to authenticated using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
grant select, insert, update, delete on public.dreamboard_import_batches to authenticated;

create table if not exists public.dreamboard_source_documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  batch_id uuid not null references public.dreamboard_import_batches(id) on delete cascade,
  file_name text not null check (char_length(file_name) between 1 and 512),
  mime_type text not null default 'application/octet-stream',
  storage_path text not null unique,
  byte_size bigint not null check (byte_size >= 0),
  source text not null default 'device' check (source in ('device', 'google-drive', 'dropbox', 'manual')),
  processing_status text not null default 'uploaded' check (processing_status in ('uploaded', 'queued', 'extracting', 'indexed', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dreamboard_source_documents_owner_created_idx
  on public.dreamboard_source_documents (owner_id, created_at desc);
create index if not exists dreamboard_source_documents_batch_idx
  on public.dreamboard_source_documents (batch_id, created_at asc);
alter table public.dreamboard_source_documents enable row level security;
create policy "Creators manage their own source documents" on public.dreamboard_source_documents
  for all to authenticated using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
grant select, insert, update, delete on public.dreamboard_source_documents to authenticated;
