-- Production-readiness invariants for onboarding, operations, safety, sharing,
-- matching, and Stripe lifecycle processing.

alter table public.profiles
  add column if not exists onboarding_review_note text,
  add column if not exists terms_version text,
  add column if not exists privacy_version text,
  add column if not exists risk_version text,
  add column if not exists profile_submitted_at timestamptz;

update public.profiles
set onboarding_status = 'changes_requested',
    matching_status = 'not_ready',
    onboarding_review_note = 'Please review the complete profile and explicitly accept the current pilot terms, privacy notice, and risk acknowledgement.'
where role = 'buyer'
  and onboarding_status in ('ready_for_review', 'under_review', 'approved')
  and (
    terms_version is distinct from '2026-08-26'
    or privacy_version is distinct from '2026-08-26'
    or risk_version is distinct from '2026-08-26'
    or profile_submitted_at is null
    or terms_accepted_at is null
    or privacy_accepted_at is null
    or not exists (
      select 1 from public.buyer_preferences b
      where b.user_id = profiles.id and b.risk_acknowledged_at is not null
    )
  );

alter table public.reports
  add column if not exists resolution_note text,
  add column if not exists resolved_by uuid references public.profiles(id) on delete set null;

alter table public.introductions
  add column if not exists checkout_session_a_id text,
  add column if not exists checkout_session_b_id text,
  add column if not exists identity_session_a_id text,
  add column if not exists identity_session_b_id text;

alter table public.matches
  drop constraint if exists matches_user_a_user_b_key;

create unique index if not exists matches_one_active_pair_uidx
  on public.matches(user_a, user_b)
  where status in ('proposed', 'mutual_interest', 'unlocked');

alter table public.buyer_documents
  drop constraint if exists buyer_documents_reviewed_by_fkey,
  add constraint buyer_documents_reviewed_by_fkey
    foreign key (reviewed_by) references public.profiles(id) on delete restrict;

update public.buyer_documents
set status = 'under_review',
    expiry_date = null,
    review_note = 'Administrative review is required before this document can count toward readiness.',
    reviewed_by = null,
    reviewed_at = null
where status = 'accepted'
  and not exists (
    select 1
    from public.audit_events a
    join public.profiles reviewer on reviewer.id = a.actor_id and reviewer.role = 'admin'
    where a.event_name = 'document_reviewed'
      and a.subject_type = 'buyer_document'
      and a.subject_id = buyer_documents.id::text
      and a.metadata ->> 'status' = 'accepted'
      and a.actor_id = buyer_documents.reviewed_by
      and a.created_at <= buyer_documents.reviewed_at
  );

alter table public.buyer_documents
  drop constraint if exists buyer_documents_accepted_review_provenance,
  add constraint buyer_documents_accepted_review_provenance
    check (status <> 'accepted' or (reviewed_by is not null and reviewed_at is not null))
    not valid;

alter table public.buyer_documents
  validate constraint buyer_documents_accepted_review_provenance;

alter table public.introductions
  drop constraint if exists introductions_distinct_checkout_sessions,
  add constraint introductions_distinct_checkout_sessions
    check (checkout_session_a_id is null or checkout_session_b_id is null or checkout_session_a_id <> checkout_session_b_id),
  drop constraint if exists introductions_distinct_identity_sessions,
  add constraint introductions_distinct_identity_sessions
    check (identity_session_a_id is null or identity_session_b_id is null or identity_session_a_id <> identity_session_b_id);

create unique index if not exists introductions_checkout_session_a_uidx
  on public.introductions(checkout_session_a_id)
  where checkout_session_a_id is not null;
create unique index if not exists introductions_checkout_session_b_uidx
  on public.introductions(checkout_session_b_id)
  where checkout_session_b_id is not null;
create unique index if not exists introductions_identity_session_a_uidx
  on public.introductions(identity_session_a_id)
  where identity_session_a_id is not null;
create unique index if not exists introductions_identity_session_b_uidx
  on public.introductions(identity_session_b_id)
  where identity_session_b_id is not null;

create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  object_id text not null,
  processed_at timestamptz not null default now()
);

alter table public.stripe_webhook_events enable row level security;
revoke all on public.stripe_webhook_events from anon, authenticated;

create or replace function public.profile_is_complete(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join public.buyer_preferences b on b.user_id = p.id
    where p.id = p_user_id
      and nullif(trim(p.first_name), '') is not null
      and p.age_band is not null
      and b.first_time_buyer
      and b.irish_resident
      and b.owner_occupier
      and b.open_to_unrelated_cobuyer
      and b.buying_as_pair_only
      and b.purchase_timeline is not null
      and nullif(trim(b.income_range), '') is not null
      and nullif(trim(b.deposit_range), '') is not null
      and nullif(trim(b.borrowing_range), '') is not null
      and nullif(trim(b.monthly_housing_budget_range), '') is not null
      and cardinality(b.target_locations) > 0
      and cardinality(b.property_types) > 0
      and nullif(trim(b.household_preferences ->> 'noise'), '') is not null
      and nullif(trim(b.household_preferences ->> 'workFromHome'), '') is not null
      and nullif(trim(b.household_preferences ->> 'guests'), '') is not null
      and nullif(trim(b.household_preferences ->> 'pets'), '') is not null
      and nullif(trim(b.ownership_expectations ->> 'horizon'), '') is not null
      and nullif(trim(b.ownership_expectations ->> 'shares'), '') is not null
      and nullif(trim(b.ownership_expectations ->> 'earlyExit'), '') is not null
      and nullif(trim(b.ownership_expectations ->> 'missedPayments'), '') is not null
  );
$$;

create or replace function public.profile_has_current_acceptance(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join public.buyer_preferences b on b.user_id = p.id
    where p.id = p_user_id
      and p.terms_version = '2026-08-26'
      and p.privacy_version = '2026-08-26'
      and p.risk_version = '2026-08-26'
      and p.profile_submitted_at is not null
      and p.terms_accepted_at is not null
      and p.privacy_accepted_at is not null
      and b.risk_acknowledged_at is not null
  );
