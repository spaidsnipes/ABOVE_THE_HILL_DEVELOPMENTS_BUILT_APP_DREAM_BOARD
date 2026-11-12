-- Dream Board · Golden inventions (2026-11-12)
-- Money Tree board, Quantum-ply dashboard, Belief Chain journal, Orchard,
-- "Start before ready" daily step, and the three-zone vision board
-- (DREAM / MAKE IT PLAIN / DO-PROVE, from the Dreamboard Wall canon).
-- Principles credited to Myron Golden; summarized in ATH's own words.
--
-- Additive only. Every row is private to its owner (auth.uid() = owner_id).
-- Tier access is read through dreamboard_my_access() (SECURITY DEFINER),
-- never from a client-side flag.

create table if not exists public.dreamboard_money_trees (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  goal text not null default '' check (char_length(goal) <= 600),
  biggest_challenge text not null default '' check (char_length(biggest_challenge) <= 600),
  stage text not null default 'seed' check (stage in ('seed','sprout','young','fruiting')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dreamboard_tree_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  tree_id uuid not null references public.dreamboard_money_trees(id) on delete cascade,
  lane text not null check (lane in ('taproot','roots','shoot','fruit')),
  kind text not null default '' check (kind in ('','connection','conversion','consensus','void','virtue','vision')),
  body text not null check (char_length(body) between 1 and 400),
  done_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists dreamboard_tree_items_tree_idx on public.dreamboard_tree_items(tree_id, lane);

create table if not exists public.dreamboard_quantum_plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  tree_id uuid references public.dreamboard_money_trees(id) on delete set null,
  metric_name text not null check (char_length(metric_name) between 1 and 80),
  unit text not null default '' check (char_length(unit) <= 24),
  baseline numeric not null,
  target numeric,
  current_step text not null default 'quantify'
    check (current_step in ('quantify','qualify','simplify','amplify','magnify','multiply')),
  step_notes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dreamboard_quantum_weeks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.dreamboard_quantum_plans(id) on delete cascade,
  week_start date not null,
  value numeric not null,
  note text not null default '' check (char_length(note) <= 400),
  created_at timestamptz not null default now(),
  unique (plan_id, week_start)
);

create table if not exists public.dreamboard_belief_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  facts text not null default '' check (char_length(facts) <= 1200),
  focus text not null default '' check (char_length(focus) <= 800),
  focus_tone text check (focus_tone in ('positive','negative')),
  belief text not null default '' check (char_length(belief) <= 800),
  belief_tone text check (belief_tone in ('faith','doubt')),
  feeling text not null default '' check (char_length(feeling) <= 800),
  feeling_tone text check (feeling_tone in ('anticipation','anxiety')),
  function_text text not null default '' check (char_length(function_text) <= 800),
  function_tone text check (function_tone in ('power','powerlessness')),
  replacement text not null default '' check (char_length(replacement) <= 1200),
  created_at timestamptz not null default now()
);

create table if not exists public.dreamboard_daily_steps (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  tree_id uuid references public.dreamboard_money_trees(id) on delete set null,
  step text not null check (char_length(step) between 1 and 280),
  started_at timestamptz,
  created_at timestamptz not null default now(),
  unique (owner_id, day)
);

create table if not exists public.dreamboard_board_cards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  zone text not null check (zone in ('dream','plain','prove')),
  body text not null check (char_length(body) between 1 and 500),
  done_at timestamptz,
  created_at timestamptz not null default now()
);

