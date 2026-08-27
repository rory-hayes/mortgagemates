-- Allow protected MVP deployments to exercise the post-match journey without
-- recording a fake Stripe webhook or claiming a real payment/identity result.

create or replace function public.complete_mock_introduction_gate(
  p_match_id uuid,
  p_user_id uuid,
  p_gate text,
  p_attempt_id text
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
  if (select auth.role()) is distinct from 'service_role' then raise exception 'Service role required'; end if;
  if p_gate is null or p_gate not in ('checkout', 'identity') then raise exception 'Invalid mock gate'; end if;
  if nullif(trim(p_attempt_id), '') is null or left(p_attempt_id, 5) <> 'mock_' then
    raise exception 'Mock attempt identifier is required';
  end if;

  select * into match_record from public.matches where id = p_match_id for update;
  if match_record.id is null
    or p_user_id not in (match_record.user_a, match_record.user_b)
    or match_record.status <> 'mutual_interest'
    or not public.match_participants_eligible(p_match_id) then
    raise exception 'The introduction is no longer ready for mock gates';
  end if;

  select * into introduction_record
  from public.introductions
  where match_id = p_match_id and status = 'gates_pending'
  for update;
  if introduction_record.match_id is null then raise exception 'Introduction gates are not available'; end if;

  side := case when match_record.user_a = p_user_id then 'a' else 'b' end;
  if p_gate = 'checkout' then
    if (side = 'a' and introduction_record.payment_a_status = 'paid')
      or (side = 'b' and introduction_record.payment_b_status = 'paid') then
      return false;
    end if;
    if side = 'a' then
      update public.introductions
      set payment_a_status = 'paid', checkout_session_a_id = p_attempt_id
      where match_id = p_match_id;
    else
      update public.introductions
      set payment_b_status = 'paid', checkout_session_b_id = p_attempt_id
      where match_id = p_match_id;
    end if;
  else
    if (side = 'a' and introduction_record.identity_a_status = 'verified')
      or (side = 'b' and introduction_record.identity_b_status = 'verified') then
      return false;
    end if;
    if side = 'a' then
      update public.introductions
      set identity_a_status = 'verified', identity_session_a_id = p_attempt_id
      where match_id = p_match_id;
    else
      update public.introductions
      set identity_b_status = 'verified', identity_session_b_id = p_attempt_id
      where match_id = p_match_id;
    end if;
    update public.profiles set identity_status = 'verified' where id = p_user_id;
  end if;

  insert into public.audit_events (actor_id, event_name, subject_type, subject_id, metadata)
  values (
    p_user_id,
    'mock_gate_completed',
    'match',
    p_match_id::text,
    jsonb_build_object('gate', p_gate, 'attempt_id', p_attempt_id, 'mode', 'mock', 'provider', 'none')
  );

  return true;
end;
$$;

revoke all on function public.complete_mock_introduction_gate(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.complete_mock_introduction_gate(uuid, uuid, text, text) to service_role;
