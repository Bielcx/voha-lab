-- Make critical alerts actionable without exposing raw provider error messages.
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
      'Falha ao publicar • ' || c.name,
      '"' || coalesce(
        nullif(left(regexp_replace(trim(new.caption), '\s+', ' ', 'g'), 80), ''),
        'Post ' || new.format::text
      ) || '" não foi publicado. Abra o calendário, revise o erro e tente novamente.',
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
