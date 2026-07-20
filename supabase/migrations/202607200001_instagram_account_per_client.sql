-- The MVP supports one professional Instagram account per client.
create unique index if not exists instagram_accounts_client_unique
  on public.instagram_accounts(client_id);
