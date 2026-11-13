-- Dream Board OS · "grow" group (Above the Hill Developments, 2026-11-12)
-- Rooms: Research Workspace (+ Correction Ledger, Equation Lab), Time Machine · Legacy (read-only, no tables),
-- Growth Rings (reuses the existing dreamboard_growth_entries — untouched here), Collaboration.
-- Ported from ~/dreamboard/supabase/dreamboard-research-workspace.sql, dreamboard-corrections-equations.sql and
-- dreamboard-collaboration.sql (ADR-0006). Rules: dreamboard_* tables only, owner RLS, anon revoked,
-- idempotent (create ... if not exists / guarded policies), never drops or alters a table it does not own.
--
-- Canon rule (Founder, Spiritual Awakening research): HYPOTHESIS IS NOT VERIFIED SCIENCE.
--   * A claim cannot be "verified" or classed "established" without at least one real source.
--   * An equation reads as a hypothesis unless the author marks it empirically tested AND names a source.

-- ───────────────────────────── Research Workspace ─────────────────────────────
create table if not exists public.dreamboard_research_questions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.dreamboard_projects(id) on delete cascade,
  question text not null check (char_length(question) between 1 and 600),
  status text not null default 'open' check (status in ('open', 'investigating', 'answered', 'parked')),
  notes text not null default '' check (char_length(notes) <= 8000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists dreamboard_research_questions_owner_idx on public.dreamboard_research_questions (owner_id, updated_at desc);

create table if not exists public.dreamboard_claims (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.dreamboard_projects(id) on delete cascade,
  question_id uuid references public.dreamboard_research_questions(id) on delete set null,
  statement text not null check (char_length(statement) between 1 and 2000),
  claim_type text not null default 'factual' check (claim_type in ('factual', 'interpretive', 'predictive', 'normative', 'definitional', 'creative')),
  -- the directive's exact 13 classes; the default is the most humble one
  evidence_class text not null default 'needs_verification' check (evidence_class in (
    'established', 'emerging', 'hypothesis', 'interpretation', 'personal_observation',
    'testimony', 'historical', 'philosophical', 'theological', 'fictional', 'analogy',
    'needs_verification', 'rejected'
  )),
  sources text[] not null default '{}',
  supporting_evidence text not null default '',
  objections text not null default '',
  alternatives text not null default '',
  confidence text not null default 'unstated' check (confidence in ('unstated', 'very_low', 'low', 'moderate', 'high')),
  verification_status text not null default 'unverified' check (verification_status in ('unverified', 'in_review', 'verified', 'rejected')),
  user_notes text not null default '',
  ai_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- HYPOTHESIS IS NOT VERIFIED SCIENCE: nothing is "established" or "verified" without a named source
  constraint dreamboard_claims_established_needs_source check (evidence_class <> 'established' or cardinality(sources) > 0),
  constraint dreamboard_claims_verified_needs_source check (verification_status <> 'verified' or cardinality(sources) > 0)
);
create index if not exists dreamboard_claims_owner_idx on public.dreamboard_claims (owner_id, updated_at desc);

-- Correction Ledger: permanent, append-only. Only visibility may change; no delete policy.
create table if not exists public.dreamboard_corrections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.dreamboard_projects(id) on delete cascade,
  original_statement text not null check (char_length(original_statement) between 1 and 2000),
  issue text not null default '',
  revised_statement text not null default '',
  reason text not null default '',
  evidence text not null default '',
  affected_locations text not null default '',
  author_label text not null default '',
  visibility text not null default 'private' check (visibility in ('private', 'published')),
  created_at timestamptz not null default now()
);
create index if not exists dreamboard_corrections_owner_idx on public.dreamboard_corrections (owner_id, created_at desc);

-- Equation Lab: calculable is not validated.
create table if not exists public.dreamboard_equations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.dreamboard_projects(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  expression text not null default '',
  variables text not null default '',
  units text not null default '',
  assumptions text not null default '',
  limitations text not null default '',
  validation_status text not null default 'unvalidated' check (validation_status in ('unvalidated', 'dimensions_checked', 'reviewed', 'empirically_tested', 'rejected')),
  verified_source text not null default '' check (char_length(verified_source) <= 2000),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dreamboard_equations_tested_needs_source check (validation_status <> 'empirically_tested' or char_length(btrim(verified_source)) > 0)
);
create index if not exists dreamboard_equations_owner_idx on public.dreamboard_equations (owner_id, updated_at desc);

