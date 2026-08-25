create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'buyer' check (role in ('buyer', 'admin')),
  first_name text check (char_length(first_name) between 1 and 60),
  age_band text check (age_band is null or age_band in ('25–29', '30–34', '35–39', '40–44', '45–49')),
  occupation_sector text check (occupation_sector is null or char_length(occupation_sector) <= 80),
  onboarding_step smallint not null default 0 check (onboarding_step between 0 and 6),
  onboarding_status text not null default 'draft' check (onboarding_status in ('draft', 'ready_for_review', 'under_review', 'approved', 'changes_requested', 'paused')),
  matching_status text not null default 'not_ready' check (matching_status in ('not_ready', 'ready', 'proposed', 'introduced', 'paused')),
  identity_status text not null default 'not_started' check (identity_status in ('not_started', 'pending', 'verified', 'failed', 'expired')),
  terms_accepted_at timestamptz,
  privacy_accepted_at timestamptz,
  last_active_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contact_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  email text,
  phone text,
  preferred_channel text not null default 'email' check (preferred_channel in ('email', 'phone')),
  updated_at timestamptz not null default now()
);

create table public.buyer_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  first_time_buyer boolean not null default false,
  irish_resident boolean not null default false,
  owner_occupier boolean not null default false,
  open_to_unrelated_cobuyer boolean not null default false,
  buying_as_pair_only boolean not null default true,
  purchase_timeline text check (purchase_timeline is null or purchase_timeline in ('3–6 months', '6–12 months', '12–18 months')),
  income_range text,
  deposit_range text,
  borrowing_range text,
  monthly_housing_budget_range text,
  target_locations text[] not null default '{}',
  property_types text[] not null default '{}',
  must_haves text[] not null default '{}',
  household_preferences jsonb not null default '{}'::jsonb,
  future_plans jsonb not null default '{}'::jsonb,
  ownership_expectations jsonb not null default '{}'::jsonb,
  bio text check (bio is null or char_length(bio) <= 600),
  risk_acknowledged_at timestamptz,
  ready_for_review_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.document_requirements (
  id text primary key,
  label text not null,
  description text not null,
  category text not null check (category in ('identity', 'income', 'banking', 'deposit', 'commitments')),
  required boolean not null default true,
  applies_when text,
  validity_days integer check (validity_days is null or validity_days > 0),
  accepted_mime_types text[] not null default array['application/pdf', 'image/jpeg', 'image/png'],
  sort_order smallint not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.document_requirements (id, label, description, category, required, applies_when, validity_days, sort_order)
values
  ('photo-id', 'Photo identification', 'Current passport or driving licence.', 'identity', true, null, null, 10),
  ('proof-address', 'Proof of address', 'A recent utility bill, bank statement, or official correspondence.', 'identity', true, null, 180, 20),
  ('payslips', 'Recent payslips', 'Your three most recent payslips, combined into one file where possible.', 'income', true, 'Employed applicants', 90, 30),
  ('salary-certificate', 'Salary certificate', 'A current employer-completed salary certificate if your broker requests one.', 'income', true, 'Employed applicants', 90, 40),
  ('revenue-summary', 'Revenue employment summary', 'Your latest Employment Detail Summary or equivalent Revenue record.', 'income', true, null, 365, 50),
  ('bank-statements', 'Current-account statements', 'Recent statements for the accounts your broker needs to review.', 'banking', true, null, 90, 60),
  ('savings-statements', 'Savings and deposit evidence', 'Recent statements showing the funds intended for the purchase.', 'deposit', true, null, 90, 70),
  ('loan-statements', 'Loan and credit statements', 'Statements for active loans or credit commitments.', 'commitments', false, 'If applicable', 90, 80),
  ('gift-letter', 'Gifted-deposit evidence', 'Gift letter and supporting evidence requested by your broker or solicitor.', 'deposit', false, 'If applicable', 180, 90);

create table public.buyer_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  requirement_id text not null references public.document_requirements(id),
  storage_path text not null unique,
  original_filename text not null check (char_length(original_filename) between 1 and 180),
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  status text not null default 'uploaded' check (status in ('uploaded', 'under_review', 'accepted', 'needs_update', 'expired')),
  expiry_date date,
  review_note text check (review_note is null or char_length(review_note) <= 500),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index buyer_documents_user_id_idx on public.buyer_documents(user_id);
create index buyer_documents_requirement_id_idx on public.buyer_documents(requirement_id);
create index buyer_documents_reviewed_by_idx on public.buyer_documents(reviewed_by);

create table public.document_shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  recipient_type text not null check (recipient_type in ('mortgage_broker', 'solicitor')),
  provider_name text not null check (char_length(provider_name) between 2 and 120),
  document_ids uuid[] not null,
  status text not null default 'requested' check (status in ('requested', 'shared', 'revoked', 'expired')),
  consented_at timestamptz not null default now(),
  fulfilled_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index document_shares_user_id_idx on public.document_shares(user_id);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'proposed' check (status in ('proposed', 'mutual_interest', 'declined', 'expired', 'unlocked', 'closed')),
  compatibility jsonb not null default '{}'::jsonb,
  rules_passed smallint not null default 0 check (rules_passed >= 0),
  rules_total smallint not null default 0 check (rules_total >= rules_passed),
  admin_note text not null check (char_length(admin_note) between 10 and 2000),
  proposed_by uuid not null references public.profiles(id),
  proposed_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  updated_at timestamptz not null default now(),
  check (user_a < user_b),
  unique (user_a, user_b)
);

