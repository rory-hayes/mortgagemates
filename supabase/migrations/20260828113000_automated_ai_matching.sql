-- Automated, bounded AI matching. Deterministic gates remain authoritative;
-- the model ranks only eligible members and may return at most one proposal.

alter table public.matches
  alter column proposed_by drop not null,
  add column if not exists source text not null default 'admin'
    check (source in ('admin', 'ai')),
  add column if not exists ai_model text,
  add column if not exists algorithm_version text,
  add column if not exists overall_score smallint
    check (overall_score is null or overall_score between 0 and 100),
  add column if not exists score_breakdown jsonb,
  add column if not exists match_reasons text[],
  add column if not exists discussion_points text[],
  add column if not exists input_hash text;

create table if not exists public.ai_matching_runs (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references public.profiles(id) on delete cascade,
  selected_user_id uuid references public.profiles(id) on delete set null,
  purpose text not null default 'member_matching'
    check (purpose in ('member_matching')),
  status text not null check (status in ('proposed', 'held', 'failed')),
  candidate_count smallint not null check (candidate_count between 0 and 12),
  overall_score smallint check (overall_score is null or overall_score between 0 and 100),
  model text not null check (char_length(model) between 3 and 120),
  algorithm_version text not null check (char_length(algorithm_version) between 3 and 80),
  input_hash text not null check (input_hash ~ '^[a-f0-9]{64}$'),
  match_id uuid references public.matches(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists ai_matching_runs_requested_by_idx
  on public.ai_matching_runs(requested_by, created_at desc);
create index if not exists ai_matching_runs_created_at_idx
  on public.ai_matching_runs(created_at desc);

alter table public.ai_matching_runs enable row level security;

drop policy if exists ai_matching_runs_admin_read on public.ai_matching_runs;
create policy ai_matching_runs_admin_read on public.ai_matching_runs
  for select to authenticated
  using ((select public.is_admin()));

revoke all on public.ai_matching_runs from anon, authenticated;
grant select on public.ai_matching_runs to authenticated;

create or replace function public.service_create_ai_match(
  p_requested_by uuid,
  p_selected_user uuid,
  p_compatibility jsonb,
  p_overall_score smallint,
  p_score_breakdown jsonb,
  p_match_reasons text[],
  p_discussion_points text[],
  p_model text,
  p_algorithm_version text,
  p_input_hash text,
  p_candidate_count smallint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  match_id uuid;
  run_id uuid;
  canonical_a uuid := least(p_requested_by, p_selected_user);
  canonical_b uuid := greatest(p_requested_by, p_selected_user);
  ready_count integer;
  rules_ok boolean := false;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'Service role required';
  end if;
  if p_requested_by is null or p_selected_user is null or p_requested_by = p_selected_user then
    raise exception 'Choose two different members';
  end if;
  if p_overall_score < 70 or p_overall_score > 100 then
    raise exception 'AI proposal score must be between 70 and 100';
  end if;
  if p_candidate_count < 1 or p_candidate_count > 12 then
    raise exception 'Candidate count must be between 1 and 12';
  end if;
  if p_input_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid matching input hash';
  end if;
  if char_length(trim(coalesce(p_model, ''))) not between 3 and 120
    or char_length(trim(coalesce(p_algorithm_version, ''))) not between 3 and 80 then
    raise exception 'Model and algorithm version are required';
  end if;
  if coalesce(cardinality(p_match_reasons), 0) < 2
    or coalesce(cardinality(p_discussion_points), 0) < 1 then
    raise exception 'AI rationale is incomplete';
  end if;

  -- Canonical lock ordering prevents two concurrent runs from proposing either
  -- participant to separate people.
  perform 1
  from public.profiles
  where id in (canonical_a, canonical_b)
  order by id
  for update;

  select count(*) into ready_count
  from public.profiles
  where id in (canonical_a, canonical_b)
    and role = 'buyer'
    and onboarding_status = 'approved'
    and matching_status = 'ready'
    and public.profile_is_complete(id)
    and public.profile_has_current_acceptance(id)
    and public.member_documents_ready(id);

  if ready_count <> 2 then
    raise exception 'Both members must be approved, document-ready, and available';
  end if;

  if exists (
    select 1 from public.reports
    where reported_user_id in (canonical_a, canonical_b)
      and status in ('open', 'reviewing')
  ) then
    raise exception 'A safety report must be resolved before matching';
  end if;

  select
    a.target_locations && b.target_locations
    and a.property_types && b.property_types
    and a.purchase_timeline is not null
    and a.purchase_timeline = b.purchase_timeline
    and nullif(trim(a.borrowing_range), '') is not null
    and nullif(trim(b.borrowing_range), '') is not null
    and nullif(trim(a.ownership_expectations ->> 'horizon'), '') is not null
    and a.ownership_expectations ->> 'horizon' = b.ownership_expectations ->> 'horizon'
  into rules_ok
  from public.buyer_preferences a
  join public.buyer_preferences b on b.user_id = canonical_b
  where a.user_id = canonical_a;

  if not coalesce(rules_ok, false) then
    raise exception 'Deterministic matching rules no longer pass';
  end if;

  if exists (
    select 1 from public.matches
    where status in ('proposed', 'mutual_interest', 'unlocked')
      and (
        p_requested_by in (user_a, user_b)
        or p_selected_user in (user_a, user_b)
      )
  ) then
    raise exception 'Each member can have only one active proposal';
  end if;

  insert into public.matches (
    user_a,
    user_b,
    compatibility,
    rules_passed,
    rules_total,
    admin_note,
    proposed_by,
    source,
    ai_model,
    algorithm_version,
    overall_score,
    score_breakdown,
    match_reasons,
    discussion_points,
    input_hash
  ) values (
    canonical_a,
    canonical_b,
    p_compatibility,
    6,
    6,
    'Automatically selected after deterministic eligibility gates and bounded AI ranking.',
    null,
    'ai',
    trim(p_model),
    trim(p_algorithm_version),
    p_overall_score,
    p_score_breakdown,
    p_match_reasons,
    p_discussion_points,
    p_input_hash
  ) returning id into match_id;

  update public.profiles
  set matching_status = 'proposed'
  where id in (canonical_a, canonical_b);

  insert into public.ai_matching_runs (
    requested_by,
    selected_user_id,
    status,
    candidate_count,
    overall_score,
    model,
    algorithm_version,
    input_hash,
    match_id
  ) values (
    p_requested_by,
    p_selected_user,
    'proposed',
    p_candidate_count,
    p_overall_score,
    trim(p_model),
    trim(p_algorithm_version),
    p_input_hash,
    match_id
  ) returning id into run_id;

  insert into public.audit_events (
    actor_id,
    event_name,
    subject_type,
    subject_id,
    metadata
  ) values (
    null,
    'ai_match_proposed',
    'match',
    match_id::text,
    jsonb_build_object(
      'matching_run_id', run_id,
      'model', trim(p_model),
      'algorithm_version', trim(p_algorithm_version),
      'overall_score', p_overall_score,
      'candidate_count', p_candidate_count
    )
  );

  return match_id;
end;
$$;

revoke all on function public.service_create_ai_match(
  uuid, uuid, jsonb, smallint, jsonb, text[], text[], text, text, text, smallint
) from public;
grant execute on function public.service_create_ai_match(
  uuid, uuid, jsonb, smallint, jsonb, text[], text[], text, text, text, smallint
) to service_role;

-- Human operations retain document, profile, safety and handoff review, but no
-- longer have permission to choose buyer pairs.
revoke execute on function public.admin_propose_match(
  uuid, uuid, jsonb, smallint, smallint, text
) from authenticated;