alter table public.dreamboard_research_questions enable row level security;
alter table public.dreamboard_claims enable row level security;
alter table public.dreamboard_corrections enable row level security;
alter table public.dreamboard_equations enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'dreamboard_research_questions' and policyname = 'dreamboard_research_questions_owner_all') then
    create policy dreamboard_research_questions_owner_all on public.dreamboard_research_questions for all to authenticated
      using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'dreamboard_claims' and policyname = 'dreamboard_claims_owner_all') then
    create policy dreamboard_claims_owner_all on public.dreamboard_claims for all to authenticated
      using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'dreamboard_corrections' and policyname = 'dreamboard_corrections_owner_read') then
    create policy dreamboard_corrections_owner_read on public.dreamboard_corrections for select to authenticated using (owner_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'dreamboard_corrections' and policyname = 'dreamboard_corrections_owner_file') then
    create policy dreamboard_corrections_owner_file on public.dreamboard_corrections for insert to authenticated with check (owner_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'dreamboard_corrections' and policyname = 'dreamboard_corrections_owner_visibility') then
    create policy dreamboard_corrections_owner_visibility on public.dreamboard_corrections for update to authenticated
      using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'dreamboard_equations' and policyname = 'dreamboard_equations_owner_all') then
    create policy dreamboard_equations_owner_all on public.dreamboard_equations for all to authenticated
      using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
  end if;
end $$;

-- Append-only ledger: only `visibility` may change after filing (column-level grant).
revoke all on public.dreamboard_research_questions, public.dreamboard_claims, public.dreamboard_corrections, public.dreamboard_equations from anon;
grant select, insert, update, delete on public.dreamboard_research_questions, public.dreamboard_claims, public.dreamboard_equations to authenticated;
revoke update, delete on public.dreamboard_corrections from authenticated;
grant select, insert on public.dreamboard_corrections to authenticated;
grant update (visibility) on public.dreamboard_corrections to authenticated;

