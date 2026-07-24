-- Secure, single-use approval links and atomic post transitions.
alter table public.post_approvals
  add column if not exists revoked_at timestamptz;

create index if not exists post_approvals_post_created_idx
  on public.post_approvals(post_id, created_at desc);

create unique index if not exists post_approvals_active_pending_unique
  on public.post_approvals(post_id)
  where status = 'pending' and revoked_at is null;

create or replace function public.request_post_approval(
  target_post_id uuid,
  target_token_hash text,
  target_approver_name text,
  target_approver_email text,
  target_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_post public.posts%rowtype;
  approval_id uuid;
begin
  if nullif(trim(target_token_hash), '') is null then
    raise exception 'approval token hash is required';
  end if;

  if target_expires_at <= now()
    or target_expires_at > now() + interval '30 days'
  then
    raise exception 'approval expiration is invalid';
  end if;

  select *
    into target_post
  from public.posts
  where id = target_post_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'post not found';
  end if;

  if not public.can_edit_workspace(target_post.workspace_id) then
    raise exception 'not authorized';
  end if;

  if target_post.status not in ('draft', 'pending_approval') then
    raise exception 'post cannot be sent for approval';
  end if;

  update public.post_approvals
  set revoked_at = now()
  where post_id = target_post.id
    and status = 'pending'
    and revoked_at is null;

  insert into public.post_approvals (
    post_id,
    requested_by,
    approver_name,
    approver_email,
    token_hash,
    status,
    expires_at
  )
  values (
    target_post.id,
    auth.uid(),
    nullif(trim(target_approver_name), ''),
    nullif(lower(trim(target_approver_email)), ''),
    target_token_hash,
    'pending',
    target_expires_at
  )
  returning id into approval_id;

  if target_post.status = 'draft' then
    update public.posts
    set status = 'pending_approval'
    where id = target_post.id
      and status = 'draft';
  end if;

  return approval_id;
end;
$$;

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

revoke all on function public.request_post_approval(uuid, text, text, text, timestamptz)
  from public, anon;
revoke all on function public.respond_to_post_approval(text, public.approval_status, text)
  from public, anon, authenticated;

grant execute on function public.request_post_approval(uuid, text, text, text, timestamptz)
  to authenticated;
grant execute on function public.respond_to_post_approval(text, public.approval_status, text)
  to service_role;
