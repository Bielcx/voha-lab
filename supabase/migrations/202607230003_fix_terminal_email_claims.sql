-- Failed sends without a scheduled retry are terminal and must not be claimed again.
create or replace function public.claim_notification_emails(requested_limit integer default 3)
returns table (
  notification_id uuid,
  user_id uuid,
  title text,
  body text,
  metadata jsonb,
  claim_token uuid,
  attempt_number smallint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  safe_limit integer := greatest(1, least(coalesce(requested_limit, 3), 10));
begin
  update public.notifications
  set
    email_status = 'failed',
    email_claim_token = null,
    email_claimed_at = null,
    next_email_attempt_at = case when email_attempts < 3 then now() else null end,
    email_error_code = 'email_worker_interrupted'
  where email_status = 'sending'
    and email_claimed_at < now() - interval '15 minutes';

  return query
  with candidates as (
    select n.id
    from public.notifications n
    where n.type = 'publication_failed'
      and (
        n.email_status = 'pending'
        or (n.email_status = 'failed' and n.next_email_attempt_at is not null)
      )
      and n.email_attempts < 3
      and coalesce(n.next_email_attempt_at, n.created_at) <= now()
    order by coalesce(n.next_email_attempt_at, n.created_at), n.created_at
    for update skip locked
    limit safe_limit
  )
  update public.notifications n
  set
    email_status = 'sending',
    email_attempts = n.email_attempts + 1,
    email_claim_token = gen_random_uuid(),
    email_claimed_at = now(),
    next_email_attempt_at = null,
    email_error_code = null
  from candidates c
  where n.id = c.id
  returning
    n.id,
    n.user_id,
    n.title,
    n.body,
    n.metadata,
    n.email_claim_token,
    n.email_attempts;
end;
$$;

revoke all on function public.claim_notification_emails(integer) from public, anon, authenticated;
grant execute on function public.claim_notification_emails(integer) to service_role;