-- ───────────────────────────── Collaboration ─────────────────────────────
-- Sharing one Book Studio book or one project with an invited Passport email, as reader or editor.
-- * Only the owner of the book/project creates an invite (explicit owner action; policy + trigger enforced).
-- * The invitee answers through dreamboard_share_respond (SECURITY DEFINER) which only flips status and links
--   their user id — it never touches role, so nobody can raise their own role (ADR-0006).
-- * Shared reading goes through SECURITY DEFINER RPCs (dreamboard_shared_book / dreamboard_shared_project) that
--   check an accepted share first. We deliberately add NO new SELECT policies on dreamboard_books / book_* /
--   projects: a permissive policy there would make shared rows appear in every unfiltered query other rooms run
--   (search, reader, publishing) for the invitee. The RPC keeps shared content in this one room.
-- * Editors do not write in the owner's manuscript (the author's voice leads). Editors may leave margin notes.
create table if not exists public.dreamboard_shares (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  target_kind text not null check (target_kind in ('book', 'project')),
  target_id uuid not null,
  invited_email text not null check (invited_email = lower(btrim(invited_email)) and invited_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(invited_email) <= 320),
  member_id uuid references auth.users(id) on delete cascade,
  role text not null default 'reader' check (role in ('reader', 'editor')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  note text not null default '' check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (target_kind, target_id, invited_email)
);
create index if not exists dreamboard_shares_owner_idx on public.dreamboard_shares (owner_id, target_kind, target_id);
create index if not exists dreamboard_shares_member_idx on public.dreamboard_shares (member_id);
create index if not exists dreamboard_shares_email_idx on public.dreamboard_shares (invited_email);

create table if not exists public.dreamboard_share_notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade, -- owner of the shared book/project
  author_id uuid not null references auth.users(id) on delete cascade,
  author_label text not null default '' check (char_length(author_label) <= 120),
  target_kind text not null check (target_kind in ('book', 'project')),
  target_id uuid not null,
  chapter_id uuid,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists dreamboard_share_notes_target_idx on public.dreamboard_share_notes (target_kind, target_id, created_at);

-- SECURITY DEFINER helpers (search_path pinned) — break policy recursion, never trust client state.
create or replace function public.dreamboard_target_owner(kind text, tid uuid)
returns uuid language sql security definer set search_path = public stable as $$
  select case kind
    when 'book' then (select b.owner_id from public.dreamboard_books b where b.id = tid)
    when 'project' then (select p.owner_id from public.dreamboard_projects p where p.id = tid)
  end;
$$;

create or replace function public.dreamboard_share_role(kind text, tid uuid, uid uuid)
returns text language sql security definer set search_path = public stable as $$
  select case
    when uid is null then null
    when public.dreamboard_target_owner(kind, tid) = uid then 'owner'
    else (select s.role from public.dreamboard_shares s
           where s.target_kind = kind and s.target_id = tid and s.member_id = uid and s.status = 'accepted' limit 1)
  end;
$$;

-- Guard: invites start pending and unlinked; owner/target never move; status/member only change via the RPC.
create or replace function public.dreamboard_shares_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.status := 'pending'; new.member_id := null; new.responded_at := null;
    new.invited_email := lower(btrim(new.invited_email));
    if public.dreamboard_target_owner(new.target_kind, new.target_id) is distinct from new.owner_id then
      raise exception 'Only the owner can share this %', new.target_kind using errcode = '42501';
    end if;
    if new.invited_email = lower(coalesce((select auth.jwt() ->> 'email'), '')) then
      raise exception 'You already own this %', new.target_kind using errcode = '22023';
    end if;
    return new;
  end if;
  if new.owner_id <> old.owner_id or new.target_kind <> old.target_kind or new.target_id <> old.target_id or new.invited_email <> old.invited_email then
    raise exception 'A share cannot be moved' using errcode = '42501';
  end if;
  if (new.status is distinct from old.status or new.member_id is distinct from old.member_id or new.responded_at is distinct from old.responded_at)
     and coalesce(current_setting('dreamboard.share_rpc', true), '') <> 'on' then
    raise exception 'Only the invited Passport can answer an invitation' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists dreamboard_shares_guard on public.dreamboard_shares;
create trigger dreamboard_shares_guard before insert or update on public.dreamboard_shares
  for each row execute function public.dreamboard_shares_guard();

-- Invitee accepts / declines (or leaves an accepted share). Never touches role.
create or replace function public.dreamboard_share_respond(sid uuid, accept boolean)
returns text language plpgsql security definer set search_path = public as $$
declare
  uid uuid := (select auth.uid());
  uemail text := lower(coalesce((select auth.jwt() ->> 'email'), ''));
  n int;
begin
  if uid is null then raise exception 'Sign in with your Passport first' using errcode = '42501'; end if;
  perform set_config('dreamboard.share_rpc', 'on', true);
  update public.dreamboard_shares
     set member_id = uid,
         status = case when accept then 'accepted' else 'declined' end,
         responded_at = now()
   where id = sid
     and owner_id <> uid
     and (member_id = uid or (member_id is null and invited_email = uemail))
     and (status = 'pending' or (status = 'accepted' and not accept));
  get diagnostics n = row_count;
  perform set_config('dreamboard.share_rpc', '', true);
  return case when n = 0 then 'not_found' when accept then 'accepted' else 'declined' end;
end;
$$;

-- What has been shared with me (titles come from the owner's rows, so this must be definer).
create or replace function public.dreamboard_shared_with_me()
returns table (id uuid, target_kind text, target_id uuid, title text, owner_label text, role text, status text, note text, created_at timestamptz)
language sql security definer set search_path = public stable as $$
  select s.id, s.target_kind, s.target_id,
         coalesce(case s.target_kind when 'book' then (select b.title from public.dreamboard_books b where b.id = s.target_id)
                                    else (select p.title from public.dreamboard_projects p where p.id = s.target_id) end, '(no longer available)'),
         coalesce((select nullif(pr.display_name, '') from public.dreamboard_profiles pr where pr.id = s.owner_id), 'A Passport holder'),
         s.role, s.status, s.note, s.created_at
    from public.dreamboard_shares s
   where (select auth.uid()) is not null
     and s.owner_id <> (select auth.uid())
     and (s.member_id = (select auth.uid()) or (s.member_id is null and s.invited_email = lower(coalesce((select auth.jwt() ->> 'email'), ''))))
     and s.status in ('pending', 'accepted')
   order by s.created_at desc;
$$;

-- Read-only shared manuscript: chapters + the passages placed in them, only for an accepted share (or the owner).
create or replace function public.dreamboard_shared_book(bid uuid)
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare r text := public.dreamboard_share_role('book', bid, (select auth.uid()));
begin
  if r is null then raise exception 'This book is not shared with your Passport' using errcode = '42501'; end if;
  return jsonb_build_object(
    'role', r,
    'book', (select jsonb_build_object('id', b.id, 'title', b.title, 'subtitle', b.subtitle, 'words', b.words, 'updated_at', b.updated_at) from public.dreamboard_books b where b.id = bid),
    'chapters', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'title', c.title, 'part', c.part, 'position', c.position, 'summary', c.summary) order by c.position)
                            from public.dreamboard_book_chapters c where c.book_id = bid), '[]'::jsonb),
    'passages', coalesce((select jsonb_agg(jsonb_build_object('chapter_id', p.chapter_id, 'position', p.position, 'body', p.body, 'speaker', p.speaker) order by p.position nulls last, p.seq)
                            from public.dreamboard_book_passages p where p.book_id = bid and p.chapter_id is not null), '[]'::jsonb));
