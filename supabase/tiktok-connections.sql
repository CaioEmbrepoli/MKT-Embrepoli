create table if not exists public.tiktok_connections (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  environment text not null default 'sandbox',
  tiktok_open_id text not null default '',
  display_name text not null default '',
  avatar_url text not null default '',
  scopes text[] not null default '{}'::text[],
  access_token text not null default '',
  refresh_token text not null default '',
  expires_at timestamptz,
  refresh_expires_at timestamptz,
  connected_by text references public.profiles(id) on delete set null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tiktok_connections_environment_check check (environment in ('sandbox', 'production'))
);

create unique index if not exists tiktok_connections_organization_environment_idx
on public.tiktok_connections (organization_id, environment);

alter table public.tiktok_connections enable row level security;

drop policy if exists "members read tiktok connection status" on public.tiktok_connections;
create policy "members read tiktok connection status" on public.tiktok_connections for select
using (organization_id = public.current_organization_id());

drop policy if exists "admins and managers manage tiktok connection" on public.tiktok_connections;
create policy "admins and managers manage tiktok connection" on public.tiktok_connections for all
using (organization_id = public.current_organization_id() and public.current_member_role() in ('admin', 'gestor'))
with check (organization_id = public.current_organization_id() and public.current_member_role() in ('admin', 'gestor'));

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tiktok_connections'
  ) then
    alter publication supabase_realtime add table public.tiktok_connections;
  end if;
end $$;
