-- Dreamboard / WM ID foundation. Run once in Supabase: SQL Editor > New query > Run.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  wm_handle text unique check (wm_handle ~ '^[a-z0-9][a-z0-9_-]{2,29}$'),
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are visible to signed-in WM members"
on public.profiles for select to authenticated using (true);

create policy "Members create their own profile"
on public.profiles for insert to authenticated with check ((select auth.uid()) = id);

create policy "Members update their own profile"
on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- This table is the shared ownership anchor for the future Book, Lounge, Shop, and Radio data.
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  kind text not null default 'book',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.projects enable row level security;

create policy "Members read their own projects"
on public.projects for select to authenticated using ((select auth.uid()) = owner_id);

create policy "Members create their own projects"
on public.projects for insert to authenticated with check ((select auth.uid()) = owner_id);

create policy "Members update their own projects"
on public.projects for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

create policy "Members delete their own projects"
on public.projects for delete to authenticated using ((select auth.uid()) = owner_id);
