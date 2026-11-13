-- Dream Board OS · "grow" group fix (2026-11-13). Idempotent; additive only.
-- Collaboration parity with ~/dreamboard/app/collaboration.tsx: a margin note can be marked as a review request
-- ("Request a review"). It stays a note beside the work — it never writes into the owner's manuscript.
alter table public.dreamboard_share_notes add column if not exists is_review_request boolean not null default false;
notify pgrst, 'reload schema';
