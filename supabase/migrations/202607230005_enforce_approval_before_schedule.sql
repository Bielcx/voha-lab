-- Keep the approval invariant inside Postgres, including concurrent requests.
create or replace function public.enforce_approval_before_schedule()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  latest_status public.approval_status;
  latest_revoked_at timestamptz;
begin
  if old.status = 'pending_approval' and new.status = 'scheduled' then
    select approval.status, approval.revoked_at
      into latest_status, latest_revoked_at
    from public.post_approvals approval
    where approval.post_id = new.id
    order by approval.created_at desc, approval.id desc
    limit 1;

    if latest_status is distinct from 'approved'
      or latest_revoked_at is not null
    then
      raise exception 'post requires approval before scheduling'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists posts_enforce_approval_before_schedule on public.posts;
create trigger posts_enforce_approval_before_schedule
before update of status on public.posts
for each row execute function public.enforce_approval_before_schedule();

revoke all on function public.enforce_approval_before_schedule()
  from public, anon, authenticated;
