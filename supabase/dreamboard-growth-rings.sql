-- Growth Rings: creator-entered, private growth records. This is intentionally
-- not a streak or score table, and it does not infer spiritual or personal status.

create table if not exists public.dreamboard_growth_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  occurred_on date not null default current_date,
  category text not null check (category in ('spiritual', 'physical', 'mental', 'financial', 'creative', 'relationships', 'work')),
  practice text not null check (char_length(trim(practice)) between 1 and 80),
  reflection text check (reflection is null or char_length(trim(reflection)) <= 2000),
  created_at timestamptz not null default now(),
  unique (owner_id, occurred_on, category, practice)
);

create index if not exists dreamboard_growth_entries_owner_date_idx
  on public.dreamboard_growth_entries (owner_id, occurred_on desc);

alter table public.dreamboard_growth_entries enable row level security;

create policy "Creators manage their own Growth Rings" on public.dreamboard_growth_entries
  for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

grant select, insert, update, delete on public.dreamboard_growth_entries to authenticated;