end;
$$;

create or replace function public.dreamboard_shared_project(pid uuid)
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare r text := public.dreamboard_share_role('project', pid, (select auth.uid()));
begin
  if r is null then raise exception 'This project is not shared with your Passport' using errcode = '42501'; end if;
  return jsonb_build_object(
    'role', r,
    'project', (select jsonb_build_object('id', p.id, 'title', p.title, 'kind', p.kind, 'vision', p.vision, 'stage', p.stage, 'progress', p.progress, 'updated_at', p.updated_at) from public.dreamboard_projects p where p.id = pid),
    'timeline', coalesce((select jsonb_agg(jsonb_build_object('title', t.title, 'detail', t.detail, 'occurred_at', t.occurred_at) order by t.occurred_at desc)
                            from public.dreamboard_timeline_events t where t.project_id = pid), '[]'::jsonb));
end;
$$;

alter table public.dreamboard_shares enable row level security;
alter table public.dreamboard_share_notes enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'dreamboard_shares' and policyname = 'dreamboard_shares_owner_all') then
    create policy dreamboard_shares_owner_all on public.dreamboard_shares for all to authenticated
      using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'dreamboard_shares' and policyname = 'dreamboard_shares_invitee_read') then
    create policy dreamboard_shares_invitee_read on public.dreamboard_shares for select to authenticated
      using (member_id = (select auth.uid()) or (member_id is null and invited_email = lower(coalesce((select auth.jwt() ->> 'email'), ''))));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'dreamboard_share_notes' and policyname = 'dreamboard_share_notes_read') then
    create policy dreamboard_share_notes_read on public.dreamboard_share_notes for select to authenticated
      using (public.dreamboard_share_role(target_kind, target_id, (select auth.uid())) is not null);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'dreamboard_share_notes' and policyname = 'dreamboard_share_notes_write') then
    create policy dreamboard_share_notes_write on public.dreamboard_share_notes for insert to authenticated
      with check (author_id = (select auth.uid())
                  and owner_id = public.dreamboard_target_owner(target_kind, target_id)
                  and public.dreamboard_share_role(target_kind, target_id, (select auth.uid())) in ('owner', 'editor'));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'dreamboard_share_notes' and policyname = 'dreamboard_share_notes_delete') then
    create policy dreamboard_share_notes_delete on public.dreamboard_share_notes for delete to authenticated
      using (author_id = (select auth.uid()) or owner_id = (select auth.uid()));
  end if;
end $$;

revoke all on public.dreamboard_shares, public.dreamboard_share_notes from anon;
grant select, insert, update, delete on public.dreamboard_shares to authenticated;
grant select, insert, delete on public.dreamboard_share_notes to authenticated;

revoke all on function public.dreamboard_target_owner(text, uuid) from public, anon;
revoke all on function public.dreamboard_share_role(text, uuid, uuid) from public, anon;
revoke all on function public.dreamboard_shares_guard() from public, anon;
revoke all on function public.dreamboard_share_respond(uuid, boolean) from public, anon;
revoke all on function public.dreamboard_shared_with_me() from public, anon;
revoke all on function public.dreamboard_shared_book(uuid) from public, anon;
revoke all on function public.dreamboard_shared_project(uuid) from public, anon;
grant execute on function public.dreamboard_target_owner(text, uuid) to authenticated;
grant execute on function public.dreamboard_share_role(text, uuid, uuid) to authenticated;
grant execute on function public.dreamboard_share_respond(uuid, boolean) to authenticated;
grant execute on function public.dreamboard_shared_with_me() to authenticated;
grant execute on function public.dreamboard_shared_book(uuid) to authenticated;
grant execute on function public.dreamboard_shared_project(uuid) to authenticated;
