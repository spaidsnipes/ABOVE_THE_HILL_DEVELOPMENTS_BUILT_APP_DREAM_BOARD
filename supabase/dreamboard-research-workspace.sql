-- Research Workspace: research questions and a claim system with explicit
-- evidence classification. Generic and project-scoped — no domain hard-coded.
-- Run after dreamboard-core-schema.sql and dreamboard-project-model.sql.

create table if not exists public.dreamboard_research_questions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.dreamboard_projects(id) on delete cascade,
  question text not null check (char_length(question) between 1 and 600),
  status text not null default 'open' check (status in ('open', 'investigating', 'answered', 'parked')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists dreamboard_research_questions_owner_project_idx
  on public.dreamboard_research_questions (owner_id, project_id, updated_at desc);
alter table public.dreamboard_research_questions enable row level security;
create policy "Creators manage their own research questions" on public.dreamboard_research_questions
  for all to authenticated using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
grant select, insert, update, delete on public.dreamboard_research_questions to authenticated;

-- Evidence classes are exactly the directive's set. The default is the most
-- humble one so a new claim never starts life labeled as established fact.
create table if not exists public.dreamboard_claims (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.dreamboard_projects(id) on delete cascade,
  question_id uuid references public.dreamboard_research_questions(id) on delete set null,
  statement text not null check (char_length(statement) between 1 and 2000),
  claim_type text not null default 'factual' check (claim_type in ('factual', 'interpretive', 'predictive', 'normative', 'definitional', 'creative')),
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
  updated_at timestamptz not null default now()
);
create index if not exists dreamboard_claims_owner_project_idx
  on public.dreamboard_claims (owner_id, project_id, updated_at desc);
alter table public.dreamboard_claims enable row level security;
create policy "Creators manage their own claims" on public.dreamboard_claims
  for all to authenticated using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
grant select, insert, update, delete on public.dreamboard_claims to authenticated;
