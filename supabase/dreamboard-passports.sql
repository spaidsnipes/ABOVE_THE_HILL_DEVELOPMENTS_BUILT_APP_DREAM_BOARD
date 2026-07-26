-- Dreamboard Passport identity foundation.
-- Run this once in Supabase SQL Editor after dreamboard-core-schema.sql.
-- This replaces the legacy public.wm_id dependency without deleting it.

create table if not exists public.dreamboard_passports (
  user_id uuid primary key references auth.users(id) on delete cascade,
  handle text not null unique check (handle ~ '^[a-z0-9][a-z0-9_-]{2,29}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.dreamboard_passports enable row level security;

drop policy if exists "Passport owners can read their own Passport" on public.dreamboard_passports;
drop policy if exists "Passport owners can create their own Passport" on public.dreamboard_passports;
drop policy if exists "Passport owners can update their own Passport" on public.dreamboard_passports;
drop policy if exists "Passport owners can delete their own Passport" on public.dreamboard_passports;

create policy "Passport owners can read their own Passport" on public.dreamboard_passports
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Passport owners can create their own Passport" on public.dreamboard_passports
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Passport owners can update their own Passport" on public.dreamboard_passports
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Passport owners can delete their own Passport" on public.dreamboard_passports
  for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.dreamboard_passports to authenticated;

do $$
begin
  if to_regclass('public.wm_id') is not null then
    insert into public.dreamboard_passports (user_id, handle)
    select user_id, wm_id
    from public.wm_id
    where user_id is not null and wm_id ~ '^[a-z0-9][a-z0-9_-]{2,29}$'
    on conflict (user_id) do update set handle = excluded.handle, updated_at = now();
  end if;
end $$;