$$;

create or replace function public.member_documents_ready(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1
    from public.document_requirements r
    where r.active
      and r.required
      and not exists (
        select 1 from public.buyer_documents d
        where d.id = (
          select latest.id
          from public.buyer_documents latest
          where latest.user_id = p_user_id and latest.requirement_id = r.id
          order by latest.created_at desc, latest.id desc
          limit 1
        )
        and d.status = 'accepted'
        and (d.expiry_date is null or d.expiry_date >= current_date)
      )
  );
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
    where m.id = p_match_id
      and m.status in ('proposed', 'mutual_interest', 'unlocked')
      and (select auth.uid()) in (m.user_a, m.user_b)
  ) then raise exception 'Not authorised'; end if;

  return query
  with participants as (
    select m.user_a as id from public.matches m
    where m.id = p_match_id and (public.is_admin() or m.status in ('proposed', 'mutual_interest', 'unlocked'))
    union all
    select m.user_b as id from public.matches m
    where m.id = p_match_id and (public.is_admin() or m.status in ('proposed', 'mutual_interest', 'unlocked'))
  ), required as (
    select count(*)::bigint as total
    from public.document_requirements
    where active and required
  ), latest as (
    select distinct on (d.user_id, d.requirement_id)
      d.user_id, d.requirement_id, d.status, d.expiry_date
    from public.buyer_documents d
    order by d.user_id, d.requirement_id, d.created_at desc, d.id desc
  )
  select p.id, p.first_name,
    count(l.requirement_id) filter (
      where r.active and r.required and l.status = 'accepted'
        and (l.expiry_date is null or l.expiry_date >= current_date)
    )::bigint,
    totals.total,
    case when totals.total = 0 then 0 else round(
      100.0 * count(l.requirement_id) filter (
        where r.active and r.required and l.status = 'accepted'
          and (l.expiry_date is null or l.expiry_date >= current_date)
      ) / totals.total
    )::integer end,
    count(l.requirement_id) filter (
      where r.active and r.required and l.status = 'accepted'
        and (l.expiry_date is null or l.expiry_date >= current_date)
    ) = totals.total
  from participants pp
  join public.profiles p on p.id = pp.id
  cross join required totals
  left join latest l on l.user_id = p.id
  left join public.document_requirements r on r.id = l.requirement_id
  group by p.id, p.first_name, totals.total;
end;
$$;

