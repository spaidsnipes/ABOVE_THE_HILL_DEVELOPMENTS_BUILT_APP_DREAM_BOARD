-- Dreamboard core. This migration intentionally leaves existing legacy WM tables untouched.
-- It uses public.wm_id as the canonical identity table and gives Dreamboard dedicated,
-- protected tables for creator preferences, projects, timeline, Lounge, Shop, and Radio.

create unique index if not exists wm_id_one_per_user
  on public.wm_id (user_id)
  where user_id is not null;

drop policy if exists "Users can view their own WM ID" on public.wm_id;
drop policy if exists "Users can insert their own WM ID" on public.wm_id;
drop policy if exists "Users can update their own WM ID" on public.wm_id;
drop policy if exists "Users can delete their own WM ID" on public.wm_id;
create policy "Users can view their own WM ID" on public.wm_id
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert their own WM ID" on public.wm_id
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own WM ID" on public.wm_id
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users can delete their own WM ID" on public.wm_id
  for delete to authenticated using ((select auth.uid()) = user_id);

create table if not exists public.dreamboard_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) between 1 and 80),
  avatar_url text,
  theme text not null default 'emerald-gold' check (theme in ('emerald-gold', 'midnight-gold', 'violet-gold', 'blue-gold')),
  wisdom_mode boolean not null default false,
  creator_season text not null default 'planting' check (creator_season in ('planting', 'growing', 'building', 'blooming', 'harvest', 'stewardship', 'new-seeds')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.dreamboard_profiles enable row level security;
create policy "Creators read their own Dreamboard profile" on public.dreamboard_profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "Creators create their own Dreamboard profile" on public.dreamboard_profiles
  for insert to authenticated with check ((select auth.uid()) = id);
create policy "Creators update their own Dreamboard profile" on public.dreamboard_profiles
  for update to authenticated using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
grant select, insert, update on public.dreamboard_profiles to authenticated;

create table if not exists public.dreamboard_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  kind text not null default 'book' check (char_length(kind) between 1 and 50),
  vision text not null default '',
  stage text not null default 'seed' check (stage in ('seed', 'growing', 'building', 'complete')),
  progress smallint not null default 0 check (progress between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dreamboard_projects_owner_updated_idx
  on public.dreamboard_projects (owner_id, updated_at desc);
alter table public.dreamboard_projects enable row level security;
create policy "Creators manage their own Dreamboard projects" on public.dreamboard_projects
  for all to authenticated using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
grant select, insert, update, delete on public.dreamboard_projects to authenticated;

create table if not exists public.dreamboard_timeline_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.dreamboard_projects(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  detail text not null default '',
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists dreamboard_timeline_owner_occurred_idx
  on public.dreamboard_timeline_events (owner_id, occurred_at desc);
alter table public.dreamboard_timeline_events enable row level security;
create policy "Creators manage their own Dreamboard timeline" on public.dreamboard_timeline_events
  for all to authenticated using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
grant select, insert, update, delete on public.dreamboard_timeline_events to authenticated;

create table if not exists public.dreamboard_lounge_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  author_label text not null check (char_length(author_label) between 1 and 80),
  body text not null check (char_length(trim(body)) between 1 and 2000),
  topic text not null default 'From Dreamboard' check (char_length(topic) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dreamboard_lounge_posts_created_idx
  on public.dreamboard_lounge_posts (created_at desc);
alter table public.dreamboard_lounge_posts enable row level security;
create policy "Anyone can read Dreamboard Lounge posts" on public.dreamboard_lounge_posts
  for select using (true);
create policy "Creators publish their own Dreamboard Lounge posts" on public.dreamboard_lounge_posts
  for insert to authenticated with check ((select auth.uid()) = author_id);
create policy "Creators update their own Dreamboard Lounge posts" on public.dreamboard_lounge_posts
  for update to authenticated using ((select auth.uid()) = author_id)
  with check ((select auth.uid()) = author_id);
create policy "Creators delete their own Dreamboard Lounge posts" on public.dreamboard_lounge_posts
  for delete to authenticated using ((select auth.uid()) = author_id);
grant select on public.dreamboard_lounge_posts to anon, authenticated;
grant insert, update, delete on public.dreamboard_lounge_posts to authenticated;

create table if not exists public.dreamboard_shop_products (
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

alter table public.dreamboard_shop_products enable row level security;
create policy "Anyone can read active Dreamboard Shop products" on public.dreamboard_shop_products
  for select using (is_active = true);
grant select on public.dreamboard_shop_products to anon, authenticated;

insert into public.dreamboard_shop_products (sku, name, kind, note, price_cents, is_active, sort_order)
values
  ('spiritual-awakening', 'Spiritual Awakening', 'Book in progress', 'Connect publishing when the manuscript is ready.', 2400, true, 10),
  ('dreamboard-journal', 'The Dreamboard Journal', 'Creator tool', 'A guided companion for the work in progress.', 1800, true, 20),
  ('above-the-hill-print', 'Above the Hill Print', 'Limited art', 'Artwork release preparation.', 4200, true, 30)
on conflict (sku) do update set
  name = excluded.name, kind = excluded.kind, note = excluded.note,
  price_cents = excluded.price_cents, is_active = excluded.is_active,
  sort_order = excluded.sort_order, updated_at = now();

create table if not exists public.dreamboard_radio_stations (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9-]{2,64}$'),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  stream_url text not null check (stream_url ~ '^https?://'),
  is_live boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.dreamboard_radio_stations enable row level security;
create policy "Anyone can read Dreamboard radio stations" on public.dreamboard_radio_stations
  for select using (true);
create policy "Creators create their own Dreamboard stations" on public.dreamboard_radio_stations
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "Creators update their own Dreamboard stations" on public.dreamboard_radio_stations
  for update to authenticated using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy "Creators delete their own Dreamboard stations" on public.dreamboard_radio_stations
  for delete to authenticated using ((select auth.uid()) = owner_id);
grant select on public.dreamboard_radio_stations to anon, authenticated;
grant insert, update, delete on public.dreamboard_radio_stations to authenticated;

insert into storage.buckets (id, name, public, file_size_limit)
values ('dreamboard-private', 'dreamboard-private', false, 52428800)
on conflict (id) do nothing;

drop policy if exists "Dreamboard creators read their own files" on storage.objects;
drop policy if exists "Dreamboard creators upload their own files" on storage.objects;
drop policy if exists "Dreamboard creators update their own files" on storage.objects;
drop policy if exists "Dreamboard creators delete their own files" on storage.objects;
create policy "Dreamboard creators read their own files" on storage.objects
  for select to authenticated using (bucket_id = 'dreamboard-private' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "Dreamboard creators upload their own files" on storage.objects
  for insert to authenticated with check (bucket_id = 'dreamboard-private' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "Dreamboard creators update their own files" on storage.objects
  for update to authenticated using (bucket_id = 'dreamboard-private' and (storage.foldername(name))[1] = (select auth.uid()::text))
  with check (bucket_id = 'dreamboard-private' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "Dreamboard creators delete their own files" on storage.objects
  for delete to authenticated using (bucket_id = 'dreamboard-private' and (storage.foldername(name))[1] = (select auth.uid()::text));
