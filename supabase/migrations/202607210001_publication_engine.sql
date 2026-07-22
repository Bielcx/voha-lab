-- Durable, idempotent claiming and completion for Instagram publications.
alter table public.posts
  add column if not exists next_retry_at timestamptz,
  add column if not exists publication_cycle smallint not null default 1;

alter table public.posts
  drop constraint if exists posts_publication_cycle_check;

alter table public.posts
  add constraint posts_publication_cycle_check check (publication_cycle > 0);

alter table public.publication_attempts
  add column if not exists claim_token uuid not null default gen_random_uuid(),
  add column if not exists publication_cycle smallint not null default 1,
  add column if not exists phase text not null default 'claimed',
  add column if not exists meta_container_id text,
  add column if not exists meta_media_id text,
  add column if not exists retryable boolean not null default false;

alter table public.publication_attempts
  drop constraint if exists publication_attempts_phase_check;

alter table public.publication_attempts
  drop constraint if exists publication_attempts_post_id_attempt_number_key;

alter table public.publication_attempts
  add constraint publication_attempts_phase_check check (
    phase in (
      'claimed',
      'container_created',
      'processing',
      'publish_dispatched',
      'succeeded',
      'failed'
    )
  );

create unique index if not exists publication_attempts_claim_token_unique
  on public.publication_attempts(claim_token);

create unique index if not exists publication_attempts_cycle_number_unique
  on public.publication_attempts(post_id, publication_cycle, attempt_number);

create unique index if not exists publication_attempts_active_post_unique
  on public.publication_attempts(post_id)
  where finished_at is null;

create index if not exists posts_publication_due_idx
  on public.posts(scheduled_for)
  where status = 'scheduled' and deleted_at is null;

create index if not exists posts_publication_retry_idx
  on public.posts(next_retry_at)
  where status = 'failed' and deleted_at is null;