-- RLS: owner-only, all seven tables.
do $$
declare t text;
begin
  foreach t in array array['dreamboard_money_trees','dreamboard_tree_items','dreamboard_quantum_plans',
    'dreamboard_quantum_weeks','dreamboard_belief_entries','dreamboard_daily_steps','dreamboard_board_cards']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_owner_all', t);
    execute format('create policy %I on public.%I for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid())', t || '_owner_all', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- Children must point at a parent the same user owns.
create or replace function public.dreamboard_golden_parent_check()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_table_name = 'dreamboard_tree_items' then
    if not exists (select 1 from public.dreamboard_money_trees t where t.id = new.tree_id and t.owner_id = new.owner_id) then
      raise exception 'tree not owned by caller';
    end if;
  elsif tg_table_name = 'dreamboard_quantum_weeks' then
    if not exists (select 1 from public.dreamboard_quantum_plans p where p.id = new.plan_id and p.owner_id = new.owner_id) then
      raise exception 'plan not owned by caller';
    end if;
  elsif tg_table_name in ('dreamboard_quantum_plans','dreamboard_daily_steps') then
    if new.tree_id is not null and not exists (select 1 from public.dreamboard_money_trees t where t.id = new.tree_id and t.owner_id = new.owner_id) then
      raise exception 'tree not owned by caller';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists dreamboard_tree_items_parent on public.dreamboard_tree_items;
create trigger dreamboard_tree_items_parent before insert or update on public.dreamboard_tree_items
  for each row execute function public.dreamboard_golden_parent_check();
drop trigger if exists dreamboard_quantum_weeks_parent on public.dreamboard_quantum_weeks;
create trigger dreamboard_quantum_weeks_parent before insert or update on public.dreamboard_quantum_weeks
  for each row execute function public.dreamboard_golden_parent_check();
drop trigger if exists dreamboard_quantum_plans_parent on public.dreamboard_quantum_plans;
create trigger dreamboard_quantum_plans_parent before insert or update on public.dreamboard_quantum_plans
  for each row execute function public.dreamboard_golden_parent_check();
drop trigger if exists dreamboard_daily_steps_parent on public.dreamboard_daily_steps;
create trigger dreamboard_daily_steps_parent before insert or update on public.dreamboard_daily_steps
  for each row execute function public.dreamboard_golden_parent_check();

-- Orchard size is a tier rule, enforced in the database (not just the UI).
-- basic Passport: 1 Money Tree ("one tree at a time");
-- premium (Dream Board / Passport entitlement), partner or Founder: unlimited.
create or replace function public.dreamboard_my_access()
returns jsonb language sql stable security definer set search_path = '' as $$
  with me as (select auth.uid() as uid),
  founder as (
    select exists (select 1 from ath_private.founder_grants g, me
                    where g.subject = me.uid and g.active and (g.expires_at is null or g.expires_at > now())) as yes),
  ent as (
    select coalesce(jsonb_agg(distinct g.app_slug || ':' || g.entitlement_key), '[]'::jsonb) as list,
           bool_or(g.app_slug in ('dreamboard','passport','world_pass','*')) as premium,
           bool_or(g.source ilike '%partner%') as partner
      from ath_private.passport_entitlement_grants g, me
     where g.passport_user_id = me.uid and g.revoked_at is null
       and (g.expires_at is null or g.expires_at > now()))
  select case when (select uid from me) is null then jsonb_build_object('signedIn', false)
  else jsonb_build_object(
    'signedIn', true,
    'tier', case when (select yes from founder) then 'founder'
                 when coalesce((select partner from ent), false) then 'partner'
                 when coalesce((select premium from ent), false) then 'premium'
                 else 'basic' end,
    'treeLimit', case when (select yes from founder) or coalesce((select partner from ent), false)
                        or coalesce((select premium from ent), false) then null else 1 end,
    'entitlements', (select list from ent))
  end
$$;
revoke all on function public.dreamboard_my_access() from public, anon;
grant execute on function public.dreamboard_my_access() to authenticated;

create or replace function public.dreamboard_tree_limit_check()
returns trigger language plpgsql security definer set search_path = '' as $$
declare lim int; n int;
begin
  if new.owner_id is distinct from auth.uid() then
    raise exception 'owner mismatch';
  end if;
  lim := nullif(public.dreamboard_my_access()->>'treeLimit', '')::int;
  if lim is not null then
    select count(*) into n from public.dreamboard_money_trees where owner_id = new.owner_id;
    if n >= lim then
      raise exception 'DREAMBOARD_TREE_LIMIT: your Passport tier plants % tree(s); upgrade for the full Orchard', lim
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists dreamboard_money_trees_limit on public.dreamboard_money_trees;
create trigger dreamboard_money_trees_limit before insert on public.dreamboard_money_trees
  for each row execute function public.dreamboard_tree_limit_check();
