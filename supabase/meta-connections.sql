create table if not exists public.meta_connections (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  service text not null default 'instagram',
  instagram_account_id text,
  page_id text,
  ad_account_id text,
  ad_account_name text,
  business_id text,
  username text not null default '',
  display_name text not null default '',
  avatar_url text not null default '',
  scopes text[] not null default '{}'::text[],
  access_token text not null,
  expires_at timestamptz,
  connected_by text references public.profiles(id) on delete set null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meta_connections_service_check check (service in ('instagram', 'ads'))
);

alter table public.meta_connections add column if not exists ad_account_id text;
alter table public.meta_connections add column if not exists ad_account_name text;
alter table public.meta_connections add column if not exists business_id text;
alter table public.meta_connections alter column instagram_account_id drop not null;

alter table public.meta_connections drop constraint if exists meta_connections_service_check;
alter table public.meta_connections
  add constraint meta_connections_service_check check (service in ('instagram', 'ads'));

create unique index if not exists meta_connections_organization_service_idx
on public.meta_connections (organization_id, service);

alter table public.meta_connections enable row level security;

drop policy if exists "members read meta connection status" on public.meta_connections;
create policy "members read meta connection status"
on public.meta_connections for select
using (organization_id = public.current_organization_id());

drop policy if exists "admins and managers manage meta connection" on public.meta_connections;
create policy "admins and managers manage meta connection"
on public.meta_connections for all
using (organization_id = public.current_organization_id() and public.current_member_role() in ('admin', 'gestor'))
with check (organization_id = public.current_organization_id() and public.current_member_role() in ('admin', 'gestor'));

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'meta_connections'
     ) then
    alter publication supabase_realtime add table public.meta_connections;
  end if;
end $$;
