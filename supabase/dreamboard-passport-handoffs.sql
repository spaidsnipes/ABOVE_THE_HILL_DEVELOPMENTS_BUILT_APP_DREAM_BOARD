-- One-time server-to-server Passport handoffs from Dreamboard to WOW World.
-- Run after dreamboard-passports.sql. This stores only a SHA-256 digest of an
-- opaque 256-bit code. The original code is never persisted and expires fast.

create table if not exists public.dreamboard_passport_handoffs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  destination text not null check (destination in ('lounge', 'shop', 'radio')),
  code_hash text not null unique check (code_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists dreamboard_passport_handoffs_expiry_idx
  on public.dreamboard_passport_handoffs (expires_at);

alter table public.dreamboard_passport_handoffs enable row level security;
-- Browser clients have no direct table access. Dreamboard and WOW World use
-- their server-only SUPABASE_SERVICE_ROLE_KEY through the two API endpoints.
revoke all on public.dreamboard_passport_handoffs from anon, authenticated;

create or replace function public.consume_dreamboard_passport_handoff(
  requested_code_hash text,
  requested_destination text
)
returns table (user_id uuid, destination text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    update public.dreamboard_passport_handoffs
       set consumed_at = now()
     where code_hash = requested_code_hash
       and destination = requested_destination
       and consumed_at is null
       and expires_at > now()
     returning dreamboard_passport_handoffs.user_id, dreamboard_passport_handoffs.destination;
end;
$$;

revoke all on function public.consume_dreamboard_passport_handoff(text, text) from public, anon, authenticated;
grant execute on function public.consume_dreamboard_passport_handoff(text, text) to service_role;
