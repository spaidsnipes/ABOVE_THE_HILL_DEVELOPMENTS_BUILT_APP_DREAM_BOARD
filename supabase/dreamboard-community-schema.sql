-- Dreamboard community layer. Run this AFTER wm-id-schema.sql in Supabase SQL Editor.
-- It gives Dreamboard a real shared Lounge, a public catalog, WM Radio storage,
-- and private creator-file storage. It deliberately does not add checkout or AI keys.

create table if not exists public.lounge_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  topic text not null default 'From Dreamboard' check (char_length(topic) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.lounge_posts enable row level security;
drop policy if exists "Anyone can read Lounge posts" on public.lounge_posts;
drop policy if exists "Members create their own Lounge posts" on public.lounge_posts;
drop policy if exists "Members update their own Lounge posts" on public.lounge_posts;
drop policy if exists "Members delete their own Lounge posts" on public.lounge_posts;
create policy "Anyone can read Lounge posts" on public.lounge_posts for select using (true);
create policy "Members create their own Lounge posts" on public.lounge_posts for insert to authenticated with check ((select auth.uid()) = author_id);
create policy "Members update their own Lounge posts" on public.lounge_posts for update to authenticated using ((select auth.uid()) = author_id) with check ((select auth.uid()) = author_id);
create policy "Members delete their own Lounge posts" on public.lounge_posts for delete to authenticated using ((select auth.uid()) = author_id);
grant select on public.lounge_posts to anon, authenticated;
grant insert, update, delete on public.lounge_posts to authenticated;

create table if not exists public.shop_products (
  sku text primary key check (sku ~ '^[a-z0-9_-]{2,64}$'),
  name text not null check (char_length(name) between 1 and 120),
  kind text not null check (char_length(kind) between 1 and 80),
  note text not null default '',
  price_cents integer not null check (price_cents >= 0),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.shop_products enable row level security;
drop policy if exists "Anyone can read active Shop products" on public.shop_products;
create policy "Anyone can read active Shop products" on public.shop_products for select using (is_active = true);
grant select on public.shop_products to anon, authenticated;

insert into public.shop_products (sku, name, kind, note, price_cents, is_active, sort_order)
values
  ('spiritual-awakening', 'Spiritual Awakening', 'Book in progress', 'Connect publishing when the manuscript is ready.', 2400, true, 10),
  ('dreamboard-journal', 'The Dreamboard Journal', 'Creator tool', 'A guided companion for the work in progress.', 1800, true, 20),
  ('above-the-hill-print', 'Above the Hill Print', 'Limited art', 'Artwork release preparation.', 4200, true, 30)
on conflict (sku) do update set
  name = excluded.name,
  kind = excluded.kind,
  note = excluded.note,
  price_cents = excluded.price_cents,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  updated_at = now();

create table if not exists public.radio_stations (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9-]{2,64}$'),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  stream_url text not null check (stream_url ~ '^https?://'),
  is_live boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.radio_stations enable row level security;
drop policy if exists "Anyone can read radio stations" on public.radio_stations;
drop policy if exists "Members create their own radio stations" on public.radio_stations;
drop policy if exists "Station owners update their own stations" on public.radio_stations;
drop policy if exists "Station owners delete their own stations" on public.radio_stations;
create policy "Anyone can read radio stations" on public.radio_stations for select using (true);
create policy "Members create their own radio stations" on public.radio_stations for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "Station owners update their own stations" on public.radio_stations for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "Station owners delete their own stations" on public.radio_stations for delete to authenticated using ((select auth.uid()) = owner_id);
grant select on public.radio_stations to anon, authenticated;
grant insert, update, delete on public.radio_stations to authenticated;

insert into storage.buckets (id, name, public, file_size_limit)
values ('dreamboard-private', 'dreamboard-private', false, 52428800)
on conflict (id) do nothing;

drop policy if exists "Creators read their own Dreamboard files" on storage.objects;
drop policy if exists "Creators upload their own Dreamboard files" on storage.objects;
drop policy if exists "Creators update their own Dreamboard files" on storage.objects;
drop policy if exists "Creators delete their own Dreamboard files" on storage.objects;
create policy "Creators read their own Dreamboard files" on storage.objects for select to authenticated using (bucket_id = 'dreamboard-private' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "Creators upload their own Dreamboard files" on storage.objects for insert to authenticated with check (bucket_id = 'dreamboard-private' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "Creators update their own Dreamboard files" on storage.objects for update to authenticated using (bucket_id = 'dreamboard-private' and (storage.foldername(name))[1] = (select auth.uid()::text)) with check (bucket_id = 'dreamboard-private' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "Creators delete their own Dreamboard files" on storage.objects for delete to authenticated using (bucket_id = 'dreamboard-private' and (storage.foldername(name))[1] = (select auth.uid()::text));
