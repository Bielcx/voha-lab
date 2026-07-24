-- Bounded retention for operational notifications.
create or replace function public.prune_operational_notifications(
  retention_days integer default 90
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer;
  safe_days integer := greatest(30, least(coalesce(retention_days, 90), 365));
begin
  delete from public.notifications
  where created_at < now() - make_interval(days => safe_days)
    and (
      read_at is not null
      or created_at < now() - make_interval(days => safe_days * 4)
    )
    and email_status not in ('pending', 'sending')
    and not (
      email_status = 'failed'
      and next_email_attempt_at is not null
    );

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.prune_operational_notifications(integer)
  from public, anon, authenticated;
grant execute on function public.prune_operational_notifications(integer)
  to service_role;
