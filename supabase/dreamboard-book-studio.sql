-- Dream Board · Book Studio (2026-11-12)
-- Organize decades of writing into a book. Every row is private to its owner (RLS owner_id = auth.uid()).
-- Local-first client: rows are created with client-side UUIDs in IndexedDB, then upserted here.
-- Tier rule (database-enforced): basic Passport saves 1 book; premium / partner / Founder unlimited.

create table if not exists public.dreamboard_books (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null default 'Untitled book' check (char_length(title) <= 200),
  subtitle text not null default '' check (char_length(subtitle) <= 300),
  settings jsonb not null default '{}'::jsonb,
  words integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.dreamboard_book_sources (
  id uuid primary key,
  book_id uuid not null references public.dreamboard_books(id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null default '' check (char_length(name) <= 500),
  kind text not null default 'text' check (char_length(kind) <= 40),
  words integer not null default 0,
  passages integer not null default 0,
  imported_at timestamptz not null default now(),
  meta jsonb not null default '{}'::jsonb
);
create table if not exists public.dreamboard_book_chapters (
  id uuid primary key,
  book_id uuid not null references public.dreamboard_books(id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null default '' check (char_length(title) <= 300),
  part text not null default '' check (char_length(part) <= 200),
  position real not null default 0,
  summary text not null default '' check (char_length(summary) <= 4000),
  keywords jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.dreamboard_book_passages (
  id uuid primary key,
  book_id uuid not null references public.dreamboard_books(id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  source_id uuid references public.dreamboard_book_sources(id) on delete set null,
  seq integer not null default 0,
  body text not null check (char_length(body) <= 40000),
  words integer not null default 0,
  written_at timestamptz,
  speaker text not null default 'author' check (speaker in ('author','ai','other')),
  theme integer,
  chapter_id uuid references public.dreamboard_book_chapters(id) on delete set null,
  position real,
  suggested_chapter_id uuid references public.dreamboard_book_chapters(id) on delete set null,
  dup_of uuid,
  dup_kept boolean not null default false,
  seed text check (char_length(seed) <= 2000),
  starred boolean not null default false,
  original text check (char_length(original) <= 40000),
  updated_at timestamptz not null default now()
);
create table if not exists public.dreamboard_book_notes (
  id uuid primary key,
  book_id uuid not null references public.dreamboard_books(id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  chapter_id uuid references public.dreamboard_book_chapters(id) on delete set null,
  passage_id uuid references public.dreamboard_book_passages(id) on delete set null,
  kind text not null default 'research' check (kind in ('research','question','idea','verify')),
  body text not null check (char_length(body) <= 8000),
  url text check (char_length(url) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.dreamboard_book_revisions (
  id uuid primary key,
  book_id uuid not null references public.dreamboard_books(id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  label text not null default '' check (char_length(label) <= 300),
  words integer not null default 0,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists dreamboard_books_owner on public.dreamboard_books(owner_id);
create index if not exists dreamboard_book_passages_book on public.dreamboard_book_passages(book_id, seq);
create index if not exists dreamboard_book_passages_owner on public.dreamboard_book_passages(owner_id);
create index if not exists dreamboard_book_passages_chapter on public.dreamboard_book_passages(chapter_id);
create index if not exists dreamboard_book_passages_suggested on public.dreamboard_book_passages(suggested_chapter_id);
create index if not exists dreamboard_book_passages_source on public.dreamboard_book_passages(source_id);
create index if not exists dreamboard_book_sources_book on public.dreamboard_book_sources(book_id);
create index if not exists dreamboard_book_chapters_book on public.dreamboard_book_chapters(book_id);
create index if not exists dreamboard_book_notes_book on public.dreamboard_book_notes(book_id);
create index if not exists dreamboard_book_notes_chapter on public.dreamboard_book_notes(chapter_id);
create index if not exists dreamboard_book_notes_passage on public.dreamboard_book_notes(passage_id);
create index if not exists dreamboard_book_revisions_book on public.dreamboard_book_revisions(book_id, created_at desc);

do $$
declare t text;
begin
  foreach t in array array['dreamboard_books','dreamboard_book_sources','dreamboard_book_chapters','dreamboard_book_passages','dreamboard_book_notes','dreamboard_book_revisions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_owner_all', t);
    execute format('create policy %I on public.%I for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))', t || '_owner_all', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- A child row must belong to a book with the same owner (no writing into someone else's book by id).
create or replace function public.dreamboard_book_parent_check()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (select 1 from public.dreamboard_books b where b.id = new.book_id and b.owner_id = new.owner_id) then
    raise exception 'book not found for this Passport' using errcode = '42501';
  end if;
  return new;
end $$;
do $$
declare t text;
begin
  foreach t in array array['dreamboard_book_sources','dreamboard_book_chapters','dreamboard_book_passages','dreamboard_book_notes','dreamboard_book_revisions'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_parent', t);
    execute format('create trigger %I before insert or update of book_id, owner_id on public.%I for each row execute function public.dreamboard_book_parent_check()', t || '_parent', t);
  end loop;
end $$;

-- Tier: basic Passport = 1 book saved to the Passport (local books on the device are unlimited).
create or replace function public.dreamboard_book_limit_check()
returns trigger language plpgsql security definer set search_path = '' as $$
declare acc jsonb; n int;
begin
  if new.owner_id is distinct from auth.uid() then raise exception 'owner mismatch' using errcode = '42501'; end if;
  -- an upsert of a book that already exists is an update, not a new book
  if exists (select 1 from public.dreamboard_books where id = new.id and owner_id = new.owner_id) then return new; end if;
  acc := public.dreamboard_my_access();
  if acc->>'tier' = 'basic' then
    select count(*) into n from public.dreamboard_books where owner_id = new.owner_id;
    if n >= 1 then
      raise exception 'DREAMBOARD_BOOK_LIMIT: your Passport tier saves 1 book to your Passport; this one stays on this device. Premium, partner and Founder Passports save unlimited books.'
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists dreamboard_books_limit on public.dreamboard_books;
create trigger dreamboard_books_limit before insert on public.dreamboard_books
  for each row execute function public.dreamboard_book_limit_check();
revoke all on function public.dreamboard_book_limit_check() from public, anon;