create or replace function public.refresh_member_matching_status(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_status text;
  eligible boolean;
  is_paused boolean;
  active_match record;
  counterpart uuid;
begin
  select exists (
    select 1 from public.profiles
    where id = p_user_id and onboarding_status = 'paused'
  ) into is_paused;

  select exists (
    select 1 from public.profiles
    where id = p_user_id
      and onboarding_status = 'approved'
      and public.profile_is_complete(p_user_id)
      and public.profile_has_current_acceptance(p_user_id)
      and public.member_documents_ready(p_user_id)
  ) into eligible;

  if is_paused or exists (
    select 1 from public.reports
    where reported_user_id = p_user_id and status in ('open', 'reviewing')
  ) then
    next_status := 'paused';
    eligible := false;
  elsif not eligible then
    next_status := 'not_ready';
  end if;

  if not eligible then
    for active_match in
      select id, user_a, user_b
      from public.matches
      where p_user_id in (user_a, user_b)
        and status in ('proposed', 'mutual_interest', 'unlocked')
      order by id
      for update
    loop
      update public.matches set status = 'closed' where id = active_match.id;
      update public.introductions set status = 'closed' where match_id = active_match.id;
      counterpart := case when active_match.user_a = p_user_id then active_match.user_b else active_match.user_a end;
      perform public.refresh_member_matching_status(counterpart);
    end loop;
  elsif exists (
    select 1 from public.matches
    where p_user_id in (user_a, user_b) and status in ('mutual_interest', 'unlocked')
  ) then
    next_status := 'introduced';
  elsif exists (
    select 1 from public.matches
    where p_user_id in (user_a, user_b) and status = 'proposed'
  ) then
    next_status := 'proposed';
  else
    next_status := 'ready';
  end if;

  update public.profiles set matching_status = next_status where id = p_user_id;
end;
$$;

create or replace function public.match_participants_eligible(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.matches m
    where m.id = p_match_id
      and m.status in ('proposed', 'mutual_interest', 'unlocked')
      and (
        select count(*)
        from public.profiles p
        where p.id in (m.user_a, m.user_b)
          and p.onboarding_status = 'approved'
          and public.profile_is_complete(p.id)
          and public.profile_has_current_acceptance(p.id)
          and public.member_documents_ready(p.id)
      ) = 2
      and not exists (
        select 1
        from public.reports r
        where r.reported_user_id in (m.user_a, m.user_b)
          and r.status in ('open', 'reviewing')
      )
  );
$$;

create or replace function public.match_participants_are_ready(p_match_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() and not exists (
    select 1 from public.matches m
    where m.id = p_match_id and (select auth.uid()) in (m.user_a, m.user_b)
  ) then
    raise exception 'Not authorised';
  end if;
  return public.match_participants_eligible(p_match_id);
end;
$$;

create or replace function public.expire_stale_matches()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  stale record;
  expired_count integer := 0;
begin
  if (select auth.uid()) is null and current_user <> 'service_role' then
    raise exception 'Sign in required';
  end if;

  for stale in
    select id, user_a, user_b
    from public.matches
    where status = 'proposed' and expires_at <= now()
    order by id
    for update
  loop
    update public.matches set status = 'expired' where id = stale.id;
    perform public.refresh_member_matching_status(stale.user_a);
    perform public.refresh_member_matching_status(stale.user_b);
    expired_count := expired_count + 1;
  end loop;

  for stale in
    select id, user_a, user_b
    from public.matches
    where status in ('proposed', 'mutual_interest', 'unlocked')
      and not public.match_participants_eligible(id)
    order by id
    for update
  loop
    update public.matches set status = 'closed' where id = stale.id;
    update public.introductions set status = 'closed' where match_id = stale.id;
    perform public.refresh_member_matching_status(stale.user_a);
    perform public.refresh_member_matching_status(stale.user_b);
    expired_count := expired_count + 1;
  end loop;

  return expired_count;
end;
$$;

create or replace function public.submit_profile_for_review(
  p_terms_version text,
  p_privacy_version text,
  p_risk_version text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then raise exception 'Sign in required'; end if;
  if p_terms_version <> '2026-08-26'
    or p_privacy_version <> '2026-08-26'
    or p_risk_version <> '2026-08-26' then
    raise exception 'Please review and accept the current notices';
  end if;
  if not public.profile_is_complete(current_user_id) then
    raise exception 'Complete every required profile field before review';
  end if;

  update public.profiles
  set onboarding_step = 6,
      onboarding_status = 'ready_for_review',
      matching_status = 'not_ready',
      onboarding_review_note = null,
      terms_accepted_at = now(),
      privacy_accepted_at = now(),
      terms_version = p_terms_version,
      privacy_version = p_privacy_version,
      risk_version = p_risk_version,
      profile_submitted_at = now(),
      last_active_at = now()
  where id = current_user_id
    and onboarding_status in ('draft', 'changes_requested', 'ready_for_review');

  if not found then raise exception 'This profile cannot be submitted in its current state'; end if;

  update public.buyer_preferences
  set risk_acknowledged_at = now(), ready_for_review_at = now()
  where buyer_preferences.user_id = current_user_id;

  if not found then raise exception 'Buyer preferences were not found'; end if;

  insert into public.audit_events (actor_id, event_name, subject_type, subject_id, metadata)
  values (
    current_user_id,
    'profile_submitted',
    'profile',
    current_user_id::text,
    jsonb_build_object(
      'terms_version', p_terms_version,
      'privacy_version', p_privacy_version,
      'risk_version', p_risk_version
    )
  );
end;
$$;

create or replace function public.invalidate_profile_submission_on_profile_edit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'buyer'
    and old.onboarding_status = 'ready_for_review'
    and (
      new.first_name is distinct from old.first_name
      or new.age_band is distinct from old.age_band
      or new.occupation_sector is distinct from old.occupation_sector
    ) then
      new.onboarding_status := 'draft';
      new.matching_status := 'not_ready';
      new.onboarding_review_note := 'Profile details changed after submission. Review the current notices and resubmit.';
      new.terms_accepted_at := null;
      new.privacy_accepted_at := null;
      new.terms_version := null;
      new.privacy_version := null;
      new.risk_version := null;
      new.profile_submitted_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists profile_submission_invalidation on public.profiles;
create trigger profile_submission_invalidation
  before update on public.profiles
  for each row execute function public.invalidate_profile_submission_on_profile_edit();

create or replace function public.invalidate_profile_submission_on_preferences_edit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.profiles p
    where p.id = new.user_id and p.onboarding_status = 'ready_for_review'
  ) and (
    new.first_time_buyer is distinct from old.first_time_buyer
    or new.irish_resident is distinct from old.irish_resident
    or new.owner_occupier is distinct from old.owner_occupier
    or new.open_to_unrelated_cobuyer is distinct from old.open_to_unrelated_cobuyer
    or new.buying_as_pair_only is distinct from old.buying_as_pair_only
    or new.purchase_timeline is distinct from old.purchase_timeline
    or new.income_range is distinct from old.income_range
    or new.deposit_range is distinct from old.deposit_range
    or new.borrowing_range is distinct from old.borrowing_range
    or new.monthly_housing_budget_range is distinct from old.monthly_housing_budget_range
    or new.target_locations is distinct from old.target_locations
    or new.property_types is distinct from old.property_types
    or new.must_haves is distinct from old.must_haves
    or new.household_preferences is distinct from old.household_preferences
    or new.future_plans is distinct from old.future_plans
    or new.ownership_expectations is distinct from old.ownership_expectations
    or new.bio is distinct from old.bio
  ) then
    update public.profiles
    set onboarding_status = 'draft',
        matching_status = 'not_ready',
        onboarding_review_note = 'Profile details changed after submission. Review the current notices and resubmit.',
        terms_accepted_at = null,
        privacy_accepted_at = null,
        terms_version = null,
        privacy_version = null,
        risk_version = null,
        profile_submitted_at = null
    where id = new.user_id and onboarding_status = 'ready_for_review';
    new.risk_acknowledged_at := null;
    new.ready_for_review_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists preferences_submission_invalidation on public.buyer_preferences;
create trigger preferences_submission_invalidation
  before update on public.buyer_preferences
  for each row execute function public.invalidate_profile_submission_on_preferences_edit();

create or replace function public.lock_document_owner_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid;
begin
  if tg_op = 'DELETE' then owner_id := old.user_id; else owner_id := new.user_id; end if;
  perform 1 from public.profiles where id = owner_id for update;
  if not found then raise exception 'Document owner was not found'; end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists document_owner_profile_lock on public.buyer_documents;
create trigger document_owner_profile_lock
  before insert or update or delete on public.buyer_documents
  for each row execute function public.lock_document_owner_profile();

create or replace function public.update_contact_preferences(
  p_email text,
  p_phone text,
  p_preferred_channel text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  clean_email text := lower(nullif(trim(p_email), ''));
  clean_phone text := nullif(trim(p_phone), '');
begin
  if current_user_id is null then raise exception 'Sign in required'; end if;
  if p_preferred_channel is null or p_preferred_channel not in ('email', 'phone') then
    raise exception 'Choose email or phone as your preferred contact method';
  end if;
  if clean_email is null or clean_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Enter a valid email address';
  end if;
  if clean_phone is not null and (char_length(clean_phone) < 7 or char_length(clean_phone) > 30) then
    raise exception 'Enter a valid phone number';
  end if;
  if p_preferred_channel = 'phone' and clean_phone is null then
    raise exception 'Add a phone number before choosing phone';
  end if;

  update public.contact_preferences
  set email = clean_email, phone = clean_phone, preferred_channel = p_preferred_channel
  where user_id = current_user_id;
  if not found then raise exception 'Contact preferences were not found'; end if;

  insert into public.audit_events (actor_id, event_name, subject_type, subject_id)
  values (current_user_id, 'contact_preferences_updated', 'profile', current_user_id::text);
end;
$$;

create or replace function public.admin_review_profile(
  p_user_id uuid,
  p_status text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status text;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if p_status is null or p_status not in ('under_review', 'approved', 'changes_requested', 'paused') then
    raise exception 'Invalid status';
  end if;
  if p_note is not null and char_length(trim(p_note)) > 1000 then
    raise exception 'Review note is too long';
  end if;
  if p_status in ('approved', 'changes_requested') and char_length(trim(coalesce(p_note, ''))) < 10 then
    raise exception 'A review note of at least 10 characters is required';
  end if;
  select onboarding_status into current_status
  from public.profiles
  where id = p_user_id
  for update;

  if current_status is null then raise exception 'Profile not found'; end if;
  if p_status = 'under_review'
    and current_status not in ('ready_for_review', 'under_review', 'approved') then
    raise exception 'The member must resubmit the current profile before review';
  end if;
  if p_status = 'approved' then
    if current_status not in ('ready_for_review', 'under_review', 'approved') then
      raise exception 'The member must resubmit the current profile before approval';
    end if;
    if not public.profile_is_complete(p_user_id) then
      raise exception 'The profile is incomplete';
    end if;
    if not public.profile_has_current_acceptance(p_user_id) then
      raise exception 'The member must accept the current notices before approval';
    end if;
  end if;

  update public.profiles
  set onboarding_status = p_status,
      onboarding_review_note = nullif(trim(p_note), ''),
      matching_status = case when p_status = 'paused' then 'paused' else matching_status end
  where id = p_user_id
    and onboarding_status in ('ready_for_review', 'under_review', 'approved', 'changes_requested', 'paused');

  if not found then raise exception 'Profile not found or cannot be reviewed'; end if;
  perform public.refresh_member_matching_status(p_user_id);

  insert into public.audit_events (actor_id, event_name, subject_type, subject_id, metadata)
  values (
    (select auth.uid()),
    'profile_reviewed',
    'profile',
    p_user_id::text,
    jsonb_build_object('status', p_status, 'note', p_note)
  );
end;
$$;

drop function if exists public.admin_review_document(uuid, text, text);

create function public.admin_review_document(
  p_document_id uuid,
  p_status text,
  p_note text default null,
  p_expiry_date date default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid;
  validity integer;
  current_document_status text;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if p_status is null or p_status not in ('under_review', 'accepted', 'needs_update', 'expired') then
    raise exception 'Invalid status';
  end if;
  if p_status in ('needs_update', 'expired') and char_length(trim(coalesce(p_note, ''))) < 5 then
    raise exception 'Explain what the member needs to update';
  end if;

  select d.user_id, r.validity_days, d.status
  into owner_id, validity, current_document_status
  from public.buyer_documents d
  join public.document_requirements r on r.id = d.requirement_id
  where d.id = p_document_id
  for update;

  if owner_id is null then raise exception 'Document not found'; end if;
  if p_status = 'under_review' and current_document_status not in ('uploaded', 'under_review') then
    raise exception 'Only a current upload can enter review';
  end if;
  if p_status = 'accepted' and current_document_status <> 'under_review' then
    raise exception 'Open the current upload for review before accepting it';
  end if;

  update public.buyer_documents
  set status = p_status,
      review_note = nullif(trim(p_note), ''),
      reviewed_by = (select auth.uid()),
      reviewed_at = now(),
      expiry_date = case
        when p_status <> 'accepted' then expiry_date
        when p_expiry_date is not null then p_expiry_date
        when validity is not null then current_date + validity
        else null
      end
  where id = p_document_id;

  perform public.refresh_member_matching_status(owner_id);

  insert into public.audit_events (actor_id, event_name, subject_type, subject_id, metadata)
  values (
    (select auth.uid()),
    'document_reviewed',
    'buyer_document',
    p_document_id::text,
    jsonb_build_object('status', p_status, 'expiry_date', p_expiry_date)
  );
end;
$$;

create or replace function public.prepare_document_removal(p_document_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  owner_id uuid;
  object_path text;
begin
  if current_user_id is null then raise exception 'Sign in required'; end if;

  select user_id, storage_path into owner_id, object_path
  from public.buyer_documents
  where id = p_document_id
  for update;

  if owner_id is null or owner_id <> current_user_id then
    raise exception 'Document not found';
  end if;

  update public.buyer_documents
  set status = 'needs_update',
      expiry_date = null,
      review_note = 'Removal requested by the member.'
  where id = p_document_id;

  update public.document_shares
  set status = 'revoked', revoked_at = now()
  where user_id = current_user_id
    and p_document_id = any(document_ids)
    and status in ('requested', 'shared');

  insert into public.audit_events (actor_id, event_name, subject_type, subject_id)
  values (current_user_id, 'document_removal_prepared', 'buyer_document', p_document_id::text);

  return object_path;
end;
$$;

create or replace function public.admin_propose_match(
  p_user_one uuid,
  p_user_two uuid,
  p_compatibility jsonb,
  p_rules_passed smallint,
  p_rules_total smallint,
  p_admin_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  match_id uuid;
  canonical_a uuid := least(p_user_one, p_user_two);
  canonical_b uuid := greatest(p_user_one, p_user_two);
  ready_count integer;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if p_user_one is null or p_user_two is null or p_user_one = p_user_two then
    raise exception 'Choose two different members';
  end if;
  if char_length(trim(coalesce(p_admin_note, ''))) < 10 then
    raise exception 'An internal review note is required';
  end if;
  if p_rules_total < 6 or p_rules_passed <> p_rules_total then
    raise exception 'Every required matching rule must pass';
  end if;

  perform 1 from public.profiles where id in (canonical_a, canonical_b) order by id for update;

  select count(*) into ready_count
  from public.profiles
  where id in (canonical_a, canonical_b)
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
    where reported_user_id in (canonical_a, canonical_b) and status in ('open', 'reviewing')
  ) then
    raise exception 'A safety report must be resolved before matching';
  end if;

  if exists (
    select 1 from public.matches
    where status in ('proposed', 'mutual_interest', 'unlocked')
      and (p_user_one in (user_a, user_b) or p_user_two in (user_a, user_b))
  ) then
    raise exception 'Each member can have only one active proposal';
  end if;

  insert into public.matches (
    user_a, user_b, compatibility, rules_passed, rules_total, admin_note, proposed_by
  )
  values (
    canonical_a, canonical_b, p_compatibility, p_rules_passed, p_rules_total,
    trim(p_admin_note), (select auth.uid())
  )
  returning id into match_id;

  update public.profiles set matching_status = 'proposed' where id in (canonical_a, canonical_b);

  insert into public.audit_events (actor_id, event_name, subject_type, subject_id)
  values ((select auth.uid()), 'match_proposed', 'match', match_id::text);

  return match_id;
end;
$$;

create or replace function public.submit_safety_report(
  p_match_id uuid,
  p_reported_user_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  reporter uuid := (select auth.uid());
  report_id uuid;
  match_record public.matches%rowtype;
begin
  if reporter is null then raise exception 'Sign in required'; end if;
  if char_length(trim(coalesce(p_reason, ''))) not between 10 and 1000 then
    raise exception 'Describe the concern in 10 to 1000 characters';
  end if;

  select * into match_record from public.matches where id = p_match_id for update;
  if match_record.id is null
    or reporter not in (match_record.user_a, match_record.user_b)
    or p_reported_user_id not in (match_record.user_a, match_record.user_b)
    or p_reported_user_id = reporter
    or match_record.status not in ('proposed', 'mutual_interest', 'unlocked') then
    raise exception 'This report is not valid for the selected match';
  end if;

  if exists (
    select 1 from public.reports
    where reporter_id = reporter
      and match_id = p_match_id
      and status in ('open', 'reviewing')
  ) then
    raise exception 'You already have an open report for this introduction';
  end if;

  insert into public.reports (reporter_id, reported_user_id, match_id, reason)
  values (reporter, p_reported_user_id, p_match_id, trim(p_reason))
  returning id into report_id;

  update public.matches set status = 'closed' where id = p_match_id;
  update public.introductions set status = 'closed' where match_id = p_match_id;
  update public.profiles set matching_status = 'paused' where id = p_reported_user_id;
  perform public.refresh_member_matching_status(reporter);

  insert into public.audit_events (actor_id, event_name, subject_type, subject_id, metadata)
  values (
    reporter,
    'safety_report_submitted',
    'report',
    report_id::text,
    jsonb_build_object('match_id', p_match_id, 'reported_user_id', p_reported_user_id)
  );

  return report_id;
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
    select 1
    from public.matches m
    join public.introductions i
      on i.match_id = m.id
      and i.status in ('unlocked', 'handoff_ready')
    where m.id = p_match_id
      and m.status = 'unlocked'
      and (select auth.uid()) in (m.user_a, m.user_b)
      and public.match_participants_eligible(m.id)
      and not exists (
        select 1 from public.reports r
        where r.match_id = m.id and r.status in ('open', 'reviewing')
      )
  ) then
    raise exception 'Contact details are still locked';
  end if;

  return query
  select p.first_name, c.email, c.phone, c.preferred_channel
  from public.matches m
  join public.profiles p
    on p.id = case when m.user_a = (select auth.uid()) then m.user_b else m.user_a end
  join public.contact_preferences c on c.user_id = p.id
  where m.id = p_match_id;
end;
$$;

create or replace function public.admin_resolve_report(
  p_report_id uuid,
  p_status text,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  reported_id uuid;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if p_status is null or p_status not in ('resolved', 'dismissed') then raise exception 'Invalid report outcome'; end if;
  if char_length(trim(coalesce(p_note, ''))) < 10 then
    raise exception 'A resolution note of at least 10 characters is required';
  end if;

  update public.reports
  set status = p_status,
      resolution_note = trim(p_note),
      resolved_by = (select auth.uid()),
      resolved_at = now()
  where id = p_report_id and status in ('open', 'reviewing')
  returning reported_user_id into reported_id;

  if not found then raise exception 'Report not found or already closed'; end if;
  if p_status = 'dismissed' and reported_id is not null then
    perform public.refresh_member_matching_status(reported_id);
  elsif p_status = 'resolved' and reported_id is not null then
    update public.profiles
    set onboarding_status = 'paused', matching_status = 'paused'
    where id = reported_id;
  end if;

  insert into public.audit_events (actor_id, event_name, subject_type, subject_id, metadata)
  values (
    (select auth.uid()),
    'safety_report_closed',
    'report',
    p_report_id::text,
    jsonb_build_object('status', p_status, 'note', p_note)
  );
end;
$$;

create or replace function public.request_document_share(
  p_recipient_type text,
  p_provider_name text,
  p_document_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  share_id uuid;
  valid_count integer;
  unique_count integer;
begin
  if current_user_id is null then raise exception 'Sign in required'; end if;
  if p_recipient_type is null or p_recipient_type not in ('mortgage_broker', 'solicitor') then
    raise exception 'Invalid professional type';
  end if;
  if char_length(trim(coalesce(p_provider_name, ''))) not between 2 and 120 then
    raise exception 'Professional name must be 2 to 120 characters';
  end if;
  if coalesce(cardinality(p_document_ids), 0) = 0 then
    raise exception 'Choose at least one accepted document';
  end if;

  select count(distinct item) into unique_count from unnest(p_document_ids) as item;
  if unique_count <> cardinality(p_document_ids) then raise exception 'Duplicate document IDs are not allowed'; end if;

  select count(*) into valid_count
  from public.buyer_documents d
  where d.id = any(p_document_ids)
    and d.user_id = current_user_id
    and d.status = 'accepted'
    and (d.expiry_date is null or d.expiry_date >= current_date)
    and not exists (
      select 1
      from public.buyer_documents newer
      where newer.user_id = d.user_id
        and newer.requirement_id = d.requirement_id
        and (newer.created_at, newer.id) > (d.created_at, d.id)
    );

  if valid_count <> cardinality(p_document_ids) then
    raise exception 'Every shared document must be yours, accepted, and current';
  end if;

  insert into public.document_shares (
    user_id, recipient_type, provider_name, document_ids
  )
  values (current_user_id, p_recipient_type, trim(p_provider_name), p_document_ids)
  returning id into share_id;

  insert into public.audit_events (actor_id, event_name, subject_type, subject_id, metadata)
  values (
    current_user_id,
    'document_share_requested',
    'document_share',
    share_id::text,
    jsonb_build_object('recipient_type', p_recipient_type, 'document_count', cardinality(p_document_ids))
  );

  return share_id;
end;
$$;

create or replace function public.admin_update_document_share(
  p_share_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid;
  shared_document_ids uuid[];
  valid_count integer;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if p_status is null or p_status not in ('shared', 'expired') then raise exception 'Invalid share status'; end if;

  select user_id, document_ids into owner_id, shared_document_ids
  from public.document_shares
  where id = p_share_id and status = 'requested'
  for update;
  if owner_id is null then raise exception 'Share request not found or already handled'; end if;

  if p_status = 'shared' then
    select count(*) into valid_count
    from public.buyer_documents d
    where d.id = any(shared_document_ids)
      and d.user_id = owner_id
      and d.status = 'accepted'
      and (d.expiry_date is null or d.expiry_date >= current_date)
      and not exists (
        select 1 from public.buyer_documents newer
        where newer.user_id = d.user_id
          and newer.requirement_id = d.requirement_id
          and (newer.created_at, newer.id) > (d.created_at, d.id)
      );
    if valid_count <> cardinality(shared_document_ids) then
      raise exception 'The consent contains a document that is no longer current';
    end if;
  end if;

  update public.document_shares
  set status = p_status,
      fulfilled_at = case when p_status = 'shared' then now() else fulfilled_at end
  where id = p_share_id and status = 'requested';

  if not found then raise exception 'Share request not found or already handled'; end if;

  insert into public.audit_events (actor_id, event_name, subject_type, subject_id, metadata)
  values (
    (select auth.uid()),
    'document_share_updated',
    'document_share',
    p_share_id::text,
    jsonb_build_object('status', p_status)
  );
end;
$$;

create or replace function public.register_stripe_gate_attempt(
  p_match_id uuid,
  p_user_id uuid,
  p_gate text,
  p_session_id text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  match_record public.matches%rowtype;
  introduction_record public.introductions%rowtype;
  side text;
begin
  if (select auth.role()) is distinct from 'service_role' then raise exception 'Service role required'; end if;
  if p_gate is null or p_gate not in ('checkout', 'identity') then raise exception 'Invalid Stripe gate'; end if;
  if nullif(trim(p_session_id), '') is null then raise exception 'Stripe session is required'; end if;

  select * into match_record from public.matches where id = p_match_id for update;
  if match_record.id is null
    or p_user_id not in (match_record.user_a, match_record.user_b)
    or match_record.status <> 'mutual_interest'
    or not public.match_participants_eligible(p_match_id) then
    raise exception 'The introduction is no longer ready for Stripe gates';
  end if;

  select * into introduction_record
  from public.introductions
  where match_id = p_match_id and status = 'gates_pending'
  for update;
  if introduction_record.match_id is null then raise exception 'Introduction gates are not available'; end if;

  side := case when match_record.user_a = p_user_id then 'a' else 'b' end;
  if p_gate = 'checkout' then
    if side = 'a' then
      update public.introductions
      set payment_a_status = 'pending', checkout_session_a_id = p_session_id
      where match_id = p_match_id;
    else
      update public.introductions
      set payment_b_status = 'pending', checkout_session_b_id = p_session_id
      where match_id = p_match_id;
    end if;
  else
    if side = 'a' then
      update public.introductions
      set identity_a_status = 'pending', identity_session_a_id = p_session_id
      where match_id = p_match_id;
    else
      update public.introductions
      set identity_b_status = 'pending', identity_session_b_id = p_session_id
      where match_id = p_match_id;
    end if;
  end if;

  insert into public.audit_events (actor_id, event_name, subject_type, subject_id, metadata)
  values (
    p_user_id,
    'stripe_gate_started',
    'match',
    p_match_id::text,
    jsonb_build_object('gate', p_gate, 'session_id', p_session_id)
  );
end;
$$;

create or replace function public.apply_stripe_event(
  p_event_id text,
  p_event_type text,
  p_object_id text,
  p_match_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  match_record public.matches%rowtype;
  introduction_record public.introductions%rowtype;
  side text;
begin
  if p_event_type is null or p_event_type not in ('checkout.session.completed', 'identity.verification_session.verified') then
    raise exception 'Unsupported Stripe event';
  end if;

  insert into public.stripe_webhook_events (event_id, event_type, object_id)
  values (p_event_id, p_event_type, p_object_id)
  on conflict (event_id) do nothing;
  if not found then return false; end if;

  select * into match_record from public.matches where id = p_match_id for update;
  if match_record.id is null
    or p_user_id not in (match_record.user_a, match_record.user_b)
    or match_record.status not in ('mutual_interest', 'unlocked')
    or not public.match_participants_eligible(p_match_id) then
    raise exception 'Stripe metadata does not identify a match participant';
  end if;

  select * into introduction_record
  from public.introductions
  where match_id = p_match_id
  for update;
  if introduction_record.match_id is null
    or introduction_record.status not in ('gates_pending', 'unlocked') then
    raise exception 'Introduction not found or no longer active';
  end if;

  side := case when match_record.user_a = p_user_id then 'a' else 'b' end;
  if p_event_type = 'checkout.session.completed' then
    if (side = 'a' and introduction_record.checkout_session_a_id is distinct from p_object_id)
      or (side = 'b' and introduction_record.checkout_session_b_id is distinct from p_object_id) then
      raise exception 'Checkout session does not match the active attempt';
    end if;
    if side = 'a' then
      update public.introductions
      set payment_a_status = 'paid', checkout_session_a_id = p_object_id
      where match_id = p_match_id;
    else
      update public.introductions
      set payment_b_status = 'paid', checkout_session_b_id = p_object_id
      where match_id = p_match_id;
    end if;
  else
    if (side = 'a' and introduction_record.identity_session_a_id is distinct from p_object_id)
      or (side = 'b' and introduction_record.identity_session_b_id is distinct from p_object_id) then
      raise exception 'Verification session does not match the active attempt';
    end if;
    if side = 'a' then
      update public.introductions
      set identity_a_status = 'verified', identity_session_a_id = p_object_id
      where match_id = p_match_id;
    else
      update public.introductions
      set identity_b_status = 'verified', identity_session_b_id = p_object_id
      where match_id = p_match_id;
    end if;
    update public.profiles set identity_status = 'verified' where id = p_user_id;
  end if;

  insert into public.audit_events (actor_id, event_name, subject_type, subject_id, metadata)
  values (
    p_user_id,
    'stripe_gate_completed',
    'match',
    p_match_id::text,
    jsonb_build_object('event_id', p_event_id, 'event_type', p_event_type, 'object_id', p_object_id)
  );

  return true;
end;
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
  member_a uuid;
  member_b uuid;
  current_match_status text;
begin
  select
    count(*) filter (where decision = 'interested'),
    count(*) filter (where decision = 'declined')
  into interested_count, declined_count
  from public.match_decisions
  where match_id = new.match_id;

  select user_a, user_b, status into member_a, member_b, current_match_status
  from public.matches where id = new.match_id for update;

  if current_match_status is distinct from 'proposed' then
    raise exception 'This proposal is no longer active';
  end if;

  if declined_count > 0 then
    update public.matches set status = 'declined' where id = new.match_id;
    perform public.refresh_member_matching_status(member_a);
    perform public.refresh_member_matching_status(member_b);
  elsif interested_count = 2 then
    if public.match_participants_eligible(new.match_id) then
      update public.matches set status = 'mutual_interest' where id = new.match_id;
      insert into public.introductions (match_id) values (new.match_id)
      on conflict (match_id) do nothing;
      update public.profiles set matching_status = 'introduced' where id in (member_a, member_b);
    else
      update public.matches set status = 'closed' where id = new.match_id;
      update public.introductions set status = 'closed' where match_id = new.match_id;
      perform public.refresh_member_matching_status(member_a);
      perform public.refresh_member_matching_status(member_b);
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.sync_introduction_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'closed'
    and new.identity_a_status = 'verified'
    and new.identity_b_status = 'verified'
    and new.payment_a_status = 'paid'
    and new.payment_b_status = 'paid'
    and new.contact_unlocked_at is null then
      if public.match_participants_eligible(new.match_id) then
        new.status = 'unlocked';
        new.contact_unlocked_at = now();
        update public.matches set status = 'unlocked' where id = new.match_id;
      else
        new.status = 'closed';
        update public.matches set status = 'closed' where id = new.match_id;
      end if;
  end if;
  return new;
end;
$$;

create or replace function public.refresh_document_owner_matching_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_member_matching_status(old.user_id);
    return old;
  end if;

  perform public.refresh_member_matching_status(new.user_id);
  return new;
end;
$$;

drop trigger if exists document_matching_status_sync on public.buyer_documents;
create trigger document_matching_status_sync
  after insert or update or delete on public.buyer_documents
  for each row execute function public.refresh_document_owner_matching_status();

drop policy if exists alignment_select on public.alignment_responses;
drop policy if exists alignment_insert_own on public.alignment_responses;
drop policy if exists alignment_update_own on public.alignment_responses;

create policy alignment_select on public.alignment_responses for select to authenticated
using (
  (select public.is_admin())
  or (select auth.uid()) = user_id
  or (
    share_with_match
    and exists (
      select 1 from public.matches m
      where m.id = match_id
        and m.status in ('mutual_interest', 'unlocked')
        and (select auth.uid()) in (m.user_a, m.user_b)
    )
  )
);
create policy alignment_insert_own on public.alignment_responses for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.matches m
    where m.id = match_id
      and m.status in ('mutual_interest', 'unlocked')
      and (select auth.uid()) in (m.user_a, m.user_b)
  )
);
create policy alignment_update_own on public.alignment_responses for update to authenticated
using (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.matches m
    where m.id = match_id
      and m.status in ('mutual_interest', 'unlocked')
      and (select auth.uid()) in (m.user_a, m.user_b)
  )
)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.matches m
    where m.id = match_id
      and m.status in ('mutual_interest', 'unlocked')
      and (select auth.uid()) in (m.user_a, m.user_b)
  )
);

drop policy if exists decisions_insert_own on public.match_decisions;
create policy decisions_insert_own on public.match_decisions for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and public.match_participants_are_ready(match_id)
  and exists (
    select 1 from public.matches m
    where m.id = match_id
      and (select auth.uid()) in (m.user_a, m.user_b)
      and m.status = 'proposed'
      and m.expires_at > now()
  )
);

drop policy if exists documents_delete_own on public.buyer_documents;
create policy documents_delete_own on public.buyer_documents for delete to authenticated
using (
  (select public.is_admin())
  or ((select auth.uid()) = user_id and status <> 'accepted')
);

create or replace function public.buyer_document_object_is_removable(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1
    from public.buyer_documents d
    where d.user_id = (select auth.uid())
      and d.storage_path = p_name
      and d.status in ('under_review', 'accepted')
  );
$$;

drop policy if exists buyer_document_objects_update on storage.objects;

drop policy if exists buyer_document_objects_delete on storage.objects;
create policy buyer_document_objects_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'buyer-documents'
  and (
    (select public.is_admin())
    or (
      (storage.foldername(name))[1] = (select auth.uid())::text
      and public.buyer_document_object_is_removable(name)
    )
  )
);

revoke update on public.buyer_preferences from authenticated;
revoke insert, delete on public.buyer_preferences from authenticated;
revoke update on public.contact_preferences from authenticated;
revoke update (email, phone, preferred_channel) on public.contact_preferences from authenticated;
grant update (
  first_time_buyer,
  irish_resident,
  owner_occupier,
  open_to_unrelated_cobuyer,
  buying_as_pair_only,
  purchase_timeline,
  income_range,
  deposit_range,
  borrowing_range,
  monthly_housing_budget_range,
  target_locations,
  property_types,
  must_haves,
  household_preferences,
  future_plans,
  ownership_expectations,
  bio
) on public.buyer_preferences to authenticated;

revoke update (
  onboarding_status,
  terms_accepted_at,
  privacy_accepted_at
) on public.profiles from authenticated;
revoke insert on public.document_shares from authenticated;
revoke insert on public.reports from authenticated;
revoke insert on public.buyer_documents from authenticated;
grant insert (
  user_id,
  requirement_id,
  storage_path,
  original_filename,
  mime_type,
  size_bytes
) on public.buyer_documents to authenticated;

revoke select on public.introductions from authenticated;
grant select (
  match_id,
  status,
  identity_a_status,
  identity_b_status,
  payment_a_status,
  payment_b_status,
  contact_unlocked_at,
  broker_handoff_status,
  created_at,
  updated_at
) on public.introductions to authenticated;

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated
using (
  (select auth.uid()) = id
  and onboarding_status in ('draft', 'ready_for_review', 'changes_requested')
)
with check (
  (select auth.uid()) = id
  and onboarding_status in ('draft', 'ready_for_review', 'changes_requested')
);

drop policy if exists preferences_update_own on public.buyer_preferences;
create policy preferences_update_own on public.buyer_preferences for update to authenticated
using (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.profiles p
    where p.id = user_id
      and p.onboarding_status in ('draft', 'ready_for_review', 'changes_requested')
  )
)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.profiles p
    where p.id = user_id
      and p.onboarding_status in ('draft', 'ready_for_review', 'changes_requested')
  )
);

revoke all on function public.profile_is_complete(uuid) from public;
revoke all on function public.profile_has_current_acceptance(uuid) from public;
revoke all on function public.invalidate_profile_submission_on_profile_edit() from public;
revoke all on function public.invalidate_profile_submission_on_preferences_edit() from public;
revoke all on function public.lock_document_owner_profile() from public;
revoke all on function public.member_documents_ready(uuid) from public;
revoke all on function public.refresh_member_matching_status(uuid) from public;
revoke all on function public.match_participants_eligible(uuid) from public;
revoke all on function public.match_participants_are_ready(uuid) from public;
revoke all on function public.expire_stale_matches() from public;
revoke all on function public.submit_profile_for_review(text, text, text) from public;
revoke all on function public.update_contact_preferences(text, text, text) from public;
revoke all on function public.admin_review_profile(uuid, text, text) from public;
revoke all on function public.admin_review_document(uuid, text, text, date) from public;
revoke all on function public.prepare_document_removal(uuid) from public;
revoke all on function public.admin_propose_match(uuid, uuid, jsonb, smallint, smallint, text) from public;
revoke all on function public.submit_safety_report(uuid, uuid, text) from public;
revoke all on function public.admin_resolve_report(uuid, text, text) from public;
revoke all on function public.request_document_share(text, text, uuid[]) from public;
revoke all on function public.admin_update_document_share(uuid, text) from public;
revoke all on function public.register_stripe_gate_attempt(uuid, uuid, text, text) from public;
revoke all on function public.apply_stripe_event(text, text, text, uuid, uuid) from public;
revoke all on function public.buyer_document_object_is_removable(text) from public;
revoke all on function public.get_unlocked_contact(uuid) from public;

grant execute on function public.submit_profile_for_review(text, text, text) to authenticated;
grant execute on function public.update_contact_preferences(text, text, text) to authenticated;
grant execute on function public.expire_stale_matches() to authenticated, service_role;
grant execute on function public.match_participants_are_ready(uuid) to authenticated;
grant execute on function public.admin_review_profile(uuid, text, text) to authenticated;
grant execute on function public.admin_review_document(uuid, text, text, date) to authenticated;
grant execute on function public.prepare_document_removal(uuid) to authenticated;
grant execute on function public.admin_propose_match(uuid, uuid, jsonb, smallint, smallint, text) to authenticated;
grant execute on function public.submit_safety_report(uuid, uuid, text) to authenticated;
grant execute on function public.admin_resolve_report(uuid, text, text) to authenticated;
grant execute on function public.request_document_share(text, text, uuid[]) to authenticated;
grant execute on function public.admin_update_document_share(uuid, text) to authenticated;
grant execute on function public.register_stripe_gate_attempt(uuid, uuid, text, text) to service_role;
grant execute on function public.apply_stripe_event(text, text, text, uuid, uuid) to service_role;
grant execute on function public.buyer_document_object_is_removable(text) to authenticated;
grant execute on function public.get_unlocked_contact(uuid) to authenticated;

do $$
declare
  member record;
begin
  for member in
    select id from public.profiles where role = 'buyer' order by id
  loop
    perform public.refresh_member_matching_status(member.id);
  end loop;
end;
$$;
