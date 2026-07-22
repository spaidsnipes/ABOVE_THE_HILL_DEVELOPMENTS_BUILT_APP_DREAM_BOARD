-- Passport foundation: deeper creator identity on dreamboard_profiles.
-- Run after dreamboard-core-schema.sql.

alter table public.dreamboard_profiles
  add column if not exists bio text not null default '' check (char_length(bio) <= 2000);
alter table public.dreamboard_profiles
  add column if not exists disciplines text[] not null default '{}';
alter table public.dreamboard_profiles
  add column if not exists avatar_url text;
