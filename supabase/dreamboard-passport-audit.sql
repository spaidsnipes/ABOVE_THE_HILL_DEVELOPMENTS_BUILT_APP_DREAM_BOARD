-- Passport activity is an owner-visible record of sensitive system actions.
-- Writes are server-only; browser clients may read only their own activity.
create table if not exists public.dreamboard_passport_audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('handoff_issued', 'handoff_consumed')),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists dreamboard_passport_audit_events_user_created_idx
  on public.dreamboard_passport_audit_events (user_id, created_at desc);

alter table public.dreamboard_passport_audit_events enable row level security;
revoke all on public.dreamboard_passport_audit_events from anon, authenticated;
grant select on public.dreamboard_passport_audit_events to authenticated;
grant select, insert on public.dreamboard_passport_audit_events to service_role;

drop policy if exists "Creators read their Passport activity" on public.dreamboard_passport_audit_events;
create policy "Creators read their Passport activity"
  on public.dreamboard_passport_audit_events for select
  using (auth.uid() = user_id);
