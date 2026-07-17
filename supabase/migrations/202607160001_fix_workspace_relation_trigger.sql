create or replace function public.validate_workspace_relations()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_instagram_account_id uuid;
begin
  if new.client_id is not null and not exists (
    select 1
    from public.clients
    where id = new.client_id
      and workspace_id = new.workspace_id
  ) then
    raise exception 'client must belong to the same workspace';
  end if;

  if tg_table_name = 'posts' then
    target_instagram_account_id := nullif(
      to_jsonb(new) ->> 'instagram_account_id',
      ''
    )::uuid;

    if target_instagram_account_id is not null and not exists (
      select 1
      from public.instagram_accounts
      where id = target_instagram_account_id
        and workspace_id = new.workspace_id
        and client_id = new.client_id
    ) then
      raise exception 'Instagram account must belong to the post client and workspace';
    end if;
  end if;

  return new;
end;
$$;
