-- Lounge community layer: project references, comments, reporting, blocking,
-- and a moderation-hide flag. Run after dreamboard-core-schema.sql.
-- Posts are public by design; blocking is private to the blocker; reports feed
-- a future moderation queue.

alter table public.dreamboard_lounge_posts
  add column if not exists project_ref text;
alter table public.dreamboard_lounge_posts
  add column if not exists hidden boolean not null default false;

-- Only non-hidden posts are publicly readable; authors still see their own.
drop policy if exists "Anyone can read Dreamboard Lounge posts" on public.dreamboard_lounge_posts;
create policy "Read visible Lounge posts" on public.dreamboard_lounge_posts
  for select using (hidden = false or author_id = (select auth.uid()));

create table if not exists public.dreamboard_lounge_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.dreamboard_lounge_posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  author_label text not null check (char_length(author_label) between 1 and 80),
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists dreamboard_lounge_comments_post_idx on public.dreamboard_lounge_comments (post_id, created_at);
alter table public.dreamboard_lounge_comments enable row level security;
create policy "Read Lounge comments" on public.dreamboard_lounge_comments for select using (true);
create policy "Write own Lounge comments" on public.dreamboard_lounge_comments
  for insert to authenticated with check ((select auth.uid()) = author_id);
create policy "Delete own Lounge comments" on public.dreamboard_lounge_comments
  for delete to authenticated using ((select auth.uid()) = author_id);
grant select on public.dreamboard_lounge_comments to anon, authenticated;
grant insert, delete on public.dreamboard_lounge_comments to authenticated;

create table if not exists public.dreamboard_lounge_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid references public.dreamboard_lounge_posts(id) on delete cascade,
  comment_id uuid references public.dreamboard_lounge_comments(id) on delete cascade,
  reason text not null default '' check (char_length(reason) <= 500),
  created_at timestamptz not null default now(),
  check (post_id is not null or comment_id is not null)
);
alter table public.dreamboard_lounge_reports enable row level security;
-- Reporters see and file only their own reports; a moderation queue is future work.
create policy "File own reports" on public.dreamboard_lounge_reports
  for insert to authenticated with check ((select auth.uid()) = reporter_id);
create policy "Read own reports" on public.dreamboard_lounge_reports
  for select to authenticated using ((select auth.uid()) = reporter_id);
grant select, insert on public.dreamboard_lounge_reports to authenticated;

create table if not exists public.dreamboard_lounge_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.dreamboard_lounge_blocks enable row level security;
create policy "Manage own blocks" on public.dreamboard_lounge_blocks
  for all to authenticated using ((select auth.uid()) = blocker_id) with check ((select auth.uid()) = blocker_id);
grant select, insert, delete on public.dreamboard_lounge_blocks to authenticated;
