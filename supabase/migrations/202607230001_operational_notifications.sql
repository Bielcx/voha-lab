-- Durable operational notifications and transactional email outbox.
alter table public.notifications
  add column if not exists severity text not null default 'info',
  add column if not exists dedupe_key text,
  add column if not exists email_status text not null default 'not_required',
  add column if not exists email_attempts smallint not null default 0,
  add column if not exists email_claim_token uuid,
  add column if not exists email_claimed_at timestamptz,
  add column if not exists next_email_attempt_at timestamptz,
  add column if not exists email_sent_at timestamptz,
  add column if not exists email_error_code text;

alter table public.notifications
  drop constraint if exists notifications_severity_check;

alter table public.notifications
  add constraint notifications_severity_check
  check (severity in ('info', 'warning', 'critical'));

alter table public.notifications
  drop constraint if exists notifications_email_status_check;

alter table public.notifications
  add constraint notifications_email_status_check
  check (email_status in ('not_required', 'pending', 'sending', 'sent', 'failed'));

alter table public.notifications
  drop constraint if exists notifications_email_attempts_check;

alter table public.notifications
  add constraint notifications_email_attempts_check
  check (email_attempts between 0 and 3);

create unique index if not exists notifications_workspace_dedupe_unique
  on public.notifications(workspace_id, dedupe_key)
  where dedupe_key is not null;

create index if not exists notifications_email_due_idx
  on public.notifications(next_email_attempt_at, created_at)
  where email_status in ('pending', 'failed');

create or replace function public.record_post_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status is distinct from new.status then
    insert into public.post_status_events (post_id, from_status, to_status, actor_user_id, reason)
    values (new.id, old.status, new.status, auth.uid(), new.failure_message);
  end if;

  -- Intermediate failures keep next_retry_at populated and do not alert yet.
  if new.status = 'failed'
    and new.next_retry_at is null
    and (old.status is distinct from new.status or old.failure_code is distinct from new.failure_code)
  then
    insert into public.notifications (
      workspace_id,
      user_id,
      type,
      severity,
      title,
      body,
      metadata,
      dedupe_key,
      email_status,
      next_email_attempt_at
    )
    select
      new.workspace_id,
      w.owner_id,
      'publication_failed'::public.notification_type,
      'critical',
      'Falha ao publicar no Instagram',
      c.name || ': ' || coalesce(new.failure_message, 'A publicação não foi concluída.'),
      jsonb_build_object(
        'postId', new.id,
        'clientId', new.client_id,
        'clientName', c.name,
        'failureCode', new.failure_code,
        'view', 'calendar'
      ),
      'publication_failed:' || new.id::text || ':' || new.publication_cycle::text,
      'pending',
      now()
    from public.workspaces w
    join public.clients c on c.id = new.client_id
    where w.id = new.workspace_id
    on conflict (workspace_id, dedupe_key) where dedupe_key is not null do nothing;
  end if;

  return new;
end;
$$;

create or replace function public.generate_connection_expiring_notifications(
  threshold_days integer default 7
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_count integer;
  safe_days integer := greatest(1, least(coalesce(threshold_days, 7), 30));
begin
  insert into public.notifications (
    workspace_id,
    user_id,
    type,
    severity,
    title,
    body,
    metadata,
    dedupe_key,
    email_status
  )
  select
    a.workspace_id,
    w.owner_id,
    'connection_expiring'::public.notification_type,
    'warning',
    'Instagram precisa ser renovado',
    c.name || ': a conexão expira em breve. Renove para não interromper os agendamentos.',
    jsonb_build_object(
      'clientId', c.id,
      'clientName', c.name,
      'instagramAccountId', a.id,
      'expiresAt', a.token_expires_at,
      'view', 'clients'
    ),
    'connection_expiring:' || a.id::text || ':' ||
      to_char(a.token_expires_at at time zone 'UTC', 'YYYYMMDDHH24MISS'),
    'not_required'
  from public.instagram_accounts a
  join public.workspaces w on w.id = a.workspace_id
  join public.clients c on c.id = a.client_id
  where a.connection_status = 'connected'
    and a.token_expires_at > now()
    and a.token_expires_at <= now() + make_interval(days => safe_days)
    and c.status = 'active'
    and c.deleted_at is null
  on conflict (workspace_id, dedupe_key) where dedupe_key is not null do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

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
  -- Recover interrupted sends. Email is at-least-once, so a crash immediately
  -- after provider acceptance can result in one duplicate operational alert.
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
      and n.email_status in ('pending', 'failed')
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

create or replace function public.finish_notification_email(
  target_notification_id uuid,
  target_claim_token uuid,
  target_succeeded boolean,
  target_error_code text default null,
  target_retryable boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_notification record;
begin
  select id, email_attempts
    into current_notification
  from public.notifications
  where id = target_notification_id
    and email_claim_token = target_claim_token
    and email_status = 'sending'
  for update;

  if not found then
    return false;
  end if;

  if target_succeeded then
    update public.notifications
    set
      email_status = 'sent',
      email_sent_at = now(),
      email_claim_token = null,
      email_claimed_at = null,
      next_email_attempt_at = null,
      email_error_code = null
    where id = current_notification.id;
  else
    update public.notifications
    set
      email_status = 'failed',
      email_claim_token = null,
      email_claimed_at = null,
      next_email_attempt_at = case
        when target_retryable and current_notification.email_attempts < 3
          then now() + make_interval(mins => (2 ^ current_notification.email_attempts)::integer)
        else null
      end,
      email_error_code = target_error_code
    where id = current_notification.id;
  end if;

  return true;
end;
$$;

revoke all on function public.generate_connection_expiring_notifications(integer) from public, anon, authenticated;
revoke all on function public.claim_notification_emails(integer) from public, anon, authenticated;
revoke all on function public.finish_notification_email(uuid, uuid, boolean, text, boolean) from public, anon, authenticated;

grant execute on function public.generate_connection_expiring_notifications(integer) to service_role;
grant execute on function public.claim_notification_emails(integer) to service_role;
grant execute on function public.finish_notification_email(uuid, uuid, boolean, text, boolean) to service_role;