create index matches_user_a_idx on public.matches(user_a);
create index matches_user_b_idx on public.matches(user_b);
create index matches_proposed_by_idx on public.matches(proposed_by);
create unique index matches_one_active_user_a_idx on public.matches(user_a) where status in ('proposed', 'mutual_interest', 'unlocked');
create unique index matches_one_active_user_b_idx on public.matches(user_b) where status in ('proposed', 'mutual_interest', 'unlocked');

create table public.match_decisions (
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  decision text not null check (decision in ('interested', 'declined')),
  decided_at timestamptz not null default now(),
  primary key (match_id, user_id)
);

create index match_decisions_user_id_idx on public.match_decisions(user_id);

create table public.introductions (
  match_id uuid primary key references public.matches(id) on delete cascade,
  status text not null default 'gates_pending' check (status in ('gates_pending', 'unlocked', 'handoff_ready', 'closed')),
  identity_a_status text not null default 'not_started' check (identity_a_status in ('not_started', 'pending', 'verified', 'failed', 'expired')),
  identity_b_status text not null default 'not_started' check (identity_b_status in ('not_started', 'pending', 'verified', 'failed', 'expired')),
  payment_a_status text not null default 'not_started' check (payment_a_status in ('not_started', 'pending', 'paid', 'refunded', 'failed')),
  payment_b_status text not null default 'not_started' check (payment_b_status in ('not_started', 'pending', 'paid', 'refunded', 'failed')),
  contact_unlocked_at timestamptz,
  broker_handoff_status text not null default 'not_started' check (broker_handoff_status in ('not_started', 'consented', 'sent', 'accepted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.alignment_responses (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  module text not null check (module in ('money', 'ownership', 'exit', 'missed_payments', 'household', 'repairs')),
  question_id text not null,
  response jsonb not null,
  share_with_match boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (match_id, user_id, question_id)
);

create index alignment_responses_match_id_idx on public.alignment_responses(match_id);
create index alignment_responses_user_id_idx on public.alignment_responses(user_id);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid references public.profiles(id) on delete set null,
  match_id uuid references public.matches(id) on delete set null,
  reason text not null check (char_length(reason) between 10 and 1000),
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index reports_reporter_id_idx on public.reports(reporter_id);
create index reports_reported_user_id_idx on public.reports(reported_user_id);
create index reports_match_id_idx on public.reports(match_id);

create table public.analytics_events (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete set null,
  event_name text not null check (char_length(event_name) between 2 and 80),
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index analytics_events_user_id_idx on public.analytics_events(user_id);
create index analytics_events_created_at_idx on public.analytics_events(created_at);

create table public.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  event_name text not null,
  subject_type text not null,
  subject_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_events_actor_id_idx on public.audit_events(actor_id);
create index audit_events_created_at_idx on public.audit_events(created_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger contact_preferences_set_updated_at before update on public.contact_preferences for each row execute function public.set_updated_at();
create trigger buyer_preferences_set_updated_at before update on public.buyer_preferences for each row execute function public.set_updated_at();
create trigger matches_set_updated_at before update on public.matches for each row execute function public.set_updated_at();
create trigger introductions_set_updated_at before update on public.introductions for each row execute function public.set_updated_at();
create trigger alignment_responses_set_updated_at before update on public.alignment_responses for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, first_name)
  values (new.id, nullif(trim(new.raw_user_meta_data ->> 'first_name'), ''));

  insert into public.contact_preferences (user_id, email)
  values (new.id, new.email);

  insert into public.buyer_preferences (user_id)
  values (new.id);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

create or replace function public.sync_match_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  interested_count integer;
  declined_count integer;
begin
  select
    count(*) filter (where decision = 'interested'),
    count(*) filter (where decision = 'declined')
  into interested_count, declined_count
  from public.match_decisions
  where match_id = new.match_id;

  if declined_count > 0 then
    update public.matches set status = 'declined' where id = new.match_id;
  elsif interested_count = 2 then
    update public.matches set status = 'mutual_interest' where id = new.match_id;
    insert into public.introductions (match_id) values (new.match_id)
    on conflict (match_id) do nothing;
  end if;

  return new;
end;
$$;

create trigger match_decision_sync
  after insert or update on public.match_decisions
  for each row execute function public.sync_match_state();

create or replace function public.sync_introduction_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.identity_a_status = 'verified'
    and new.identity_b_status = 'verified'
    and new.payment_a_status = 'paid'
    and new.payment_b_status = 'paid'
    and new.contact_unlocked_at is null then
      new.status = 'unlocked';
      new.contact_unlocked_at = now();
      update public.matches set status = 'unlocked' where id = new.match_id;
  end if;
  return new;
end;
$$;

create trigger introduction_state_sync
  before update on public.introductions
  for each row execute function public.sync_introduction_state();

create or replace function public.admin_review_profile(p_user_id uuid, p_status text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if p_status not in ('under_review', 'approved', 'changes_requested', 'paused') then raise exception 'Invalid status'; end if;

  update public.profiles
  set onboarding_status = p_status,
      matching_status = case when p_status = 'approved' then 'ready' else matching_status end
  where id = p_user_id;

  insert into public.audit_events (actor_id, event_name, subject_type, subject_id, metadata)
  values ((select auth.uid()), 'profile_reviewed', 'profile', p_user_id::text, jsonb_build_object('status', p_status, 'note', p_note));
end;
$$;

create or replace function public.admin_review_document(p_document_id uuid, p_status text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if p_status not in ('under_review', 'accepted', 'needs_update', 'expired') then raise exception 'Invalid status'; end if;

  update public.buyer_documents
  set status = p_status, review_note = p_note, reviewed_by = (select auth.uid()), reviewed_at = now()
  where id = p_document_id;

  insert into public.audit_events (actor_id, event_name, subject_type, subject_id, metadata)
  values ((select auth.uid()), 'document_reviewed', 'buyer_document', p_document_id::text, jsonb_build_object('status', p_status));
end;
$$;

create or replace function public.admin_propose_match(p_user_one uuid, p_user_two uuid, p_compatibility jsonb, p_rules_passed smallint, p_rules_total smallint, p_admin_note text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  match_id uuid;
  canonical_a uuid := least(p_user_one, p_user_two);
  canonical_b uuid := greatest(p_user_one, p_user_two);
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if p_user_one = p_user_two then raise exception 'A member cannot be matched with themselves'; end if;
  if char_length(p_admin_note) < 10 then raise exception 'An internal review note is required'; end if;
  if exists (
    select 1 from public.matches
    where status in ('proposed', 'mutual_interest', 'unlocked')
      and (p_user_one in (user_a, user_b) or p_user_two in (user_a, user_b))
  ) then raise exception 'Each member can have only one active proposal'; end if;

  insert into public.matches (user_a, user_b, compatibility, rules_passed, rules_total, admin_note, proposed_by)
  values (canonical_a, canonical_b, p_compatibility, p_rules_passed, p_rules_total, p_admin_note, (select auth.uid()))
  returning id into match_id;

  update public.profiles set matching_status = 'proposed' where id in (canonical_a, canonical_b);

  insert into public.audit_events (actor_id, event_name, subject_type, subject_id)
  values ((select auth.uid()), 'match_proposed', 'match', match_id::text);

  return match_id;
end;
$$;

create or replace function public.revoke_document_share(p_share_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.document_shares
  set status = 'revoked', revoked_at = now()
  where id = p_share_id and user_id = (select auth.uid()) and status in ('requested', 'shared');

  if not found then raise exception 'Share not found or cannot be revoked'; end if;
end;
$$;

create or replace function public.get_match_document_readiness(p_match_id uuid)
returns table (user_id uuid, first_name text, accepted_count bigint, required_count bigint, readiness_percent integer, is_ready boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() and not exists (
    select 1 from public.matches m
    where m.id = p_match_id and (select auth.uid()) in (m.user_a, m.user_b)
  ) then raise exception 'Not authorised'; end if;

  return query
  with participants as (
    select m.user_a as id from public.matches m where m.id = p_match_id
    union all
    select m.user_b as id from public.matches m where m.id = p_match_id
  ), required as (
    select count(*)::bigint as total from public.document_requirements where active and required
  )
  select p.id, p.first_name,
    count(distinct bd.requirement_id) filter (where bd.status = 'accepted' and (bd.expiry_date is null or bd.expiry_date >= current_date))::bigint,
    r.total,
    case when r.total = 0 then 0 else round(100.0 * count(distinct bd.requirement_id) filter (where bd.status = 'accepted' and (bd.expiry_date is null or bd.expiry_date >= current_date)) / r.total)::integer end,
    count(distinct bd.requirement_id) filter (where bd.status = 'accepted' and (bd.expiry_date is null or bd.expiry_date >= current_date)) = r.total
  from participants pp
  join public.profiles p on p.id = pp.id
  cross join required r
  left join public.buyer_documents bd on bd.user_id = p.id
  group by p.id, p.first_name, r.total;
end;
$$;

create or replace function public.get_unlocked_contact(p_match_id uuid)
returns table (first_name text, email text, phone text, preferred_channel text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.matches m
    join public.introductions i on i.match_id = m.id and i.status in ('unlocked', 'handoff_ready')
    where m.id = p_match_id and (select auth.uid()) in (m.user_a, m.user_b)
  ) then raise exception 'Contact details are still locked'; end if;

  return query
  select p.first_name, c.email, c.phone, c.preferred_channel
  from public.matches m
  join public.profiles p on p.id = case when m.user_a = (select auth.uid()) then m.user_b else m.user_a end
  join public.contact_preferences c on c.user_id = p.id
  where m.id = p_match_id;
end;
$$;

alter table public.profiles enable row level security;
alter table public.contact_preferences enable row level security;
alter table public.buyer_preferences enable row level security;
alter table public.document_requirements enable row level security;
alter table public.buyer_documents enable row level security;
alter table public.document_shares enable row level security;
alter table public.matches enable row level security;
alter table public.match_decisions enable row level security;
alter table public.introductions enable row level security;
alter table public.alignment_responses enable row level security;
alter table public.reports enable row level security;
alter table public.analytics_events enable row level security;
alter table public.audit_events enable row level security;

create policy profiles_select_own_or_admin on public.profiles for select to authenticated
using ((select auth.uid()) = id or (select public.is_admin()));
create policy profiles_update_own on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id and onboarding_status in ('draft', 'ready_for_review'));

create policy contact_select_own_or_admin on public.contact_preferences for select to authenticated
using ((select auth.uid()) = user_id or (select public.is_admin()));
create policy contact_update_own on public.contact_preferences for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy preferences_select_own_or_admin on public.buyer_preferences for select to authenticated
using ((select auth.uid()) = user_id or (select public.is_admin()));
create policy preferences_update_own on public.buyer_preferences for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy requirements_select_authenticated on public.document_requirements for select to authenticated using (true);

create policy documents_select_own_or_admin on public.buyer_documents for select to authenticated
using ((select auth.uid()) = user_id or (select public.is_admin()));
create policy documents_insert_own on public.buyer_documents for insert to authenticated
with check ((select auth.uid()) = user_id and storage_path like ((select auth.uid())::text || '/%'));
create policy documents_delete_own on public.buyer_documents for delete to authenticated
using ((select auth.uid()) = user_id);

create policy shares_select_own_or_admin on public.document_shares for select to authenticated
using ((select auth.uid()) = user_id or (select public.is_admin()));
create policy shares_insert_own on public.document_shares for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy matches_select_participant_or_admin on public.matches for select to authenticated
using ((select auth.uid()) in (user_a, user_b) or (select public.is_admin()));

create policy decisions_select_participant_or_admin on public.match_decisions for select to authenticated
using ((select public.is_admin()) or exists (select 1 from public.matches m where m.id = match_id and (select auth.uid()) in (m.user_a, m.user_b)));
create policy decisions_insert_own on public.match_decisions for insert to authenticated
with check ((select auth.uid()) = user_id and exists (select 1 from public.matches m where m.id = match_id and (select auth.uid()) in (m.user_a, m.user_b) and m.status = 'proposed'));

create policy introductions_select_participant_or_admin on public.introductions for select to authenticated
using ((select public.is_admin()) or exists (select 1 from public.matches m where m.id = match_id and (select auth.uid()) in (m.user_a, m.user_b)));

create policy alignment_select on public.alignment_responses for select to authenticated
using ((select public.is_admin()) or (select auth.uid()) = user_id or (share_with_match and exists (select 1 from public.matches m where m.id = match_id and (select auth.uid()) in (m.user_a, m.user_b))));
create policy alignment_insert_own on public.alignment_responses for insert to authenticated
with check ((select auth.uid()) = user_id and exists (select 1 from public.matches m where m.id = match_id and (select auth.uid()) in (m.user_a, m.user_b)));
create policy alignment_update_own on public.alignment_responses for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy alignment_delete_own on public.alignment_responses for delete to authenticated
using ((select auth.uid()) = user_id);

create policy reports_select_own_or_admin on public.reports for select to authenticated
using ((select auth.uid()) = reporter_id or (select public.is_admin()));
create policy reports_insert_own on public.reports for insert to authenticated
with check ((select auth.uid()) = reporter_id);

create policy analytics_select_own_or_admin on public.analytics_events for select to authenticated
using ((select auth.uid()) = user_id or (select public.is_admin()));
create policy analytics_insert_own on public.analytics_events for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy audit_select_admin on public.audit_events for select to authenticated using ((select public.is_admin()));

revoke all on all tables in schema public from anon, authenticated;
grant select on public.profiles, public.contact_preferences, public.buyer_preferences, public.document_requirements, public.buyer_documents, public.document_shares, public.matches, public.match_decisions, public.introductions, public.alignment_responses, public.reports, public.analytics_events to authenticated;
grant update (first_name, age_band, occupation_sector, onboarding_step, onboarding_status, terms_accepted_at, privacy_accepted_at, last_active_at) on public.profiles to authenticated;
grant update (email, phone, preferred_channel) on public.contact_preferences to authenticated;
grant update, insert, delete on public.buyer_preferences to authenticated;
grant insert, delete on public.buyer_documents to authenticated;
grant insert on public.document_shares to authenticated;
grant insert on public.match_decisions to authenticated;
grant insert, update, delete on public.alignment_responses to authenticated;
grant insert on public.reports to authenticated;
grant insert on public.analytics_events to authenticated;
grant usage, select on sequence public.analytics_events_id_seq to authenticated;

revoke all on function public.admin_review_profile(uuid, text, text) from public;
revoke all on function public.admin_review_document(uuid, text, text) from public;
revoke all on function public.admin_propose_match(uuid, uuid, jsonb, smallint, smallint, text) from public;
revoke all on function public.get_match_document_readiness(uuid) from public;
revoke all on function public.get_unlocked_contact(uuid) from public;
revoke all on function public.revoke_document_share(uuid) from public;
grant execute on function public.admin_review_profile(uuid, text, text) to authenticated;
grant execute on function public.admin_review_document(uuid, text, text) to authenticated;
grant execute on function public.admin_propose_match(uuid, uuid, jsonb, smallint, smallint, text) to authenticated;
grant execute on function public.get_match_document_readiness(uuid) to authenticated;
grant execute on function public.get_unlocked_contact(uuid) to authenticated;
grant execute on function public.revoke_document_share(uuid) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('buyer-documents', 'buyer-documents', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy buyer_document_objects_select on storage.objects for select to authenticated
using (
  bucket_id = 'buyer-documents'
  and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin()))
);
create policy buyer_document_objects_insert on storage.objects for insert to authenticated
with check (bucket_id = 'buyer-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy buyer_document_objects_update on storage.objects for update to authenticated
using (bucket_id = 'buyer-documents' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'buyer-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy buyer_document_objects_delete on storage.objects for delete to authenticated
using (bucket_id = 'buyer-documents' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin())));
