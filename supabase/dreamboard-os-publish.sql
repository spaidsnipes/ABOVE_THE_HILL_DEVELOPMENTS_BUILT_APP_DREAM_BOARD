-- Dream Board OS · Publish group (Reader, Audiobook Studio, Publishing) — 2026-11-12.
-- Ported from ~/dreamboard/supabase/dreamboard-audiobook.sql and dreamboard-publishing.sql.
-- Differences from the originals: chapters link to Book Studio (dreamboard_book_chapters / dreamboard_books)
-- instead of the old dreamboard_chapters / dreamboard_projects; narrations may be 'recorded' in the browser;
-- exports record a book_id and chapter count. Owner-only RLS, anon revoked, create-if-not-exists only.
-- Audio files live in the PRIVATE bucket dreamboard-private under <uid>/audiobook/... (existing storage policies
-- already restrict that bucket to the folder named by the caller's uid).

create table if not exists public.dreamboard_audio_narrations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid references public.dreamboard_books(id) on delete set null,
  chapter_id uuid references public.dreamboard_book_chapters(id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  storage_path text not null check (char_length(storage_path) between 1 and 600),
  mime_type text not null default 'audio/mpeg' check (char_length(mime_type) <= 120),
  byte_size bigint not null default 0 check (byte_size >= 0),
  duration_seconds real check (duration_seconds is null or duration_seconds >= 0),
  pronunciation_notes text not null default '' check (char_length(pronunciation_notes) <= 4000),
  source text not null default 'uploaded' check (source in ('uploaded', 'recorded', 'generated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists dreamboard_audio_narrations_owner_idx on public.dreamboard_audio_narrations (owner_id, created_at desc);
create index if not exists dreamboard_audio_narrations_chapter_idx on public.dreamboard_audio_narrations (chapter_id);
alter table public.dreamboard_audio_narrations enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'dreamboard_audio_narrations' and policyname = 'Creators manage their own narrations') then
    create policy "Creators manage their own narrations" on public.dreamboard_audio_narrations
      for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
  end if;
end $$;
revoke all on public.dreamboard_audio_narrations from anon;
grant select, insert, update, delete on public.dreamboard_audio_narrations to authenticated;

create table if not exists public.dreamboard_exports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid references public.dreamboard_books(id) on delete set null,
  format text not null check (format in ('markdown', 'epub', 'docx')),
  title text not null default '' check (char_length(title) <= 300),
  word_count integer not null default 0 check (word_count >= 0),
  chapter_count integer not null default 0 check (chapter_count >= 0),
  created_at timestamptz not null default now()
);
create index if not exists dreamboard_exports_owner_idx on public.dreamboard_exports (owner_id, created_at desc);
alter table public.dreamboard_exports enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'dreamboard_exports' and policyname = 'Creators manage their own exports') then
    create policy "Creators manage their own exports" on public.dreamboard_exports
      for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
  end if;
end $$;
revoke all on public.dreamboard_exports from anon;
grant select, insert, delete on public.dreamboard_exports to authenticated;
