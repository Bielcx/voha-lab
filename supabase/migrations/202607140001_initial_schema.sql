-- Voha initial schema: workspace-first, RLS-protected and ready for Meta publishing.
create extension if not exists pgcrypto;

create type public.workspace_role as enum ('owner', 'editor', 'approver');
create type public.client_status as enum ('active', 'paused', 'archived');
create type public.instagram_connection_status as enum ('disconnected', 'connected', 'expired', 'error');
create type public.content_format as enum ('image', 'carousel', 'reel');
create type public.post_status as enum ('draft', 'pending_approval', 'scheduled', 'publishing', 'published', 'failed');
create type public.approval_status as enum ('pending', 'approved', 'changes_requested');
create type public.media_kind as enum ('image', 'video');
create type public.media_status as enum ('uploading', 'ready', 'failed');
create type public.notification_type as enum ('publication_failed', 'approval_requested', 'approval_received', 'connection_expiring');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  timezone text not null default 'America/Sao_Paulo',
  owner_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.workspace_role not null default 'editor',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  slug text not null,
  instagram_handle text,
  contact_name text,
  contact_email text,
  brand_color text,
  status public.client_status not null default 'active',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index clients_workspace_slug_unique
  on public.clients(workspace_id, slug)
  where deleted_at is null;

create table public.instagram_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  username text,
  instagram_user_id text,
  facebook_page_id text,
  profile_picture_url text,
  connection_status public.instagram_connection_status not null default 'disconnected',
  token_expires_at timestamptz,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, instagram_user_id)
);