create or replace function public.claim_due_publications(requested_limit integer default 3)
returns table (
  post_id uuid,
  attempt_id uuid,
  claim_token uuid,
  attempt_number smallint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  stale record;
  candidate record;
  next_attempt integer;
  safe_limit integer := greatest(1, least(coalesce(requested_limit, 3), 10));
begin
  -- Recover attempts abandoned by a Worker restart. Once media_publish was
  -- dispatched, automatic retry is unsafe because Meta may already have posted.
  for stale in
    select a.id, a.post_id, a.phase, a.attempt_number
    from public.publication_attempts a
    join public.posts p on p.id = a.post_id
    where a.finished_at is null
      and a.started_at < now() - interval '15 minutes'
      and p.status = 'publishing'
    for update of a, p skip locked
  loop
    update public.publication_attempts
    set
      finished_at = now(),
      succeeded = false,
      retryable = stale.phase <> 'publish_dispatched',
      phase = 'failed',
      error_code = case
        when stale.phase = 'publish_dispatched' then 'publish_outcome_unknown'
        else 'worker_interrupted'
      end,
      error_message = case
        when stale.phase = 'publish_dispatched'
          then 'A Meta pode ter recebido a publicação. Confirme no Instagram antes de tentar novamente.'
        else 'A execução foi interrompida e será tentada novamente.'
      end
    where id = stale.id;

    update public.posts
    set
      status = 'failed',
      failure_code = case
        when stale.phase = 'publish_dispatched' then 'publish_outcome_unknown'
        else 'worker_interrupted'
      end,
      failure_message = case
        when stale.phase = 'publish_dispatched'
          then 'Confirme no Instagram antes de tentar novamente para evitar duplicação.'
        else 'A publicação será tentada novamente automaticamente.'
      end,
      next_retry_at = case
        when stale.phase <> 'publish_dispatched' and stale.attempt_number < 3 then now()
        else null
      end
    where id = stale.post_id and status = 'publishing';
  end loop;

  for candidate in
    select p.id, p.publication_cycle
    from public.posts p
    where p.deleted_at is null
      and (
        (p.status = 'scheduled' and p.scheduled_for <= now())
        or (p.status = 'failed' and p.next_retry_at <= now())
      )
      and not exists (
        select 1 from public.publication_attempts active_attempt
        where active_attempt.post_id = p.id
          and active_attempt.finished_at is null
      )
      and (
        select count(*) from public.publication_attempts previous_attempt
        where previous_attempt.post_id = p.id
          and previous_attempt.publication_cycle = p.publication_cycle
      ) < 3
    order by coalesce(p.next_retry_at, p.scheduled_for), p.created_at
    for update of p skip locked
    limit safe_limit
  loop
    select coalesce(max(a.attempt_number), 0) + 1
      into next_attempt
    from public.publication_attempts a
    where a.post_id = candidate.id
      and a.publication_cycle = candidate.publication_cycle;

    update public.posts
    set
      status = 'publishing',
      failure_code = null,
      failure_message = null,
      next_retry_at = null
    where id = candidate.id;

    insert into public.publication_attempts (
      post_id,
      attempt_number,
      publication_cycle,
      phase
    ) values (
      candidate.id,
      next_attempt,
      candidate.publication_cycle,
      'claimed'
    )
    returning
      public.publication_attempts.id,
      public.publication_attempts.claim_token,
      public.publication_attempts.attempt_number
    into attempt_id, claim_token, attempt_number;

    post_id := candidate.id;
    return next;
  end loop;
end;
$$;

create or replace function public.mark_publication_attempt_progress(
  target_attempt_id uuid,
  target_claim_token uuid,
  target_phase text,
  target_meta_container_id text default null,
  target_provider_response jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target_phase not in ('container_created', 'processing', 'publish_dispatched') then
    raise exception 'invalid publication phase';
  end if;

  update public.publication_attempts
  set
    phase = target_phase,
    meta_container_id = coalesce(target_meta_container_id, meta_container_id),
    provider_response = coalesce(target_provider_response, '{}'::jsonb)
  where id = target_attempt_id
    and claim_token = target_claim_token
    and finished_at is null;

  return found;
end;
$$;

create or replace function public.finish_publication_attempt(
  target_attempt_id uuid,
  target_claim_token uuid,
  target_succeeded boolean,
  target_meta_media_id text default null,
  target_error_code text default null,
  target_error_message text default null,
  target_provider_response jsonb default '{}'::jsonb,
  target_retryable boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_attempt record;
  retry_at timestamptz;
begin
  select id, post_id, attempt_number, finished_at
    into current_attempt
  from public.publication_attempts
  where id = target_attempt_id
    and claim_token = target_claim_token
  for update;

  if not found or current_attempt.finished_at is not null then
    return false;
  end if;

  if target_succeeded then
    update public.publication_attempts
    set
      finished_at = now(),
      succeeded = true,
      retryable = false,
      phase = 'succeeded',
      meta_media_id = target_meta_media_id,
      provider_response = coalesce(target_provider_response, '{}'::jsonb),
      error_code = null,
      error_message = null
    where id = current_attempt.id;

    update public.posts
    set
      status = 'published',
      published_at = now(),
      meta_media_id = target_meta_media_id,
      failure_code = null,
      failure_message = null,
      next_retry_at = null
    where id = current_attempt.post_id and status = 'publishing';
  else
    retry_at := case
      when target_retryable and current_attempt.attempt_number < 3
        then now() + make_interval(mins => (2 ^ current_attempt.attempt_number)::integer)
      else null
    end;

    update public.publication_attempts
    set
      finished_at = now(),
      succeeded = false,
      retryable = target_retryable,
      phase = 'failed',
      provider_response = coalesce(target_provider_response, '{}'::jsonb),
      error_code = target_error_code,
      error_message = target_error_message
    where id = current_attempt.id;

    update public.posts
    set
      status = 'failed',
      failure_code = target_error_code,
      failure_message = target_error_message,
      next_retry_at = retry_at
    where id = current_attempt.post_id and status = 'publishing';
  end if;

  return true;
end;
$$;

revoke all on function public.claim_due_publications(integer) from public, anon, authenticated;
revoke all on function public.mark_publication_attempt_progress(uuid, uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.finish_publication_attempt(uuid, uuid, boolean, text, text, text, jsonb, boolean) from public, anon, authenticated;

grant execute on function public.claim_due_publications(integer) to service_role;
grant execute on function public.mark_publication_attempt_progress(uuid, uuid, text, text, jsonb) to service_role;
grant execute on function public.finish_publication_attempt(uuid, uuid, boolean, text, text, text, jsonb, boolean) to service_role;
