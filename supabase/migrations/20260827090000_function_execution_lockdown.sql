-- Remove legacy broad RPC grants left by the original MVP migration.
-- SECURITY DEFINER functions must be callable only by the roles that need them.

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
  if (select auth.uid()) is null and (select auth.role()) is distinct from 'service_role' then
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
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'Service role required';
  end if;
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

revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.submit_profile_for_review(text, text, text) to authenticated;
grant execute on function public.update_contact_preferences(text, text, text) to authenticated;
grant execute on function public.expire_stale_matches() to authenticated, service_role;
grant execute on function public.get_match_document_readiness(uuid) to authenticated;
grant execute on function public.match_participants_are_ready(uuid) to authenticated;
grant execute on function public.admin_review_profile(uuid, text, text) to authenticated;
grant execute on function public.admin_review_document(uuid, text, text, date) to authenticated;
grant execute on function public.prepare_document_removal(uuid) to authenticated;
grant execute on function public.admin_propose_match(uuid, uuid, jsonb, smallint, smallint, text) to authenticated;
grant execute on function public.submit_safety_report(uuid, uuid, text) to authenticated;
grant execute on function public.admin_resolve_report(uuid, text, text) to authenticated;
grant execute on function public.request_document_share(text, text, uuid[]) to authenticated;
grant execute on function public.revoke_document_share(uuid) to authenticated;
grant execute on function public.admin_update_document_share(uuid, text) to authenticated;
grant execute on function public.buyer_document_object_is_removable(text) to authenticated;
grant execute on function public.get_unlocked_contact(uuid) to authenticated;
grant execute on function public.register_stripe_gate_attempt(uuid, uuid, text, text) to service_role;
grant execute on function public.apply_stripe_event(text, text, text, uuid, uuid) to service_role;

alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