-- No authenticated-user policy is created for credentials. Only the server secret key may access it.
create table public.instagram_credentials (
  instagram_account_id uuid primary key references public.instagram_accounts(id) on delete cascade,
  access_token_ciphertext text not null,
  encryption_key_version smallint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  storage_provider text not null default 'r2' check (storage_provider = 'r2'),
  storage_key text not null unique,
  original_name text not null,
  mime_type text not null,
  kind public.media_kind not null,
  status public.media_status not null default 'uploading',
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  checksum text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  instagram_account_id uuid references public.instagram_accounts(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  format public.content_format not null default 'image',
  status public.post_status not null default 'draft',
  caption text not null default '' check (char_length(caption) <= 2200),
  first_comment text not null default '' check (char_length(first_comment) <= 2200),
  scheduled_for timestamptz,
  published_at timestamptz,
  meta_media_id text,
  failure_code text,
  failure_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (status <> 'scheduled' or scheduled_for is not null),
  check (status <> 'published' or published_at is not null)
);

create table public.post_media (
  post_id uuid not null references public.posts(id) on delete cascade,
  media_asset_id uuid not null references public.media_assets(id) on delete restrict,
  position smallint not null check (position >= 0 and position <= 19),
  created_at timestamptz not null default now(),
  primary key (post_id, media_asset_id),
  unique (post_id, position)
);

create table public.post_approvals (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  requested_by uuid references public.profiles(id) on delete set null,
  approver_user_id uuid references public.profiles(id) on delete set null,
  approver_name text,
  approver_email text,
  token_hash text unique,
  status public.approval_status not null default 'pending',
  comment text,
  expires_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.post_status_events (
  id bigint generated always as identity primary key,
  post_id uuid not null references public.posts(id) on delete cascade,
  from_status public.post_status,
  to_status public.post_status not null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.publication_attempts (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  attempt_number smallint not null check (attempt_number > 0),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  succeeded boolean,
  provider_response jsonb,
  error_code text,
  error_message text,
  unique (post_id, attempt_number)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  type public.notification_type not null,
  title text not null,
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index workspace_members_user_idx on public.workspace_members(user_id);
create index clients_workspace_idx on public.clients(workspace_id) where deleted_at is null;
create index instagram_accounts_client_idx on public.instagram_accounts(client_id);
create index media_assets_workspace_created_idx on public.media_assets(workspace_id, created_at desc) where deleted_at is null;
create index posts_workspace_schedule_idx on public.posts(workspace_id, scheduled_for) where deleted_at is null;
create index posts_workspace_status_idx on public.posts(workspace_id, status) where deleted_at is null;
create index post_status_events_post_idx on public.post_status_events(post_id, created_at desc);
create index notifications_user_unread_idx on public.notifications(user_id, created_at desc) where read_at is null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create or replace function public.handle_new_workspace()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.can_edit_workspace(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace_id
      and user_id = auth.uid()
      and role in ('owner', 'editor')
  );
$$;

create or replace function public.validate_post_status_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = new.status then
    return new;
  end if;

  if not (
    (old.status = 'draft' and new.status in ('pending_approval', 'scheduled')) or
    (old.status = 'pending_approval' and new.status in ('draft', 'scheduled')) or
    (old.status = 'scheduled' and new.status in ('draft', 'publishing')) or
    (old.status = 'publishing' and new.status in ('published', 'failed')) or
    (old.status = 'failed' and new.status in ('draft', 'scheduled', 'publishing'))
  ) then
    raise exception 'invalid post status transition: % -> %', old.status, new.status;
  end if;

  if new.status = 'scheduled' and new.scheduled_for is null then
    raise exception 'scheduled_for is required for scheduled posts';
  end if;

  if new.status = 'published' and new.published_at is null then
    raise exception 'published_at is required for published posts';
  end if;

  return new;
end;
$$;

create or replace function public.validate_workspace_relations()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.client_id is not null and not exists (
    select 1 from public.clients
    where id = new.client_id and workspace_id = new.workspace_id
  ) then
    raise exception 'client must belong to the same workspace';
  end if;

  if tg_table_name = 'posts' and new.instagram_account_id is not null and not exists (
    select 1 from public.instagram_accounts
    where id = new.instagram_account_id
      and workspace_id = new.workspace_id
      and client_id = new.client_id
  ) then
    raise exception 'Instagram account must belong to the post client and workspace';
  end if;

  return new;
end;
$$;

create or replace function public.validate_post_media_workspace()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.posts p
    join public.media_assets m on m.id = new.media_asset_id
    where p.id = new.post_id
      and p.workspace_id = m.workspace_id
  ) then
    raise exception 'post and media must belong to the same workspace';
  end if;

  return new;
end;
$$;

create or replace function public.record_initial_post_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.post_status_events (post_id, to_status, actor_user_id)
  values (new.id, new.status, auth.uid());
  return new;
end;
$$;

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
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger on_workspace_created
  after insert on public.workspaces
  for each row execute function public.handle_new_workspace();

create trigger on_post_created
  after insert on public.posts
  for each row execute function public.record_initial_post_status();

create trigger validate_instagram_account_workspace
  before insert or update of workspace_id, client_id on public.instagram_accounts
  for each row execute function public.validate_workspace_relations();

create trigger validate_media_asset_workspace
  before insert or update of workspace_id, client_id on public.media_assets
  for each row execute function public.validate_workspace_relations();

create trigger validate_post_workspace
  before insert or update of workspace_id, client_id, instagram_account_id on public.posts
  for each row execute function public.validate_workspace_relations();

create trigger validate_post_media_workspace
  before insert or update of post_id, media_asset_id on public.post_media
  for each row execute function public.validate_post_media_workspace();

create trigger validate_post_status_transition
  before update of status on public.posts
  for each row execute function public.validate_post_status_transition();

create trigger on_post_status_changed
  after update of status on public.posts
  for each row execute function public.record_post_status_change();

create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger workspaces_updated_at before update on public.workspaces for each row execute function public.set_updated_at();
create trigger clients_updated_at before update on public.clients for each row execute function public.set_updated_at();
create trigger instagram_accounts_updated_at before update on public.instagram_accounts for each row execute function public.set_updated_at();
create trigger instagram_credentials_updated_at before update on public.instagram_credentials for each row execute function public.set_updated_at();
create trigger media_assets_updated_at before update on public.media_assets for each row execute function public.set_updated_at();
create trigger posts_updated_at before update on public.posts for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.clients enable row level security;
alter table public.instagram_accounts enable row level security;
alter table public.instagram_credentials enable row level security;
alter table public.media_assets enable row level security;
alter table public.posts enable row level security;
alter table public.post_media enable row level security;
alter table public.post_approvals enable row level security;
alter table public.post_status_events enable row level security;
alter table public.publication_attempts enable row level security;
alter table public.notifications enable row level security;

create policy "profiles_select_own" on public.profiles for select to authenticated using (id = auth.uid());
create policy "profiles_update_own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "workspaces_select_member" on public.workspaces for select to authenticated using (public.is_workspace_member(id) or owner_id = auth.uid());
create policy "workspaces_insert_owner" on public.workspaces for insert to authenticated with check (owner_id = auth.uid());
create policy "workspaces_update_editor" on public.workspaces for update to authenticated using (public.can_edit_workspace(id)) with check (public.can_edit_workspace(id));

create policy "members_select_member" on public.workspace_members for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "members_insert_owner" on public.workspace_members for insert to authenticated with check (
  exists (select 1 from public.workspaces where id = workspace_id and owner_id = auth.uid())
);
create policy "members_update_owner" on public.workspace_members for update to authenticated using (
  exists (select 1 from public.workspaces where id = workspace_id and owner_id = auth.uid())
);
create policy "members_delete_owner" on public.workspace_members for delete to authenticated using (
  exists (select 1 from public.workspaces where id = workspace_id and owner_id = auth.uid())
  and user_id <> auth.uid()
);

create policy "clients_select_member" on public.clients for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "clients_insert_editor" on public.clients for insert to authenticated with check (public.can_edit_workspace(workspace_id));
create policy "clients_update_editor" on public.clients for update to authenticated using (public.can_edit_workspace(workspace_id)) with check (public.can_edit_workspace(workspace_id));
create policy "clients_delete_editor" on public.clients for delete to authenticated using (public.can_edit_workspace(workspace_id));

create policy "instagram_accounts_select_member" on public.instagram_accounts for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "instagram_accounts_insert_editor" on public.instagram_accounts for insert to authenticated with check (public.can_edit_workspace(workspace_id));
create policy "instagram_accounts_update_editor" on public.instagram_accounts for update to authenticated using (public.can_edit_workspace(workspace_id)) with check (public.can_edit_workspace(workspace_id));
create policy "instagram_accounts_delete_editor" on public.instagram_accounts for delete to authenticated using (public.can_edit_workspace(workspace_id));

create policy "media_select_member" on public.media_assets for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "media_insert_editor" on public.media_assets for insert to authenticated with check (public.can_edit_workspace(workspace_id));
create policy "media_update_editor" on public.media_assets for update to authenticated using (public.can_edit_workspace(workspace_id)) with check (public.can_edit_workspace(workspace_id));
create policy "media_delete_editor" on public.media_assets for delete to authenticated using (public.can_edit_workspace(workspace_id));

create policy "posts_select_member" on public.posts for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "posts_insert_editor" on public.posts for insert to authenticated with check (public.can_edit_workspace(workspace_id));
create policy "posts_update_editor" on public.posts for update to authenticated using (public.can_edit_workspace(workspace_id)) with check (public.can_edit_workspace(workspace_id));
create policy "posts_delete_editor" on public.posts for delete to authenticated using (public.can_edit_workspace(workspace_id));

create policy "post_media_select_member" on public.post_media for select to authenticated using (
  exists (select 1 from public.posts where id = post_id and public.is_workspace_member(workspace_id))
);
create policy "post_media_insert_editor" on public.post_media for insert to authenticated with check (
  exists (select 1 from public.posts where id = post_id and public.can_edit_workspace(workspace_id))
);
create policy "post_media_delete_editor" on public.post_media for delete to authenticated using (
  exists (select 1 from public.posts where id = post_id and public.can_edit_workspace(workspace_id))
);

create policy "approvals_select_member" on public.post_approvals for select to authenticated using (
  exists (select 1 from public.posts where id = post_id and public.is_workspace_member(workspace_id))
);
create policy "approvals_insert_editor" on public.post_approvals for insert to authenticated with check (
  exists (select 1 from public.posts where id = post_id and public.can_edit_workspace(workspace_id))
);
create policy "approvals_update_editor" on public.post_approvals for update to authenticated using (
  exists (select 1 from public.posts where id = post_id and public.can_edit_workspace(workspace_id))
);

create policy "status_events_select_member" on public.post_status_events for select to authenticated using (
  exists (select 1 from public.posts where id = post_id and public.is_workspace_member(workspace_id))
);

create policy "attempts_select_member" on public.publication_attempts for select to authenticated using (
  exists (select 1 from public.posts where id = post_id and public.is_workspace_member(workspace_id))
);

create policy "notifications_select_recipient" on public.notifications for select to authenticated using (
  public.is_workspace_member(workspace_id) and (user_id is null or user_id = auth.uid())
);
create policy "notifications_update_recipient" on public.notifications for update to authenticated using (
  public.is_workspace_member(workspace_id) and user_id = auth.uid()
) with check (
  public.is_workspace_member(workspace_id) and user_id = auth.uid()
);

revoke all on table public.instagram_credentials from anon, authenticated;
