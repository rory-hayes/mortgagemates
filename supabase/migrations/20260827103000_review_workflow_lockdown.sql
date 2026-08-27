-- Require an explicit review state before an administrator can approve a buyer.

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
  if p_status = 'under_review' and current_status not in ('ready_for_review', 'under_review') then
    raise exception 'The member must resubmit the current profile before review';
  end if;
  if p_status = 'approved' then
    if current_status <> 'under_review' then
      raise exception 'Start review before approving this profile';
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

revoke all on function public.admin_review_profile(uuid, text, text) from public, anon;
grant execute on function public.admin_review_profile(uuid, text, text) to authenticated;
