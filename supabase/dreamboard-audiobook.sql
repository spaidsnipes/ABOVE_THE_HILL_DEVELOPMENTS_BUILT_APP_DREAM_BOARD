-- Audiobook foundation: persisted narration records in private storage.
-- Run after dreamboard-book-architect.sql.

create table if not exists public.dreamboard_audio_narrations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  chapter_id uuid references public.dreamboard_chapters(id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  storage_path text not null,
  mime_type text not null default 'audio/mpeg',
  byte_size bigint not null default 0,
  pronunciation_notes text not null default '',
  source text not null default 'uploaded' check (source in ('uploaded', 'generated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dreamboard_audio_narrations_owner_idx
  on public.dreamboard_audio_narrations (owner_id, created_at desc);
alter table public.dreamboard_audio_narrations enable row level security;
create policy "Creators manage their own narrations" on public.dreamboard_audio_narrations
  for all to authenticated using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
grant select, insert, update, delete on public.dreamboard_audio_narrations to authenticated;
