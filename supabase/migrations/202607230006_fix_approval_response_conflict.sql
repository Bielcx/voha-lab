create or replace function public.respond_to_post_approval(
  target_token_hash text,
  target_decision public.approval_status,
  target_comment text
)
returns table (
  approval_id uuid,
  post_id uuid,
  workspace_id uuid,
  client_id uuid,
  client_name text,
  decision public.approval_status,
  response_comment text,
  responded_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_approval public.post_approvals%rowtype;
  target_post public.posts%rowtype;
  target_client public.clients%rowtype;
  response_time timestamptz := now();
begin
  if target_decision not in ('approved', 'changes_requested') then
    raise exception 'invalid approval decision';
  end if;

  select *
    into target_approval
  from public.post_approvals
  where token_hash = target_token_hash
  for update;

  if not found
    or target_approval.status <> 'pending'
    or target_approval.revoked_at is not null
    or target_approval.expires_at <= response_time
  then
    return;
  end if;

  select *
    into target_post
  from public.posts
  where id = target_approval.post_id
    and deleted_at is null
  for update;

  if not found or target_post.status <> 'pending_approval' then
    return;
  end if;

  select *
    into target_client
  from public.clients
  where id = target_post.client_id;

  update public.post_approvals
  set
    status = target_decision,
    comment = nullif(trim(target_comment), ''),
    responded_at = response_time
  where id = target_approval.id
    and status = 'pending'
    and revoked_at is null;

  if target_decision = 'changes_requested' then
    update public.posts
    set status = 'draft'
    where id = target_post.id
      and status = 'pending_approval';
  end if;

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
    target_post.workspace_id,
    w.owner_id,
    'approval_received'::public.notification_type,
    case when target_decision = 'approved' then 'info' else 'warning' end,
    case
      when target_decision = 'approved' then 'Conteúdo aprovado'
      else 'Alterações solicitadas'
    end,
    target_client.name || case
      when target_decision = 'approved'
        then ': o conteúdo foi aprovado e já pode ser agendado.'
      else ': o cliente deixou observações para a próxima versão.'
    end,
    jsonb_build_object(
      'postId', target_post.id,
      'clientId', target_client.id,
      'clientName', target_client.name,
      'approvalId', target_approval.id,
      'approvalStatus', target_decision,
      'view', 'calendar'
    ),
    'approval_received:' || target_approval.id::text,
    'not_required'
  from public.workspaces w
  where w.id = target_post.workspace_id
  on conflict do nothing;

  return query
  select
    target_approval.id,
    target_post.id,
    target_post.workspace_id,
    target_client.id,
    target_client.name,
    target_decision,
    nullif(trim(target_comment), ''),
    response_time;
end;
$$;

revoke all on function public.respond_to_post_approval(text, public.approval_status, text)
  from public, anon, authenticated;

grant execute on function public.respond_to_post_approval(text, public.approval_status, text)
  to service_role;
